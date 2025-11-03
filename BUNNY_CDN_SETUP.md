# Bunny CDN セットアップガイド 🐰

Only-U プラットフォームでBunny CDNを使用した動画・画像配信を設定する完全ガイドです。

## 📋 目次

1. [なぜBunny CDNなのか？](#なぜbunny-cdnなのか)
2. [アカウント作成](#アカウント作成)
3. [Storage Zone設定](#storage-zone設定)
4. [Stream Library設定（動画用）](#stream-library設定動画用)
5. [環境変数の設定](#環境変数の設定)
6. [既存データの移行](#既存データの移行)
7. [動作確認](#動作確認)
8. [料金シミュレーション](#料金シミュレーション)

---

## なぜBunny CDNなのか？

### ✅ メリット

| 項目 | Bunny CDN | Firebase Storage | Replit Object Storage |
|------|-----------|------------------|----------------------|
| **アダルトコンテンツ** | ✅ 明示的に許可 | ❌ グレーゾーン | ❌ 開発用のみ |
| **料金** | 💰 $0.01-0.05/GB | 💰💰 $0.026/GB | 💰💰💰 高額 |
| **CDN配信** | ✅ 114+拠点 | ⚠️ 限定的 | ❌ なし |
| **動画最適化** | ✅ 自動エンコード | ❌ なし | ❌ なし |
| **サムネイル** | ✅ 自動生成 | ❌ なし | ❌ なし |
| **スマホ速度** | ⚡ 高速 | 🐌 遅い | 🐌 遅い |
| **認証問題** | ✅ なし | ❌ キー無効化リスク | ❌ あり |

### 💡 推奨理由

1. **アダルトコンテンツ明示的許可** - EU法に準拠した安全な運用
2. **圧倒的に安い** - Firebase Storageの1/3以下のコスト
3. **グローバルCDN** - 114拠点で世界中から高速アクセス
4. **自動サムネイル生成** - 動画アップロード時に自動生成
5. **キー問題なし** - 安定した認証システム

---

## アカウント作成

### Step 1: Bunny.net にサインアップ

1. [Bunny.net](https://bunny.net/?ref=mz08xtscz9) にアクセス
2. 「Sign Up」をクリック
3. メールアドレスとパスワードを入力
4. メール認証を完了

### Step 2: 支払い方法を設定

1. ダッシュボード → 「Billing」
2. クレジットカードまたはPayPalを登録
3. 初回$10チャージ（推奨）

> **注意**: 従量課金制のため、使った分だけ請求されます。最低料金はありません。

---

## Storage Zone設定

### Step 1: Storage Zone を作成

1. ダッシュボード → 「Storage」 → 「Add Storage Zone」
2. 以下の設定を入力：
   - **Zone Name**: `only-u-storage`（任意の名前）
   - **Storage Region**: `Asia - Singapore` または `Asia - Tokyo`（日本ユーザー向け）
   - **Replication**: なし（コスト削減）

3. 「Create Storage Zone」をクリック

### Step 2: API Key を取得

1. 作成したStorage Zoneをクリック
2. 「FTP & API Access」タブに移動
3. **Password (API Key)** をコピー
   ```
   例: abcd1234-5678-90ef-ghij-klmnopqrstuv
   ```

### Step 3: CDN Hostname を確認

1. 「CDN」タブに移動
2. **Pull Zone Hostname** を確認
   ```
   例: only-u-storage.b-cdn.net
   ```

---

## Stream Library設定（動画用）

動画の自動エンコードとサムネイル生成を使用する場合のみ必要です。

### Step 1: Stream Library を作成

1. ダッシュボード → 「Stream」 → 「Create Library」
2. 以下の設定：
   - **Library Name**: `only-u-videos`
   - **Storage Region**: Storage Zoneと同じリージョン
   - **Transcoding Regions**: `Asia` を選択

3. 「Create Library」をクリック

### Step 2: Stream API Key を取得

1. 作成したLibraryをクリック
2. 「API」タブに移動
3. **API Key** をコピー
   ```
   例: zyxw9876-5432-10ab-cdef-ghijklmnopqr
   ```

### Step 3: Library ID を確認

1. 「Settings」タブで **Library ID** を確認
   ```
   例: 123456
   ```

---

## 環境変数の設定

### Replit環境（開発環境）

1. Replitダッシュボードで「Secrets」タブを開く
2. 以下の環境変数を追加：

```bash
# 必須: Storage Zone設定
BUNNY_STORAGE_API_KEY=abcd1234-5678-90ef-ghij-klmnopqrstuv
BUNNY_STORAGE_ZONE_NAME=only-u-storage
BUNNY_CDN_HOSTNAME=only-u-storage.b-cdn.net
BUNNY_STORAGE_REGION=sg

# オプション: Stream Library設定（動画サムネイル自動生成用）
BUNNY_STREAM_API_KEY=zyxw9876-5432-10ab-cdef-ghijklmnopqr
BUNNY_STREAM_LIBRARY_ID=123456
BUNNY_STREAM_CDN_HOSTNAME=vz-123456.b-cdn.net
```

### Hostinger環境（本番環境）

1. hPanel → 「Advanced」 → 「Environment Variables」
2. 上記の環境変数を追加

### .env.local（ローカル開発）

```bash
# .env.local
BUNNY_STORAGE_API_KEY=your-api-key-here
BUNNY_STORAGE_ZONE_NAME=only-u-storage
BUNNY_CDN_HOSTNAME=only-u-storage.b-cdn.net
BUNNY_STORAGE_REGION=sg

# オプション: 動画エンコード用
BUNNY_STREAM_API_KEY=your-stream-api-key
BUNNY_STREAM_LIBRARY_ID=123456

# 移行スクリプト用（Replit Object Storageからの移行時のみ必要）
REPLIT_OBJECT_STORAGE_BASE_URL=https://your-app.repl.co
```

> **セキュリティ注意**: `.env.local` は `.gitignore` に追加済みです。絶対にGitにコミットしないでください。

---

## 既存データの移行

### 移行前の準備

1. **必須環境変数の設定**

```bash
# Bunny CDN設定（必須）
BUNNY_STORAGE_API_KEY=your-api-key
BUNNY_STORAGE_ZONE_NAME=only-u-storage
BUNNY_CDN_HOSTNAME=only-u-storage.b-cdn.net

# Firebase設定（必須）
FIREBASE_STORAGE_BUCKET=your-bucket-name

# Replit Object Storage移行用（該当する場合のみ）
REPLIT_OBJECT_STORAGE_BASE_URL=https://your-app.repl.co
```

> **重要**: `REPLIT_OBJECT_STORAGE_BASE_URL` は、Replit Object Storageに保存されているファイルがある場合にのみ必要です。このURLは、Replitアプリケーションの公開URLまたは本番環境のURLを設定してください。

2. **移行前の確認**

```bash
# 現在の投稿数を確認
tsx scripts/migrate-to-bunny-cdn.ts
```

### ドライラン（確認のみ）

```bash
tsx scripts/migrate-to-bunny-cdn.ts
```

このコマンドは：
- 移行対象のファイルをリスト表示
- 実際の変更は行いません
- エラーチェックのみ

### 本番移行の実行

```bash
tsx scripts/migrate-to-bunny-cdn.ts --run
```

このコマンドは：
1. Firebase StorageまたはReplit Object Storageからファイルをダウンロード
2. Bunny CDNにアップロード
3. Firestoreの投稿データを更新（URLをBunny CDNに変更）

### 移行の進捗確認

移行中は以下のログが表示されます：

```
🐰 Bunny CDN 移行スクリプト
==================================================

✅ Firebase初期化完了
📦 Bunny CDN Zone: only-u-storage

📊 投稿数: 150件

📄 Post ID: abc123 (3ファイル)
📥 Downloading: public/image1.jpg
📤 Uploading to Bunny CDN: migrated/image1.jpg
✅ Migrated: image1.jpg → https://only-u-storage.b-cdn.net/migrated/image1.jpg
...

==================================================
📊 移行結果
==================================================
合計投稿数: 150
成功: 148
失敗: 2
スキップ: 0
```

### 移行後の確認

1. Bunnyダッシュボードでファイルが表示されるか確認
2. アプリケーションで画像・動画が正常に表示されるか確認
3. サムネイルが生成されているか確認

---

## 動作確認

### 1. アップロードテスト

1. クリエイターとしてログイン
2. 新しい投稿を作成
3. 画像または動画をアップロード
4. コンソールログで確認：

```
✅ Bunny CDN: Uploaded public/1234567890-test.jpg
📹 Uploading video to Bunny Stream for encoding...
✅ Video thumbnail: https://vz-123456.b-cdn.net/abc123/thumbnail.jpg
```

### 2. CDN配信テスト

```bash
# CDN URLにアクセスしてファイルが表示されるか確認
curl -I https://only-u-storage.b-cdn.net/migrated/test.jpg
```

期待される応答：
```
HTTP/2 200
content-type: image/jpeg
cache-control: public, max-age=31536000
```

### 3. サムネイル確認

動画投稿のサムネイルが自動生成されているか確認：

```
https://vz-123456.b-cdn.net/{videoGuid}/thumbnail.jpg
```

---

## 料金シミュレーション

### 小規模サイト（月間10GBストレージ、50GB配信）

```
ストレージ: 10GB × $0.02 = $0.20
配信: 50GB × $0.05 = $2.50
合計: $2.70/月
```

### 中規模サイト（月間100GBストレージ、500GB配信）

```
ストレージ: 100GB × $0.02 = $2.00
配信: 500GB × $0.05 = $25.00
合計: $27.00/月
```

### 大規模サイト（月間1TBストレージ、5TB配信）

```
ストレージ: 1,000GB × $0.02 = $20.00
配信: 5,000GB × $0.05 = $250.00
合計: $270.00/月
```

### Firebase Storage比較

同じ中規模サイトの場合：

```
Firebase Storage: 500GB配信 × $0.12 = $60/月
Bunny CDN: 500GB配信 × $0.05 = $25/月

節約額: $35/月 (58%削減)
```

---

## トラブルシューティング

### Q: アップロードが失敗する

**A**: 環境変数が正しく設定されているか確認してください。

```bash
# サーバーログで確認
📦 Using storage provider: bunny
```

`firebase` と表示される場合は環境変数が設定されていません。

### Q: サムネイルが表示されない

**A**: Bunny Stream APIキーとLibrary IDが設定されているか確認してください。

```bash
# コンソールログ
⚠️  Bunny Stream not configured for thumbnail generation
```

### Q: 動画が再生できない

**A**: Bunny Stream のエンコードが完了するまで最大30秒かかります。しばらく待ってから再度お試しください。

### Q: 移行スクリプトがエラーになる

**A**: Firebase Admin SDKの認証情報が正しいか確認してください。

```bash
# firebase-admin-key.json が存在するか確認
ls firebase-admin-key.json
```

---

## サポート

問題が解決しない場合：

1. [Bunny CDN ドキュメント](https://docs.bunny.net/)
2. [Bunny CDN サポート](https://support.bunny.net/)（24/7対応）
3. GitHub Issues（このプロジェクト）

---

## まとめ

✅ Bunny CDNの設定完了
✅ 環境変数の設定完了
✅ 既存データの移行完了
✅ 動作確認完了

これで、安定した高速CDN配信が利用可能になりました！

**次のステップ**: Hostingerへのデプロイ時も同じ環境変数を設定してください。
