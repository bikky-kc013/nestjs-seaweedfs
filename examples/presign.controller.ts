import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Controller('presign')
export class PresignController {
  constructor(private readonly seaweed: SeaweedFsService) {}

  /**
   * Generate a presigned upload URL.
   * Clients can use this URL to upload directly to SeaweedFS without going through the server.
   *
   * POST /presign/upload-url
   * Body: { "bucket": "my-bucket", "key": "uploads/file.txt", "contentType": "text/plain", "expiresIn": 3600 }
   */
  @Post('upload-url')
  async getPresignedUploadUrl(
    @Body('bucket') bucket: string,
    @Body('key') key: string,
    @Body('contentType') contentType?: string,
    @Body('expiresIn') expiresIn?: number,
  ) {
    try {
      if (!bucket || !key) {
        throw new HttpException('bucket and key are required', HttpStatus.BAD_REQUEST);
      }

      const url = await this.seaweed.s3GetPresignedUploadUrl(bucket, key, {
        expiresIn: expiresIn || 3600,
        contentType,
      });

      return {
        success: true,
        uploadUrl: url,
        method: 'PUT',
        headers: contentType ? { 'Content-Type': contentType } : {},
        expiresIn: expiresIn || 3600,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate upload URL: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate a presigned download URL.
   * Clients can use this URL to download directly from SeaweedFS.
   *
   * POST /presign/download-url
   * Body: { "bucket": "my-bucket", "key": "uploads/file.txt", "expiresIn": 3600 }
   */
  @Post('download-url')
  async getPresignedDownloadUrl(
    @Body('bucket') bucket: string,
    @Body('key') key: string,
    @Body('expiresIn') expiresIn?: number,
  ) {
    try {
      if (!bucket || !key) {
        throw new HttpException('bucket and key are required', HttpStatus.BAD_REQUEST);
      }

      const url = await this.seaweed.s3GetPresignedDownloadUrl(bucket, key, {
        expiresIn: expiresIn || 3600,
      });

      return {
        success: true,
        downloadUrl: url,
        expiresIn: expiresIn || 3600,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get presigned URLs for both upload and download.
   *
   * GET /presign/urls/:bucket/:key(*)
   */
  @Get('urls/:bucket/:key(*)')
  async getBothUrls(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
  ) {
    try {
      const [uploadUrl, downloadUrl] = await Promise.all([
        this.seaweed.s3GetPresignedUploadUrl(bucket, key),
        this.seaweed.s3GetPresignedDownloadUrl(bucket, key),
      ]);

      return {
        success: true,
        uploadUrl,
        downloadUrl,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate URLs: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
