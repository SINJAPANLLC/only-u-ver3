// Object Storage Service for managing large video and image uploads
// Optimized with LRU cache, Range request support, and streaming
import { Storage as FirebaseStorage } from "firebase-admin/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import { LRUCache } from "lru-cache";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Firebase Storage bucket (initialized lazily)
let firebaseStorageBucket: ReturnType<FirebaseStorage["bucket"]> | null = null;

async function getFirebaseStorageBucket() {
  if (!firebaseStorageBucket) {
    const { storage } = await import('./firebase');
    firebaseStorageBucket = storage.bucket();
  }
  return firebaseStorageBucket;
}

// LRU Cache for signed URLs (1 hour TTL, max 500 items)
const signedUrlCache = new LRUCache<string, { url: string; expiresAt: number }>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: true,
});

// LRU Cache for file metadata (size, contentType)
const fileMetadataCache = new LRUCache<string, { size: number; contentType: string; etag: string }>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: true,
});

export class ObjectStorageService {
  constructor() {}

  // Upload a file to Firebase Storage
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    userId: string,
    contentType?: string,
    visibility: 'public' | 'private' = 'public'
  ): Promise<{ objectPath: string; storageUri: string }> {
    const bucket = await getFirebaseStorageBucket();
    
    // Generate unique object path
    const objectId = randomUUID();
    const extension = fileName.split('.').pop();
    const folderPath = visibility === 'public' ? 'public' : 'private';
    const fullStoragePath = `${folderPath}/${objectId}.${extension}`;

    try {
      const file = bucket.file(fullStoragePath);
      await file.save(fileBuffer, {
        contentType: contentType || 'application/octet-stream',
        metadata: {
          metadata: {
            uploadedBy: userId,
            visibility: visibility,
          }
        }
      });

      // Make public if visibility is public
      if (visibility === 'public') {
        await file.makePublic();
      }

      // Cache metadata
      const etag = `"${objectId}"`;
      fileMetadataCache.set(fullStoragePath, {
        size: fileBuffer.length,
        contentType: contentType || 'application/octet-stream',
        etag
      });

    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Return both the storage path and object entity path
    const entityPath = `/objects/${objectId}.${extension}`;
    
    return {
      objectPath: entityPath,
      storageUri: fullStoragePath
    };
  }

  // Get signed URL with caching
  private async getSignedUrl(filePath: string): Promise<string> {
    const cached = signedUrlCache.get(filePath);
    const now = Date.now();
    
    // Return cached URL if still valid (with 5 min buffer)
    if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
      return cached.url;
    }

    const bucket = await getFirebaseStorageBucket();
    const file = bucket.file(filePath);
    
    // Generate signed URL valid for 1 hour
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    // Cache the signed URL
    signedUrlCache.set(filePath, {
      url,
      expiresAt: now + 60 * 60 * 1000,
    });

    return url;
  }

  // Get file metadata with caching
  private async getFileMetadata(filePath: string): Promise<{ size: number; contentType: string; etag: string }> {
    const cached = fileMetadataCache.get(filePath);
    if (cached) {
      return cached;
    }

    const bucket = await getFirebaseStorageBucket();
    const file = bucket.file(filePath);
    const [metadata] = await file.getMetadata();

    const size = parseInt(String(metadata.size) || '0');
    const contentType = this.getContentType(filePath);
    const etag = metadata.etag || `"${filePath.split('/').pop()}"`;

    const fileMetadata = { size, contentType, etag };
    fileMetadataCache.set(filePath, fileMetadata);

    return fileMetadata;
  }

  // Determine content type from filename
  private getContentType(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp4': return 'video/mp4';
      case 'mov': return 'video/quicktime';
      case 'webm': return 'video/webm';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  }

  // Download file with Range request support and streaming
  async downloadObject(filePath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const bucket = await getFirebaseStorageBucket();
      const file = bucket.file(filePath);
      
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('File not found');
      }

      // Get file metadata
      const { size, contentType, etag } = await this.getFileMetadata(filePath);

      // Parse Range header
      const range = res.req.headers.range;
      
      // Check if client already has the file (ETag matching)
      // CRITICAL: Skip 304 when Range header is present (iOS Safari requirement)
      // Mobile Safari sends both Range and If-None-Match headers
      // If we return 304, Safari never receives the requested byte range and playback fails
      const clientEtag = res.req.headers['if-none-match'];
      if (clientEtag === etag && !range) {
        res.status(304).end();
        return;
      }
      const isPublic = filePath.startsWith('public/');
      const cacheControl = isPublic 
        ? `public, max-age=${cacheTtlSec}, immutable`
        : `private, max-age=3600`;

      // Handle Range request (streaming)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
        const chunkSize = (end - start) + 1;

        // Set 206 Partial Content headers
        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'ETag': etag,
        });

        // Stream the requested range
        const readStream = file.createReadStream({ start, end });
        readStream.pipe(res);
        
        readStream.on('error', (error) => {
          console.error('[downloadObject] Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });

      } else {
        // Full file download (still using stream for efficiency)
        res.status(200);
        res.set({
          'Content-Type': contentType,
          'Content-Length': size.toString(),
          'Cache-Control': cacheControl,
          'Accept-Ranges': 'bytes',
          'ETag': etag,
        });

        const readStream = file.createReadStream();
        readStream.pipe(res);

        readStream.on('error', (error) => {
          console.error('[downloadObject] Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });
      }

    } catch (error) {
      console.error('[downloadObject] Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }

  // Get object entity file path
  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    const bucket = await getFirebaseStorageBucket();
    
    // Try public directory first
    const publicPath = `public/${entityId}`;
    const publicFile = bucket.file(publicPath);
    const [publicExists] = await publicFile.exists();
    
    if (publicExists) {
      return publicPath;
    }
    
    // Try private directory
    const privatePath = `private/${entityId}`;
    const privateFile = bucket.file(privatePath);
    const [privateExists] = await privateFile.exists();
    
    if (privateExists) {
      return privatePath;
    }
    
    throw new ObjectNotFoundError();
  }

  // 🚀 Get object as Buffer (for image resizing)
  async getObjectBuffer(filePath: string): Promise<Buffer> {
    const bucket = await getFirebaseStorageBucket();
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    const [buffer] = await file.download();
    return buffer;
  }

  async normalizeObjectEntityPath(rawPath: string): Promise<string> {
    // Handle Firebase Storage URLs
    if (rawPath.startsWith("https://firebasestorage.googleapis.com/") || 
        rawPath.startsWith("https://storage.googleapis.com/")) {
      try {
        const url = new URL(rawPath);
        const pathMatch = url.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)$/);
        if (pathMatch) {
          const decodedPath = decodeURIComponent(pathMatch[1]);
          const objectId = decodedPath.split('/').pop();
          return `/objects/${objectId}`;
        }
      } catch (error) {
        console.error('[normalizeObjectEntityPath] Failed to parse URL:', error);
      }
    }

    // If already in /objects/ format, return as-is
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: any
  ): Promise<string> {
    return await this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(params: {
    userId?: string;
    objectFile: any;
    requestedPermission?: any;
  }): Promise<boolean> {
    return true;
  }

  async searchPublicObject(filePath: string): Promise<string | null> {
    const bucket = await getFirebaseStorageBucket();
    const fullPath = `public/${filePath}`;
    const file = bucket.file(fullPath);
    const [exists] = await file.exists();
    return exists ? fullPath : null;
  }

  async getPublicObjectSearchPaths(): Promise<Array<string>> {
    return ['public'];
  }

  async getPrivateObjectDir(): Promise<string> {
    return 'private';
  }
}

// Compatibility exports
export const replitClient = null;
export const objectStorageClient = null;
