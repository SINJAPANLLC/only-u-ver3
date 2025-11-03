/**
 * Firebase Storage/Replit Object Storage → Bunny CDN 移行スクリプト
 * 
 * 使用方法:
 * 1. Bunny CDNの環境変数を設定
 * 2. tsx scripts/migrate-to-bunny-cdn.ts
 * 
 * 環境変数:
 * - BUNNY_STORAGE_API_KEY
 * - BUNNY_STORAGE_ZONE_NAME
 * - BUNNY_CDN_HOSTNAME
 * - BUNNY_STREAM_API_KEY (動画用・オプション)
 * - BUNNY_STREAM_LIBRARY_ID (動画用・オプション)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

interface FileMetadata {
  url: string;
  storageUri: string;
  resourceType: 'image' | 'video';
  fileName?: string;
  size?: number;
  type?: string;
  source?: string;
  objectPath?: string;
}

class BunnyMigrator {
  private storageApiKey: string;
  private storageZoneName: string;
  private cdnHostname: string;
  private storageRegion: string;
  private firestore: FirebaseFirestore.Firestore;
  private bucket: any;

  constructor() {
    this.storageApiKey = process.env.BUNNY_STORAGE_API_KEY || '';
    this.storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME || '';
    this.cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${this.storageZoneName}.b-cdn.net`;
    this.storageRegion = process.env.BUNNY_STORAGE_REGION || 'de';

    if (!this.storageApiKey || !this.storageZoneName) {
      throw new Error('Bunny CDN環境変数が設定されていません');
    }

    const serviceAccountPath = path.join(process.cwd(), 'firebase-admin-key.json');
    const serviceAccount = require(serviceAccountPath);

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    this.firestore = getFirestore();
    this.bucket = getStorage().bucket();

    console.log('✅ Firebase初期化完了');
    console.log(`📦 Bunny CDN Zone: ${this.storageZoneName}`);
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

  async uploadToBunny(key: string, data: Buffer, contentType?: string): Promise<string> {
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

    return `https://${this.cdnHostname}/${key}`;
  }

  async downloadFromFirebase(storagePath: string): Promise<Buffer> {
    const file = this.bucket.file(storagePath);
    const [buffer] = await file.download();
    return buffer;
  }

  async downloadFromReplitObjectStorage(objectUrl: string): Promise<Buffer> {
    console.log(`📥 Downloading from Replit Object Storage: ${objectUrl}`);
    
    let fullUrl: string;
    
    if (objectUrl.startsWith('http')) {
      fullUrl = objectUrl;
    } else {
      const baseUrl = process.env.REPLIT_OBJECT_STORAGE_BASE_URL;
      if (!baseUrl) {
        throw new Error(
          'REPLIT_OBJECT_STORAGE_BASE_URL environment variable is required for relative paths. ' +
          'Set it to your Replit app URL (e.g., https://your-app.repl.co) or the production URL.'
        );
      }
      fullUrl = `${baseUrl}${objectUrl.startsWith('/') ? objectUrl : '/' + objectUrl}`;
    }
    
    console.log(`  → Fetching: ${fullUrl}`);
    
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from Replit Object Storage: ${response.status} - ${fullUrl}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async migrateFile(fileMetadata: FileMetadata): Promise<string | null> {
    try {
      let buffer: Buffer;
      let fileName: string;

      // Determine source and download accordingly
      if (fileMetadata.source === 'replit-object-storage') {
        // Replit Object Storage - download from HTTPS URL
        const objectUrl = fileMetadata.url || fileMetadata.objectPath || fileMetadata.storageUri;
        
        if (!objectUrl) {
          console.error(`❌ No URL found for Replit Object Storage file`);
          return null;
        }

        buffer = await this.downloadFromReplitObjectStorage(objectUrl);
        fileName = fileMetadata.fileName || path.basename(objectUrl);
      } else {
        // Firebase Storage - download from gs:// URI
        const storagePath = fileMetadata.storageUri
          .replace('gs://', '')
          .replace(`${process.env.FIREBASE_STORAGE_BUCKET}/`, '');
        
        console.log(`📥 Downloading from Firebase: ${storagePath}`);
        buffer = await this.downloadFromFirebase(storagePath);
        fileName = path.basename(storagePath);
      }

      const bunnyKey = `migrated/${fileName}`;

      console.log(`📤 Uploading to Bunny CDN: ${bunnyKey}`);
      const newUrl = await this.uploadToBunny(bunnyKey, buffer, fileMetadata.type);

      console.log(`✅ Migrated: ${fileName} → ${newUrl}`);
      return newUrl;
    } catch (error) {
      console.error(`❌ Failed to migrate file:`, error);
      return null;
    }
  }

  async migratePosts(dryRun: boolean = true): Promise<MigrationStats> {
    const stats: MigrationStats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
    };

    console.log(dryRun ? '🔍 DRY RUN MODE - 変更は保存されません' : '🚀 MIGRATION MODE - 実際に移行します');
    console.log('');

    const postsSnapshot = await this.firestore.collection('posts').get();
    stats.total = postsSnapshot.size;

    console.log(`📊 投稿数: ${stats.total}件`);
    console.log('');

    for (const doc of postsSnapshot.docs) {
      const postData = doc.data();
      const files = postData.files || [];

      if (files.length === 0) {
        stats.skipped++;
        continue;
      }

      console.log(`\n📄 Post ID: ${doc.id} (${files.length}ファイル)`);

      const migratedFiles: any[] = [];
      let postFailed = false;

      for (const file of files) {
        if (!file.storageUri || file.source !== 'replit-object-storage' && file.source !== 'firebase') {
          console.log(`⏭️  Skipped: ${file.fileName || 'unknown'} (既にBunny CDNまたは他のストレージ)`);
          migratedFiles.push(file);
          continue;
        }

        const newUrl = await this.migrateFile(file);

        if (newUrl) {
          migratedFiles.push({
            ...file,
            url: newUrl,
            secure_url: newUrl,
            objectPath: newUrl,
            source: 'bunny-cdn',
            cdnUrl: newUrl,
          });
        } else {
          postFailed = true;
          migratedFiles.push(file);
        }
      }

      if (!dryRun && migratedFiles.length > 0) {
        await this.firestore.collection('posts').doc(doc.id).update({
          files: migratedFiles,
          updatedAt: new Date(),
        });
        console.log(`💾 Firestore更新完了: ${doc.id}`);
      }

      if (postFailed) {
        stats.failed++;
      } else {
        stats.success++;
      }
    }

    return stats;
  }

  async run(dryRun: boolean = true) {
    console.log('');
    console.log('🐰 Bunny CDN 移行スクリプト');
    console.log('='.repeat(50));
    console.log('');

    const stats = await this.migratePosts(dryRun);

    console.log('');
    console.log('='.repeat(50));
    console.log('📊 移行結果');
    console.log('='.repeat(50));
    console.log(`合計投稿数: ${stats.total}`);
    console.log(`成功: ${stats.success}`);
    console.log(`失敗: ${stats.failed}`);
    console.log(`スキップ: ${stats.skipped}`);
    console.log('');

    if (dryRun) {
      console.log('💡 本番移行を実行するには: tsx scripts/migrate-to-bunny-cdn.ts --run');
    } else {
      console.log('✅ 移行完了！');
    }
  }
}

const dryRun = !process.argv.includes('--run');
const migrator = new BunnyMigrator();
migrator.run(dryRun).catch(console.error);
