import { Controller, Post, Get, Delete, Param, Body, UploadedFile, UseInterceptors, HttpException, HttpStatus, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Readable } from 'stream';
import { SeaweedFsService } from 'nestjs-seaweedfs';
import { S3ProgressEvent } from 'nestjs-seaweedfs';

@Controller('s3')
export class S3Controller {
  constructor(private readonly seaweed: SeaweedFsService) {}

  @Post('upload/:key')
  @UseInterceptors(FileInterceptor('file'))
  async uploadObject(
    @UploadedFile() file: Express.Multer.File,
    @Param('key') key: string,
    @Body('bucket') bucket?: string,
  ) {
    try {
      const result = await this.seaweed.s3PutObject(bucket || 'test-bucket', key, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });
      return { success: true, ...result };
    } catch (error) {
      throw new HttpException(
        `S3 upload failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-multipart/:key')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMultipart(
    @UploadedFile() file: Express.Multer.File,
    @Param('key') key: string,
    @Body('bucket') bucket?: string,
    @Body('partSize') partSize?: string,
    @Body('concurrency') concurrency?: string,
  ) {
    try {
      const stream = Readable.from(file.buffer);
      let progressLog: S3ProgressEvent[] = [];

      const result = await this.seaweed.s3PutObjectMultipart(bucket || 'test-bucket', key, stream, {
        contentType: file.mimetype,
        partSize: partSize ? parseInt(partSize, 10) * 1024 * 1024 : 10 * 1024 * 1024,
        concurrency: concurrency ? parseInt(concurrency, 10) : 4,
        onProgress: (event: S3ProgressEvent) => {
          progressLog.push(event);
          console.log(`Multipart upload progress: ${event.percentage}% (${event.loaded}/${event.total})`);
        },
      });
      return {
        success: true,
        ...result,
        progressUpdates: progressLog,
      };
    } catch (error) {
      throw new HttpException(
        `S3 multipart upload failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download/:key')
  async downloadObject(
    @Param('key') key: string,
    @Res() res: Response,
    @Body('bucket') bucket?: string,
  ) {
    try {
      const stream = await this.seaweed.s3GetObject(bucket || 'test-bucket', key);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
      stream.pipe(res);
    } catch (error) {
      if (error instanceof Error && error.name === 'SeaweedFsNotFoundError') {
        throw new HttpException('Object not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `S3 download failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('list/:bucket')
  async listObjects(
    @Param('bucket') bucket: string,
    @Body('prefix') prefix?: string,
    @Body('maxKeys') maxKeys?: string,
    @Body('continuationToken') continuationToken?: string,
  ) {
    try {
      const result = await this.seaweed.s3ListObjects(bucket, {
        prefix,
        maxKeys: maxKeys ? parseInt(maxKeys, 10) : undefined,
        continuationToken,
      });
      return { success: true, ...result };
    } catch (error) {
      throw new HttpException(
        `S3 list failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('delete/:bucket/:key(*)')
  async deleteObject(@Param('bucket') bucket: string, @Param('key') key: string) {
    try {
      await this.seaweed.s3DeleteObject(bucket, key);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `S3 delete failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('batch-delete/:bucket')
  async batchDeleteObjects(
    @Param('bucket') bucket: string,
    @Body('keys') keys: string[],
  ) {
    try {
      const result = await this.seaweed.s3DeleteObjects(bucket, keys);
      return { success: true, ...result };
    } catch (error) {
      throw new HttpException(
        `S3 batch delete failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('head/:bucket/:key(*)')
  async headObject(@Param('bucket') bucket: string, @Param('key') key: string) {
    try {
      const metadata = await this.seaweed.s3HeadObject(bucket, key);
      return { success: true, ...metadata };
    } catch (error) {
      throw new HttpException(
        `S3 head failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-bucket/:bucket')
  async createBucket(@Param('bucket') bucket: string) {
    try {
      await this.seaweed.s3CreateBucket(bucket);
      return { success: true, bucket };
    } catch (error) {
      throw new HttpException(
        `S3 create bucket failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('buckets')
  async listBuckets() {
    try {
      const buckets = await this.seaweed.s3ListBuckets();
      return { success: true, buckets };
    } catch (error) {
      throw new HttpException(
        `S3 list buckets failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
