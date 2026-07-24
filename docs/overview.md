# Overview

## What is nestjs-seaweedfs?

`nestjs-seaweedfs` is an unofficial, community-maintained NestJS SDK for [SeaweedFS](https://github.com/seaweedfs/seaweedfs). It provides a seamless integration between NestJS applications and SeaweedFS, supporting both the **Filer REST API** and the **S3 Gateway API** as first-class features.

> **Not affiliated with, endorsed by, or associated with NestJS, SeaweedFS, or their respective maintainers/trademark holders.**

## What problem does it solve?

Integrating SeaweedFS into a NestJS application typically requires:

1. Setting up HTTP clients for the Filer REST API
2. Configuring AWS SDK clients for the S3 Gateway API
3. Managing connection pooling, retries, and error handling
4. Writing boilerplate code for common operations (upload, download, delete, list)
5. Handling authentication and configuration management

`nestjs-seaweedfs` eliminates all of this boilerplate by providing:

- **Pre-configured clients** — Both Filer (Axios) and S3 (AWS SDK v3) clients are initialized and managed for you
- **Unified service API** — A single `SeaweedFsService` facade exposes all operations from both APIs
- **NestJS idioms** — Dynamic modules, dependency injection, async configuration, and connection validation
- **Production-ready features** — Retry logic with exponential backoff, typed error hierarchy, and escape hatches for advanced use cases

## Key features

| Feature | Description |
|---------|-------------|
| **Filer REST API** | Upload, download, delete, list, metadata, directory management, TTL, replication, collections, volume assignment |
| **S3 Gateway API** | Full S3-compatible operations including multipart uploads, presigned URLs, bucket management, batch deletes |
| **Dynamic Module** | `forRoot`, `forRootAsync` (with `useFactory`, `useClass`, `useExisting`, `inject`), and `register` for feature-level instances |
| **Connection Validation** | Validates both Filer and S3 Gateway connectivity on boot (configurable) |
| **Retry Logic** | Exponential backoff for transient network failures (HTTP 429, 503, 504) |
| **Custom Exceptions** | Typed error hierarchy with meaningful context |
| **Full TypeScript** | Strict mode, no `any` types in public API, comprehensive JSDoc |
| **Escape Hatches** | Raw `S3Client` and `AxiosInstance` access for advanced use cases |

## Supported SeaweedFS APIs

### Filer REST API

The Filer API is SeaweedFS's native HTTP interface. It provides:

- File operations: upload, download, delete, exists, metadata
- Directory operations: create, delete (recursive), list with pagination
- SeaweedFS-specific features: TTL, replication, collection headers
- Volume assignment via the Master server

**When to use the Filer API:**

- Simple file storage with SeaweedFS-specific features (TTL, replication, collections)
- Volume assignment for direct writes
- Maximum throughput with SeaweedFS metadata
- Directory management operations

### S3 Gateway API

The S3 Gateway provides an S3-compatible interface on top of SeaweedFS. It enables:

- Object operations: put, get, delete, head, copy
- Multipart uploads with progress tracking
- Presigned URLs for direct client uploads/downloads
- Bucket management: create, delete, list, exists
- Batch delete operations

**When to use the S3 Gateway API:**

- S3-compatible application integration
- Presigned URLs for client-side uploads
- Cross-platform compatibility (any AWS SDK client can connect)
- Bucket management operations

## Supported operations summary

### Filer API operations

| Operation | Method |
|-----------|--------|
| Upload file (Buffer or stream) | `upload()` |
| Upload multiple files | `uploadMultiple()` |
| Download file as stream | `download()` |
| Download file as Buffer | `downloadToBuffer()` |
| Delete file | `delete()` |
| Check file exists | `exists()` |
| Get file metadata | `getMetadata()` |
| List directory | `listDirectory()` |
| Create directory | `createDirectory()` |
| Delete directory | `deleteDirectory()` |
| Assign volume | `assignVolume()` |

### S3 Gateway operations

| Operation | Method |
|-----------|--------|
| Put object | `s3PutObject()` |
| Multipart upload | `s3PutObjectMultipart()` |
| Get object as stream | `s3GetObject()` |
| Get object as Buffer | `s3GetObjectAsBuffer()` |
| Delete object | `s3DeleteObject()` |
| Batch delete objects | `s3DeleteObjects()` |
| Get object metadata | `s3HeadObject()` |
| List objects | `s3ListObjects()` |
| Copy object | `s3CopyObject()` |
| Create bucket | `s3CreateBucket()` |
| Delete bucket | `s3DeleteBucket()` |
| Check bucket exists | `s3BucketExists()` |
| List buckets | `s3ListBuckets()` |
| Presigned upload URL | `s3GetPresignedUploadUrl()` |
| Presigned download URL | `s3GetPresignedDownloadUrl()` |
| Set bucket policy | `s3SetBucketPolicy()` (throws `SeaweedFsUnsupportedOperationError`) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Application                    │
│                                                          │
│  ┌─────────────────┐     ┌──────────────────────────┐  │
│  │  Your Controller │────▶│  SeaweedFsService         │  │
│  └─────────────────┘     └──────────────────────────┘  │
│                                        │                 │
│                    ┌───────────────────┴──────────────┐│
│                    │                                    ││
│         ┌──────────▼──────────┐    ┌───────────────┐  ││
│         │ SeaweedFsFilerService│    │ SeaweedFsS3   │  ││
│         │ (Axios HTTP client) │    │ Service       │  ││
│         └─────────────────────┘    │ (AWS SDK v3)  │  ││
│                                     └───────────────┘  ││
│                                        │               ││
│         ┌──────────────────────────────┴──────────────┐││
│         │         SeaweedFS Cluster                  │││
│         │  ┌────────┐  ┌────────┐  ┌────────┐        │││
│         │  │ Master │  │ Volume │  │ Filer  │        │││
│         │  │ Server │  │ Server │  │ + S3   │        │││
│         │  └────────┘  └────────┘  └────────┘        │││
│         └─────────────────────────────────────────────┘│
│                                                        │
└─────────────────────────────────────────────────────────┘
```

The `SeaweedFsModule` registers three providers:

1. **`SeaweedFsFilerService`** — Manages the Axios HTTP client for the Filer REST API
2. **`SeaweedFsS3Service`** — Manages the AWS SDK v3 `S3Client` for the S3 Gateway API
3. **`SeaweedFsService`** — A facade that delegates to both services, providing a unified API

See [Why nestjs-seaweedfs?](why-nestjs-seaweedfs.md) for a detailed comparison of using this package versus direct integration.