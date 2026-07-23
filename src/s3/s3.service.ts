import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  ObjectIdentifier,
  _Object,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import {
  SeaweedFsModuleOptions,
  S3PutOptions,
  S3MultipartOptions,
  S3UploadResult,
  S3ObjectMetadata,
  S3ListResult,
  S3ObjectInfo,
} from '../interfaces';
import {
  SeaweedFsConnectionError,
  SeaweedFsS3Error,
  SeaweedFsUnsupportedOperationError,
} from '../errors';
import { DEFAULT_S3_REGION, DEFAULT_S3_PRESIGN_EXPIRES } from '../constants';

@Injectable()
export class SeaweedFsS3Service implements OnModuleInit {
  private readonly logger = new Logger(SeaweedFsS3Service.name);
  private s3Client!: S3Client;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly forcePathStyle: boolean;
  private readonly defaultBucket?: string;

  constructor(private readonly options: SeaweedFsModuleOptions) {
    this.endpoint = options.s3.endpoint.replace(/\/+$/, '');
    this.accessKeyId = options.s3.accessKeyId;
    this.secretAccessKey = options.s3.secretAccessKey;
    this.region = options.s3.region ?? DEFAULT_S3_REGION;
    this.forcePathStyle = options.s3.forcePathStyle ?? true;
    this.defaultBucket = options.s3.defaultBucket;
  }

