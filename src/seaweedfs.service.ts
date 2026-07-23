import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { AxiosInstance } from 'axios';
import { SeaweedFsFilerService } from './filer/filer.service';
import { SeaweedFsS3Service } from './s3/s3.service';
import {
  UploadOptions,
  UploadResult,
  FileMetadata,
  DirectoryListing,
  AssignVolumeResult,
  S3PutOptions,
  S3MultipartOptions,
  S3UploadResult,
  S3ObjectMetadata,
  S3ListResult,
} from './interfaces';

@Injectable()
export class SeaweedFsService {
  private readonly logger = new Logger(SeaweedFsService.name);

  constructor(
    private readonly filerService: SeaweedFsFilerService,
    private readonly s3Service: SeaweedFsS3Service,
  ) {}

  // ─── Filer API Methods ────────────────────────────────────────────

  /**
   * Upload a file via the Filer submit endpoint.
   * @param path - Destination file path in SeaweedFS
   * @param file - Buffer or Readable stream of the file content
   * @param options - Optional upload options (TTL, replication, collection)
   * @returns Upload result with fid, url, and size
   * @throws SeaweedFsUploadError if the upload fails
   */
  async upload(
    path: string,
    file: Buffer | Readable,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    return this.filerService.upload(path, file, options);
  }

  /**
   * Upload multiple files via the Filer API.
   * @param files - Array of path/file pairs
   * @returns Array of upload results
   */
  async uploadMultiple(
    files: { path: string; file: Buffer | Readable }[],
  ): Promise<UploadResult[]> {
    return this.filerService.uploadMultiple(files);
  }

  /**
   * Download a file from the Filer as a readable stream.
   * @param path - File path in SeaweedFS
   * @returns Readable stream of the file content
   * @throws SeaweedFsNotFoundError if the file does not exist
   */
  async download(path: string): Promise<Readable> {
    return this.filerService.download(path);
  }

  /**
   * Download a file from the Filer as a Buffer.
   * @param path - File path in SeaweedFS
   * @returns Buffer containing the file content
   * @throws SeaweedFsNotFoundError if the file does not exist
   */
  async downloadToBuffer(path: string): Promise<Buffer> {
    return this.filerService.downloadToBuffer(path);
  }

