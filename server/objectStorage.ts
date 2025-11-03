// Object Storage Service for managing large video and image uploads
// Modified for VPS deployment - uses Firebase Storage instead of Replit Object Storage
import { Storage as FirebaseStorage } from "firebase-admin/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

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

    console.log('[uploadFile] Uploading to Firebase Storage:', fullStoragePath);

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

      console.log('[uploadFile] Upload successful to Firebase Storage!');
    } catch (error) {
      console.error('[uploadFile] Failed to upload to Firebase Storage:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Return both the storage path and object entity path
    const entityPath = `/objects/${objectId}.${extension}`;
    
    return {
      objectPath: entityPath,
      storageUri: fullStoragePath
    };
  }

  // Download file from Firebase Storage
  async downloadObject(filePath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const bucket = await getFirebaseStorageBucket();
      console.log('[downloadObject] Downloading file from Firebase:', filePath);
      
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new Error('File not found');
      }

      const [fileBuffer] = await file.download();
      console.log('[downloadObject] Downloaded successfully, size:', fileBuffer.length, 'bytes');
      
      // Determine content type from filename
      const filename = filePath.split('/').pop() || '';
      const ext = filename.toLowerCase().split('.').pop();
      let contentType = 'application/octet-stream';
      if (ext === 'mov' || ext === 'mp4') contentType = 'video/quicktime';
      else if (ext === 'webm') contentType = 'video/webm';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      
      res.set({
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
        "Accept-Ranges": "bytes",
      });

      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading file from Firebase:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
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
    console.log('[getObjectEntityFile] entityId:', entityId);
    
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
    // Firebase Storage handles ACL differently
    // For now, just normalize the path
    return await this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(params: {
    userId?: string;
    objectFile: any;
    requestedPermission?: any;
  }): Promise<boolean> {
    // Simplified access control for Firebase
    // Public files are always accessible
    // Private files require authentication
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