  async onModuleInit(): Promise<void> {
    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      maxAttempts: this.options.filer.retries ?? 3,
    });

    if (this.options.validateConnectionOnBoot !== false) {
      await this.validateConnection();
    }
  }

  private async validateConnection(): Promise<void> {
    try {
      const command = new ListBucketsCommand({});
      await this.s3Client.send(command);
      this.logger.log('S3 Gateway connection validated successfully');
    } catch (error) {
      throw new SeaweedFsConnectionError(
        's3',
        `Failed to connect to S3 Gateway at ${this.endpoint}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private resolveBucket(bucket?: string): string {
    const resolved = bucket ?? this.defaultBucket;
    if (!resolved) {
      throw new SeaweedFsS3Error(
        '',
        undefined,
        'No bucket specified and no defaultBucket configured',
      );
    }
    return resolved;
  }

  private wrapS3Error(
    bucket: string,
    key: string | undefined,
    operation: string,
    error: unknown,
  ): SeaweedFsS3Error {
    if (error instanceof SeaweedFsS3Error) return error;
    const err = error instanceof Error ? error : new Error(String(error));
    if (
      err.name === 'NotFound' ||
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
    ) {
      return new SeaweedFsS3Error(bucket, key, `Not found: ${key ?? bucket}`, err);
    }
    return new SeaweedFsS3Error(bucket, key, `${operation} failed: ${err.message}`, err);
  }

  async s3PutObject(
    bucket: string,
    key: string,
    body: Buffer | Readable,
    options?: S3PutOptions,
  ): Promise<S3UploadResult> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new PutObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType ?? 'application/octet-stream',
        Metadata: options?.metadata,
        ACL: options?.acl,
      });
      const result = await this.s3Client.send(command);
      return {
        key,
        bucket: resolvedBucket,
        etag: result.ETag?.replace(/"/g, '') ?? '',
        versionId: result.VersionId,
      };
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'PutObject', error);
    }
  }

  async s3PutObjectMultipart(
    bucket: string,
    key: string,
    body: Readable,
    options?: S3MultipartOptions,
  ): Promise<S3UploadResult> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: resolvedBucket,
          Key: key,
          Body: body,
          ContentType: options?.contentType ?? 'application/octet-stream',
          Metadata: options?.metadata,
        },
        partSize: options?.partSize ?? 10 * 1024 * 1024,
        queueSize: options?.concurrency ?? 4,
      });

      if (options?.onProgress) {
        upload.on('httpUploadProgress', (progress: { loaded?: number; total?: number }) => {
          const loaded = progress.loaded ?? 0;
          const total = progress.total ?? 0;
          options.onProgress!({
            loaded,
            total,
            percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
          });
        });
      }

      const result = await upload.done();
      return {
        key,
        bucket: resolvedBucket,
        etag: (result.ETag ?? '').replace(/"/g, ''),
        versionId: result.VersionId,
        location: result.Location,
      };
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'PutObjectMultipart', error);
    }
  }

  async s3GetObject(bucket: string, key: string): Promise<Readable> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new GetObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
      });
      const result: GetObjectCommandOutput = await this.s3Client.send(command);
      if (!result.Body) {
        throw new SeaweedFsS3Error(resolvedBucket, key, 'Response body is empty');
      }
      return result.Body as Readable;
    } catch (error) {
      if (error instanceof SeaweedFsS3Error) throw error;
      throw this.wrapS3Error(resolvedBucket, key, 'GetObject', error);
    }
  }

  async s3GetObjectAsBuffer(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.s3GetObject(bucket, key);
    return this.streamToBuffer(stream);
  }

  async s3DeleteObject(bucket: string, key: string): Promise<void> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new DeleteObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'DeleteObject', error);
    }
  }

  async s3DeleteObjects(
    bucket: string,
    keys: string[],
  ): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }> {
    const resolvedBucket = this.resolveBucket(bucket);
    if (keys.length === 0) return { deleted: [], errors: [] };

    try {
      const objects: ObjectIdentifier[] = keys.map((k) => ({ Key: k }));
      const command = new DeleteObjectsCommand({
        Bucket: resolvedBucket,
        Delete: { Objects: objects },
      });
      const result = await this.s3Client.send(command);
      const deleted = (result.Deleted ?? []).map((d) => d.Key ?? '').filter(Boolean);
      const errors = (result.Errors ?? []).map((e) => ({
        key: e.Key ?? '',
        error: e.Message ?? 'Unknown error',
      }));
      return { deleted, errors };
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, undefined, 'DeleteObjects', error);
    }
  }

  async s3HeadObject(bucket: string, key: string): Promise<S3ObjectMetadata> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new HeadObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
      });
      const result = await this.s3Client.send(command);
      return {
        key,
        bucket: resolvedBucket,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
        lastModified: result.LastModified ?? new Date(),
        etag: (result.ETag ?? '').replace(/"/g, ''),
        metadata: result.Metadata,
      };
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'HeadObject', error);
    }
  }

  async s3ListObjects(
    bucket: string,
    options?: { prefix?: string; maxKeys?: number; continuationToken?: string },
  ): Promise<S3ListResult> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new ListObjectsV2Command({
        Bucket: resolvedBucket,
        Prefix: options?.prefix,
        MaxKeys: options?.maxKeys ?? 1000,
        ContinuationToken: options?.continuationToken,
      });
      const result = await this.s3Client.send(command);

      const contents: S3ObjectInfo[] = (result.Contents ?? []).map((obj: _Object) => ({
        key: obj.Key ?? '',
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
        etag: (obj.ETag ?? '').replace(/"/g, ''),
        storageClass: obj.StorageClass,
      }));

      const commonPrefixes = (result.CommonPrefixes ?? []).map((cp) => cp.Prefix ?? '');

      return {
        contents,
        commonPrefixes,
        isTruncated: result.IsTruncated ?? false,
        continuationToken: options?.continuationToken,
        nextContinuationToken: result.NextContinuationToken,
        maxKeys: options?.maxKeys ?? 1000,
      };
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, undefined, 'ListObjects', error);
    }
  }

  async s3CopyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    const resolvedSourceBucket = this.resolveBucket(sourceBucket);
    const resolvedDestBucket = this.resolveBucket(destBucket);
    try {
      const command = new CopyObjectCommand({
        Bucket: resolvedDestBucket,
        Key: destKey,
        CopySource: `${resolvedSourceBucket}/${sourceKey}`,
      });
      await this.s3Client.send(command);
    } catch (error) {
      throw this.wrapS3Error(resolvedDestBucket, destKey, 'CopyObject', error);
    }
  }

  async s3CreateBucket(bucket: string): Promise<void> {
    try {
      const command = new CreateBucketCommand({ Bucket: bucket });
      await this.s3Client.send(command);
    } catch (error) {
      throw this.wrapS3Error(bucket, undefined, 'CreateBucket', error);
    }
  }

  async s3DeleteBucket(bucket: string): Promise<void> {
    try {
      const command = new DeleteBucketCommand({ Bucket: bucket });
      await this.s3Client.send(command);
    } catch (error) {
      throw this.wrapS3Error(bucket, undefined, 'DeleteBucket', error);
    }
  }

  async s3BucketExists(bucket: string): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({ Bucket: bucket });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async s3ListBuckets(): Promise<string[]> {
    try {
      const command = new ListBucketsCommand({});
      const result = await this.s3Client.send(command);
      return (result.Buckets ?? []).map((b) => b.Name ?? '').filter(Boolean);
    } catch (error) {
      throw this.wrapS3Error('', undefined, 'ListBuckets', error);
    }
  }

  async s3GetPresignedUploadUrl(
    bucket: string,
    key: string,
    options?: { expiresIn?: number; contentType?: string },
  ): Promise<string> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new PutObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
        ContentType: options?.contentType,
      });
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: options?.expiresIn ?? DEFAULT_S3_PRESIGN_EXPIRES,
      });
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'GetPresignedUploadUrl', error);
    }
  }

  async s3GetPresignedDownloadUrl(
    bucket: string,
    key: string,
    options?: { expiresIn?: number },
  ): Promise<string> {
    const resolvedBucket = this.resolveBucket(bucket);
    try {
      const command = new GetObjectCommand({
        Bucket: resolvedBucket,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: options?.expiresIn ?? DEFAULT_S3_PRESIGN_EXPIRES,
      });
    } catch (error) {
      throw this.wrapS3Error(resolvedBucket, key, 'GetPresignedDownloadUrl', error);
    }
  }

  async s3SetBucketPolicy(_bucket: string, _policy: object): Promise<void> {
    throw new SeaweedFsUnsupportedOperationError(
      's3SetBucketPolicy',
      'SeaweedFS S3 Gateway does not support bucket policy management via the S3 API. ' +
        'Configure bucket policies through SeaweedFS filer or master server directly.',
    );
  }

  getRawS3Client(): S3Client {
    return this.s3Client;
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