  /**
   * Delete a file from the Filer.
   * @param path - File path in SeaweedFS
   * @param options - Optional delete options (recursive flag)
   */
  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.filerService.delete(path, options);
  }

  /**
   * Check if a file or directory exists at the given path.
   * @param path - Path to check
   * @returns true if the resource exists, false otherwise
   */
  async exists(path: string): Promise<boolean> {
    return this.filerService.exists(path);
  }

  /**
   * Get metadata for a file.
   * @param path - File path in SeaweedFS
   * @returns File metadata including size, mime type, and custom headers
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    return this.filerService.getMetadata(path);
  }

  /**
   * List directory contents with pagination support.
   * @param path - Directory path in SeaweedFS
   * @param options - Optional list options (limit, lastFileName cursor, namePattern)
   * @returns Directory listing with entries and pagination info
   */
  async listDirectory(
    path: string,
    options?: { limit?: number; lastFileName?: string; namePattern?: string },
  ): Promise<DirectoryListing> {
    return this.filerService.listDirectory(path, options);
  }

  /**
   * Create a directory.
   * @param path - Directory path to create
   */
  async createDirectory(path: string): Promise<void> {
    return this.filerService.createDirectory(path);
  }

  /**
   * Delete a directory.
   * @param path - Directory path to delete
   * @param recursive - Whether to delete recursively (default false)
   */
  async deleteDirectory(path: string, recursive = false): Promise<void> {
    return this.filerService.deleteDirectory(path, recursive);
  }

  /**
   * Assign a volume from the Master server.
   * Requires masterUrl to be configured.
   * @returns Volume assignment info with fid and volume server URL
   * @throws SeaweedFsException if masterUrl is not configured
   */
  async assignVolume(): Promise<AssignVolumeResult> {
    return this.filerService.assignVolume();
  }

  // ─── S3 Gateway API Methods ───────────────────────────────────────

  /**
   * Put an object via the S3 Gateway.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @param body - Buffer or Readable stream
   * @param options - Optional S3 put options (contentType, metadata, acl)
   * @returns Upload result with etag and version
   */
  async s3PutObject(
    bucket: string,
    key: string,
    body: Buffer | Readable,
    options?: S3PutOptions,
  ): Promise<S3UploadResult> {
    return this.s3Service.s3PutObject(bucket, key, body, options);
  }

  /**
   * Upload a large file via S3 multipart upload.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @param body - Readable stream (will be chunked into parts)
   * @param options - Multipart options (partSize, concurrency, onProgress)
   * @returns Upload result with etag and version
   */
  async s3PutObjectMultipart(
    bucket: string,
    key: string,
    body: Readable,
    options?: S3MultipartOptions,
  ): Promise<S3UploadResult> {
    return this.s3Service.s3PutObjectMultipart(bucket, key, body, options);
  }

  /**
   * Get an object from S3 as a readable stream.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @returns Readable stream of the object content
   */
  async s3GetObject(bucket: string, key: string): Promise<Readable> {
    return this.s3Service.s3GetObject(bucket, key);
  }

  /**
   * Get an object from S3 as a Buffer.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @returns Buffer containing the object content
   */
  async s3GetObjectAsBuffer(bucket: string, key: string): Promise<Buffer> {
    return this.s3Service.s3GetObjectAsBuffer(bucket, key);
  }

  /**
   * Delete an object from S3.
   * @param bucket - S3 bucket name
   * @param key - Object key
   */
  async s3DeleteObject(bucket: string, key: string): Promise<void> {
    return this.s3Service.s3DeleteObject(bucket, key);
  }

  /**
   * Batch delete multiple objects from S3.
   * @param bucket - S3 bucket name
   * @param keys - Array of object keys to delete
   * @returns Result with deleted keys and any errors
   */
  async s3DeleteObjects(
    bucket: string,
    keys: string[],
  ): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }> {
    return this.s3Service.s3DeleteObjects(bucket, keys);
  }

  /**
   * Get metadata/head for an S3 object.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @returns Object metadata
   */
  async s3HeadObject(bucket: string, key: string): Promise<S3ObjectMetadata> {
    return this.s3Service.s3HeadObject(bucket, key);
  }

  /**
   * List objects in an S3 bucket with pagination.
   * @param bucket - S3 bucket name
   * @param options - List options (prefix, maxKeys, continuationToken)
   * @returns List result with objects and pagination tokens
   */
  async s3ListObjects(
    bucket: string,
    options?: { prefix?: string; maxKeys?: number; continuationToken?: string },
  ): Promise<S3ListResult> {
    return this.s3Service.s3ListObjects(bucket, options);
  }

  /**
   * Copy an object within or between S3 buckets.
   * @param sourceBucket - Source bucket name
   * @param sourceKey - Source object key
   * @param destBucket - Destination bucket name
   * @param destKey - Destination object key
   */
  async s3CopyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    return this.s3Service.s3CopyObject(sourceBucket, sourceKey, destBucket, destKey);
  }

  /**
   * Create an S3 bucket.
   * @param bucket - Bucket name to create
   */
  async s3CreateBucket(bucket: string): Promise<void> {
    return this.s3Service.s3CreateBucket(bucket);
  }

  /**
   * Delete an S3 bucket.
   * @param bucket - Bucket name to delete
   */
  async s3DeleteBucket(bucket: string): Promise<void> {
    return this.s3Service.s3DeleteBucket(bucket);
  }

  /**
   * Check if an S3 bucket exists.
   * @param bucket - Bucket name to check
   * @returns true if the bucket exists
   */
  async s3BucketExists(bucket: string): Promise<boolean> {
    return this.s3Service.s3BucketExists(bucket);
  }

  /**
   * List all S3 buckets.
   * @returns Array of bucket names
   */
  async s3ListBuckets(): Promise<string[]> {
    return this.s3Service.s3ListBuckets();
  }

  /**
   * Generate a presigned upload URL for direct client uploads.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @param options - Presign options (expiresIn, contentType)
   * @returns Presigned URL string
   */
  async s3GetPresignedUploadUrl(
    bucket: string,
    key: string,
    options?: { expiresIn?: number; contentType?: string },
  ): Promise<string> {
    return this.s3Service.s3GetPresignedUploadUrl(bucket, key, options);
  }

  /**
   * Generate a presigned download URL for direct client access.
   * @param bucket - S3 bucket name
   * @param key - Object key
   * @param options - Presign options (expiresIn)
   * @returns Presigned URL string
   */
  async s3GetPresignedDownloadUrl(
    bucket: string,
    key: string,
    options?: { expiresIn?: number },
  ): Promise<string> {
    return this.s3Service.s3GetPresignedDownloadUrl(bucket, key, options);
  }

  /**
   * Set an S3 bucket policy. SeaweedFS S3 Gateway does not support this.
   * @throws SeaweedFsUnsupportedOperationError always
   */
  async s3SetBucketPolicy(bucket: string, policy: object): Promise<void> {
    return this.s3Service.s3SetBucketPolicy(bucket, policy);
  }

  // ─── Escape Hatches ───────────────────────────────────────────────

  /**
   * Get the raw S3Client instance for advanced use cases.
   * @returns S3Client instance
   */
  getRawS3Client(): S3Client {
    return this.s3Service.getRawS3Client();
  }

  /**
   * Get the raw Axios HTTP client for the Filer API.
   * @returns AxiosInstance
   */
  getRawFilerHttpClient(): AxiosInstance {
    return this.filerService.getRawHttpClient();
  }
}
