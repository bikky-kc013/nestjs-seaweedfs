# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-01

### Added

- Initial release
- `SeaweedFsModule.forRoot()` for synchronous configuration
- `SeaweedFsModule.forRootAsync()` for async configuration (useFactory, useClass, useExisting)
- `SeaweedFsModule.register()` for feature-level instances
- `SeaweedFsService` — unified public API facade
- **Filer REST API**:
  - `upload()` — Buffer and Readable stream support
  - `uploadMultiple()` — batch upload
  - `download()` — Readable stream output
  - `downloadToBuffer()` — Buffer output
  - `delete()` — with optional recursive flag
  - `exists()` — check file/directory existence
  - `getMetadata()` — file metadata
  - `listDirectory()` — paginated directory listing
  - `createDirectory()` / `deleteDirectory()`
  - `assignVolume()` — Master server volume assignment
  - Seaweed-specific headers: TTL, replication, collection
- **S3 Gateway API**:
  - `s3PutObject()` — single object upload
  - `s3PutObjectMultipart()` — multipart upload with progress tracking
  - `s3GetObject()` / `s3GetObjectAsBuffer()` — object retrieval
  - `s3DeleteObject()` / `s3DeleteObjects()` — single and batch delete
  - `s3HeadObject()` — object metadata
  - `s3ListObjects()` — paginated object listing
  - `s3CopyObject()` — object copy
  - `s3CreateBucket()` / `s3DeleteBucket()` / `s3BucketExists()`
  - `s3ListBuckets()`
  - `s3GetPresignedUploadUrl()` / `s3GetPresignedDownloadUrl()`
  - `s3SetBucketPolicy()` — throws UnsupportedOperation
- Custom exception hierarchy (SeaweedFsException, ConnectionError, NotFoundError, etc.)
- Connection validation on boot for both Filer and S3 Gateway
- Configurable retry logic with exponential backoff
- Escape hatches: `getRawS3Client()`, `getRawFilerHttpClient()`
- Full TypeScript types and JSDoc documentation
- Comprehensive unit tests
- E2E test suite with docker-compose
