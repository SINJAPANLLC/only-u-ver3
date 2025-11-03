/**
 * Bunny Stream API統合
 * 動画エンコード、サムネイル生成、HLS配信
 */

export interface BunnyStreamVideo {
  guid: string;
  videoLibraryId: number;
  title: string;
  thumbnailUrl: string;
  status: number;
  width: number;
  height: number;
  length: number;
  availableResolutions: string;
}

export interface BunnyStreamUploadResponse {
  success: boolean;
  message: string;
  guid?: string;
}

export class BunnyStreamClient {
  private apiKey: string;
  private libraryId: string;
  private cdnHostname: string;

  constructor() {
    this.apiKey = process.env.BUNNY_STREAM_API_KEY || '';
    this.libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || '';
    this.cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME || '';

    if (!this.apiKey || !this.libraryId) {
      console.warn('⚠️  Bunny Stream not configured. Set BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID');
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.libraryId);
  }

  /**
   * 動画をBunny Streamにアップロード
   */
  async uploadVideo(videoBuffer: Buffer, title: string): Promise<BunnyStreamVideo | null> {
    if (!this.isConfigured()) {
      console.warn('Bunny Stream not configured, skipping video upload');
      return null;
    }

    try {
      const createResponse = await fetch(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos`,
        {
          method: 'POST',
          headers: {
            'AccessKey': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Failed to create video: ${createResponse.status}`);
      }

      const videoData = await createResponse.json() as BunnyStreamVideo;
      const videoGuid = videoData.guid;

      const uploadResponse = await fetch(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoGuid}`,
        {
          method: 'PUT',
          headers: {
            'AccessKey': this.apiKey,
            'Content-Type': 'application/octet-stream',
          },
          body: videoBuffer,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload video: ${uploadResponse.status}`);
      }

      console.log(`✅ Bunny Stream: Video uploaded - ${videoGuid}`);

      const pollInterval = 2000;
      const maxAttempts = 30;
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const statusResponse = await fetch(
          `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoGuid}`,
          {
            headers: { 'AccessKey': this.apiKey },
          }
        );

        if (statusResponse.ok) {
          const updatedVideo = await statusResponse.json() as BunnyStreamVideo;
          
          if (updatedVideo.status === 4) {
            console.log(`✅ Bunny Stream: Video ready - ${videoGuid}`);
            return updatedVideo;
          }
        }

        attempts++;
      }

      console.log(`⏱️  Bunny Stream: Video still processing - ${videoGuid}`);
      return videoData;
    } catch (error) {
      console.error('Bunny Stream upload error:', error);
      return null;
    }
  }

  /**
   * 動画情報を取得
   */
  async getVideo(videoGuid: string): Promise<BunnyStreamVideo | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoGuid}`,
        {
          headers: { 'AccessKey': this.apiKey },
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json() as BunnyStreamVideo;
    } catch (error) {
      console.error('Failed to get video:', error);
      return null;
    }
  }

  /**
   * サムネイルURLを取得
   */
  getThumbnailUrl(videoGuid: string, width: number = 320, height: number = 180): string {
    if (!this.cdnHostname) {
      return `https://vz-${this.libraryId}.b-cdn.net/${videoGuid}/thumbnail.jpg`;
    }
    return `https://${this.cdnHostname}/${videoGuid}/thumbnail_${width}x${height}.jpg`;
  }

  /**
   * HLSプレイリストURLを取得
   */
  getPlaylistUrl(videoGuid: string): string {
    if (!this.cdnHostname) {
      return `https://vz-${this.libraryId}.b-cdn.net/${videoGuid}/playlist.m3u8`;
    }
    return `https://${this.cdnHostname}/${videoGuid}/playlist.m3u8`;
  }

  /**
   * サブスクリプションレベルに応じた画質のHLSプレイリストURLを取得
   * @param videoGuid - 動画GUID
   * @param subscriptionLevel - サブスクリプションレベル ('free', 'basic', 'premium', 'vip', 'high')
   * @returns 適切な画質のプレイリストURL
   */
  getQualityRestrictedUrl(videoGuid: string, subscriptionLevel?: string | null): string {
    const baseUrl = this.cdnHostname 
      ? `https://${this.cdnHostname}/${videoGuid}/playlist`
      : `https://vz-${this.libraryId}.b-cdn.net/${videoGuid}/playlist`;

    // サブスクリプションレベルに応じた画質
    // free/basic: 720p, premium: 1080p, vip/high: 最高画質(4K/2160p)
    switch (subscriptionLevel?.toLowerCase()) {
      case 'vip':
      case 'high':
        // 最高画質 - 制限なし（全解像度を含む標準プレイリスト）
        return `${baseUrl}.m3u8`;
      
      case 'premium':
        // 1080pまで
        return `${baseUrl}_1080p.m3u8`;
      
      case 'basic':
      case 'free':
      default:
        // 720pまで（無料ユーザー）
        return `${baseUrl}_720p.m3u8`;
    }
  }

  /**
   * 動画を削除
   */
  async deleteVideo(videoGuid: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoGuid}`,
        {
          method: 'DELETE',
          headers: { 'AccessKey': this.apiKey },
        }
      );

      return response.ok || response.status === 404;
    } catch (error) {
      console.error('Failed to delete video:', error);
      return false;
    }
  }
}

export const bunnyStreamClient = new BunnyStreamClient();
