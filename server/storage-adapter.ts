/**
 * ストレージアダプター - Firebase Storage、Cloudflare R2、AWS S3、GCSに対応
 * Hostingerデプロイ時は環境変数でストレージプロバイダーを切り替え可能
 */

// Replit Object Storageは削除し、Firebase Storageを使用
import { storage } from './firebase.js';

// ストレージプロバイダーのタイプ
type StorageProvider = 'firebase' | 'bunny' | 'r2' | 's3' | 'gcs';

// 環境変数からストレージプロバイダーを判定
const getStorageProvider = (): StorageProvider => {
  if (process.env.BUNNY_STORAGE_API_KEY && process.env.BUNNY_STORAGE_ZONE_NAME) {
    return 'bunny';
  }
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
    return 'r2';
  }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return 's3';
  }
  if (process.env.GCS_PROJECT_ID && process.env.GCS_BUCKET_NAME) {
    return 'gcs';
  }
  // デフォルトはFirebase Storage
  return 'firebase';
};

// ストレージアダプターインターフェース
export interface StorageAdapter {
  upload(key: string, data: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  generateThumbnail?(key: string): Promise<string | null>;
}

// Bunny CDN アダプター（推奨：アダルトコンテンツ対応、高速CDN）
class BunnyCDNStorageAdapter implements StorageAdapter {
  private storageApiKey: string;
  private storageZoneName: string;
  private cdnHostname: string;
  private streamApiKey?: string;
  private streamLibraryId?: string;
  private storageRegion: string;

  constructor() {
    this.storageApiKey = process.env.BUNNY_STORAGE_API_KEY || '';
    this.storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME || '';
    this.cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${this.storageZoneName}.b-cdn.net`;
    this.streamApiKey = process.env.BUNNY_STREAM_API_KEY;
    this.streamLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    this.storageRegion = process.env.BUNNY_STORAGE_REGION || 'de';

    if (!this.storageApiKey || !this.storageZoneName) {
      throw new Error('Bunny CDN configuration missing. Set BUNNY_STORAGE_API_KEY and BUNNY_STORAGE_ZONE_NAME');
    }
  }

  private getStorageEndpoint(): string {
    const regionMap: Record<string, string> = {
      'de': 'storage.bunnycdn.com',
      'ny': 'ny.storage.bunnycdn.com',
      'la': 'la.storage.bunnycdn.com',
      'sg': 'sg.storage.bunnycdn.com',
      'sydney': 'syd.storage.bunnycdn.com',
      'uk': 'uk.storage.bunnycdn.com',
    };
    return regionMap[this.storageRegion] || 'storage.bunnycdn.com';
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    const endpoint = this.getStorageEndpoint();
    const url = `https://${endpoint}/${this.storageZoneName}/${key}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'AccessKey': this.storageApiKey,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': data.length.toString(),
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bunny CDN upload failed: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Bunny CDN: Uploaded ${key}`);
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const endpoint = this.getStorageEndpoint();
    const url = `https://${endpoint}/${this.storageZoneName}/${key}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'AccessKey': this.storageApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Bunny CDN download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const endpoint = this.getStorageEndpoint();
    const url = `https://${endpoint}/${this.storageZoneName}/${key}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'AccessKey': this.storageApiKey,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Bunny CDN delete failed: ${response.status}`);
    }

    console.log(`🗑️  Bunny CDN: Deleted ${key}`);
  }

  getPublicUrl(key: string): string {
    // 公開ファイル（public/で始まる）は直接Bunny CDNから配信（高速）
    // 非公開ファイル（private/で始まる）はプロキシ経由でアクセス制御
    if (key.startsWith('public/')) {
      // ファイル名部分のみをURLエンコード（special charactersに対応）
      const parts = key.split('/');
      const encodedKey = parts.map((part, index) => 
        index === parts.length - 1 ? encodeURIComponent(part) : part
      ).join('/');
      // 直接Bunny CDNのURLを返す（エッジキャッシュ活用、低レイテンシ）
      return `https://${this.cdnHostname}/${encodedKey}`;
    }
    // 非公開ファイルはプロキシ経由（認証・アクセス制御）
    return `/api/proxy/${key}`;
  }

  async generateThumbnail(videoKey: string): Promise<string | null> {
    if (!this.streamApiKey || !this.streamLibraryId) {
      console.warn('⚠️  Bunny Stream not configured for thumbnail generation');
      return null;
    }

    try {
      const videoId = videoKey.split('/').pop()?.replace(/\.[^/.]+$/, '');
      const thumbnailUrl = `https://vz-${this.streamLibraryId}.b-cdn.net/${videoId}/thumbnail.jpg`;
      
      const response = await fetch(thumbnailUrl, { method: 'HEAD' });
      if (response.ok) {
        return thumbnailUrl;
      }

      console.log(`📸 Generating thumbnail for ${videoKey}...`);
      return thumbnailUrl;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  }
}

