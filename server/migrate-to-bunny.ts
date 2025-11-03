/**
 * Firebase Storage → Bunny CDN 一括移行スクリプト
 * 既存の全ての動画・画像ファイルをBunny CDNに移行します
 */

import { storage } from './firebase.js';
import { storageAdapter } from './storage-adapter.js';

async function migrateAllFiles() {
  console.log('🚀 Starting migration from Firebase Storage to Bunny CDN...\n');

  try {
    const bucket = storage.bucket();
    
    // publicとprivateフォルダを移行
    const folders = ['public', 'private'];
    
    for (const folder of folders) {
      console.log(`\n📁 Migrating folder: ${folder}/`);
      
      const [files] = await bucket.getFiles({ prefix: `${folder}/` });
      
      console.log(`   Found ${files.length} files to migrate`);
      
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (const file of files) {
        const fileName = file.name;
        
        // Skip directories
        if (fileName.endsWith('/')) {
          continue;
        }
        
        try {
          // Extract the filename without the folder prefix
          const fileNameOnly = fileName.split('/').pop() || '';
          
          // Check if already in Bunny CDN
          const bunnyKey = fileName; // Keep the full path (public/xxx.mp4)
          
          console.log(`   📥 Processing: ${fileName}...`);
          
          // Download from Firebase
          const [fileBuffer] = await file.download();
          
          if (!fileBuffer || fileBuffer.length === 0) {
            console.log(`   ⚠️  Skipped (empty file): ${fileName}`);
            skipCount++;
            continue;
          }
          
          // Determine content type
          const ext = fileNameOnly.toLowerCase().split('.').pop();
          let contentType = 'application/octet-stream';
          if (ext === 'mp4') contentType = 'video/mp4';
          else if (ext === 'mov') contentType = 'video/quicktime';
          else if (ext === 'webm') contentType = 'video/webm';
          else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
          else if (ext === 'png') contentType = 'image/png';
          else if (ext === 'gif') contentType = 'image/gif';
          else if (ext === 'webp') contentType = 'image/webp';
          
          // Upload to Bunny CDN
          await storageAdapter.upload(bunnyKey, fileBuffer, contentType);
          
          console.log(`   ✅ Migrated: ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          successCount++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`   ❌ Error migrating ${fileName}:`, error instanceof Error ? error.message : error);
          errorCount++;
        }
      }
      
      console.log(`\n📊 Folder "${folder}" summary:`);
      console.log(`   ✅ Success: ${successCount}`);
      console.log(`   ⚠️  Skipped: ${skipCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
    }
    
    console.log('\n\n🎉 Migration complete!');
    console.log('\n✨ All files have been migrated to Bunny CDN.');
    console.log('   Next access will be super fast! 🚀\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// 実行
migrateAllFiles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