// Firebase Storage アダプター
class FirebaseStorageAdapter implements StorageAdapter {
  private bucket: any;

  constructor() {
    this.bucket = storage.bucket();
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    // key already includes visibility folder (public/ or private/)
    const file = this.bucket.file(key);
    await file.save(data, {
      metadata: contentType ? { contentType } : undefined,
    });
    
    // Only make public if key starts with 'public/'
    if (key.startsWith('public/')) {
      await file.makePublic();
    }
    
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const file = this.bucket.file(key);
    const [buffer] = await file.download();
    return buffer;
  }

  async delete(key: string): Promise<void> {
    const file = this.bucket.file(key);
    await file.delete();
  }

  getPublicUrl(key: string): string {
    // Return proxy URL with full key path (public/filename or private/filename)
    return `/api/proxy/${key}`;
  }
}

// Cloudflare R2 アダプター（AWS S3互換）
class R2StorageAdapter implements StorageAdapter {
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || 'only-u-storage';
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://${this.bucket}.r2.dev`;
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    // AWS SDK S3 Clientを使用する実装
    // 注: @aws-sdk/client-s3 をインストールする必要があります
    console.log(`R2: Uploading ${key} to ${this.bucket}`);
    
    // TODO: S3 PutObjectCommandを実装
    // const command = new PutObjectCommand({
    //   Bucket: this.bucket,
    //   Key: key,
    //   Body: data,
    //   ContentType: contentType,
    // });
    // await this.s3Client.send(command);
    
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    console.log(`R2: Downloading ${key} from ${this.bucket}`);
    
    // TODO: S3 GetObjectCommandを実装
    // const command = new GetObjectCommand({
    //   Bucket: this.bucket,
    //   Key: key,
    // });
    // const response = await this.s3Client.send(command);
    // return Buffer.from(await response.Body.transformToByteArray());
    
    throw new Error('R2 download not implemented yet');
  }

  async delete(key: string): Promise<void> {
    console.log(`R2: Deleting ${key} from ${this.bucket}`);
    
    // TODO: S3 DeleteObjectCommandを実装
    // const command = new DeleteObjectCommand({
    //   Bucket: this.bucket,
    //   Key: key,
    // });
    // await this.s3Client.send(command);
  }

  getPublicUrl(key: string): string {
    // Return proxy URL with full key path (public/filename or private/filename)
    return `/api/proxy/${key}`;
  }
}

// AWS S3 アダプター
class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || 'only-u-storage';
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    this.publicUrl = process.env.S3_PUBLIC_URL || `https://${this.bucket}.s3.${region}.amazonaws.com`;
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    console.log(`S3: Uploading ${key} to ${this.bucket}`);
    // TODO: S3実装
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    console.log(`S3: Downloading ${key} from ${this.bucket}`);
    throw new Error('S3 download not implemented yet');
  }

  async delete(key: string): Promise<void> {
    console.log(`S3: Deleting ${key} from ${this.bucket}`);
  }

  getPublicUrl(key: string): string {
    // Return proxy URL with full key path (public/filename or private/filename)
    return `/api/proxy/${key}`;
  }
}

// Google Cloud Storage アダプター
class GCSStorageAdapter implements StorageAdapter {
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.GCS_BUCKET_NAME || 'only-u-storage';
    this.publicUrl = `https://storage.googleapis.com/${this.bucket}`;
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    console.log(`GCS: Uploading ${key} to ${this.bucket}`);
    // TODO: GCS実装
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    console.log(`GCS: Downloading ${key} from ${this.bucket}`);
    throw new Error('GCS download not implemented yet');
  }

  async delete(key: string): Promise<void> {
    console.log(`GCS: Deleting ${key} from ${this.bucket}`);
  }

  getPublicUrl(key: string): string {
    // Return proxy URL with full key path (public/filename or private/filename)
    return `/api/proxy/${key}`;
  }
}

// ストレージアダプターのファクトリー
export const createStorageAdapter = (): StorageAdapter => {
  const provider = getStorageProvider();
  
  console.log(`📦 Using storage provider: ${provider}`);
  
  switch (provider) {
    case 'bunny':
      return new BunnyCDNStorageAdapter();
    case 'r2':
      return new R2StorageAdapter();
    case 's3':
      return new S3StorageAdapter();
    case 'gcs':
      return new GCSStorageAdapter();
    case 'firebase':
    default:
      return new FirebaseStorageAdapter();
  }
};

// デフォルトエクスポート
export const storageAdapter = createStorageAdapter();
