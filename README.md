# nestjs-seaweedfs

> **Unofficial, community-maintained** NestJS SDK for [SeaweedFS](https://github.com/seaweedfs/seaweedfs) — full support for both the **Filer REST API** and the **S3 Gateway API** as first-class features.
>
> Not affiliated with, endorsed by, or associated with NestJS, SeaweedFS, or their respective maintainers/trademark holders.

## Features

- **Filer REST API**: Upload, download, delete, list, metadata, directory management, TTL, replication, collections, volume assignment
- **S3 Gateway API**: Full S3-compatible operations including multipart uploads, presigned URLs, bucket management, batch deletes
- **Dynamic Module**: `forRoot`, `forRootAsync` (with `useFactory`, `useClass`, `useExisting`, `inject`), and `register` for feature-level instances
- **Connection Validation**: Validates both Filer and S3 Gateway connectivity on boot (configurable)
- **Retry Logic**: Exponential backoff for transient network failures
- **Custom Exceptions**: Typed error hierarchy with meaningful context
- **Full TypeScript**: Strict mode, no `any` types in public API, comprehensive JSDoc
- **Escape Hatches**: Raw S3Client and AxiosInstance access for advanced use cases

## Installation

```bash
npm install nestjs-seaweedfs @nestjs/common @nestjs/core rxjs
```

## Quick Start

### Synchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { SeaweedFsModule } from 'nestjs-seaweedfs';

@Module({
  imports: [
    SeaweedFsModule.forRoot({
      filer: {
        url: 'http://localhost:8888',
      },
      s3: {
        endpoint: 'http://localhost:8333',
        accessKeyId: 'your-access-key',
        secretAccessKey: 'your-secret-key',
        forcePathStyle: true,
        defaultBucket: 'my-bucket',
      },
    }),
  ],
})
export class AppModule {}
```

### Asynchronous Configuration (with ConfigService)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeaweedFsModule } from 'nestjs-seaweedfs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SeaweedFsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        filer: {
          url: config.get<string>('SEAWEEDFS_FILER_URL', 'http://localhost:8888'),
        },
        s3: {
          endpoint: config.get<string>('SEAWEEDFS_S3_ENDPOINT', 'http://localhost:8333'),
          accessKeyId: config.get<string>('SEAWEEDFS_S3_ACCESS_KEY', ''),
          secretAccessKey: config.get<string>('SEAWEEDFS_S3_SECRET_KEY', ''),
          forcePathStyle: true,
          defaultBucket: config.get<string>('SEAWEEDFS_S3_BUCKET', 'default'),
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### Feature-Level Module (per-module instances)

```typescript
import { Module } from '@nestjs/common';
import { SeaweedFsModule } from 'nestjs-seaweedfs';

@Module({
  imports: [
    SeaweedFsModule.register({
      filer: { url: 'http://localhost:8888' },
      s3: {
        endpoint: 'http://localhost:8333',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      },
    }),
  ],
})
export class SpecialModule {}
```

## Usage Examples

### Filer API

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';
import { Readable } from 'stream';

@Injectable()
export class FileService {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async uploadFile(buffer: Buffer, filename: string) {
    return this.seaweed.upload(`/uploads/${filename}`, buffer, {
      ttl: 86400,
      replication: '001',
      collection: 'documents',
    });
  }

  async streamUpload() {
    const readable = Readable.from(Buffer.from('stream content'));
    return this.seaweed.upload('/stream/file.txt', readable);
  }

  async downloadFile(path: string) {
    return this.seaweed.downloadToBuffer(path);
  }

  async streamDownload(path: string) {
    const stream = await this.seaweed.download(path);
    return stream;
  }

  async listFiles(directory: string) {
    return this.seaweed.listDirectory(directory, {
      limit: 50,
      namePattern: '*.txt',
    });
  }

  async removeFile(path: string) {
    await this.seaweed.delete(path, { recursive: true });
  }

  async fileExists(path: string) {
    return this.seaweed.exists(path);
  }

  async assignNewVolume() {
    return this.seaweed.assignVolume();
  }
}
```

### S3 Gateway API

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async uploadObject(key: string, body: Buffer) {
    return this.seaweed.s3PutObject('my-bucket', key, body, {
      contentType: 'application/json',
      metadata: { uploadedBy: 'service' },
    });
  }

  async uploadLargeFile(key: string, stream: Readable, onProgress?: (pct: number) => void) {
    return this.seaweed.s3PutObjectMultipart('my-bucket', key, stream, {
      partSize: 10 * 1024 * 1024,
      concurrency: 4,
      onProgress: (event) => {
        console.log(`Upload progress: ${event.percentage}%`);
        onProgress?.(event.percentage);
      },
    });
  }

  async downloadObject(key: string) {
    return this.seaweed.s3GetObjectAsBuffer('my-bucket', key);
  }

  async streamObject(key: string) {
    return this.seaweed.s3GetObject('my-bucket', key);
  }

  async listObjects(prefix?: string) {
    return this.seaweed.s3ListObjects('my-bucket', { prefix });
  }

  async getUploadUrl(key: string) {
    return this.seaweed.s3GetPresignedUploadUrl('my-bucket', key, {
      expiresIn: 3600,
      contentType: 'image/png',
    });
  }

  async getDownloadUrl(key: string) {
    return this.seaweed.s3GetPresignedDownloadUrl('my-bucket', key, {
      expiresIn: 3600,
    });
  }

  async batchDelete(keys: string[]) {
    return this.seaweed.s3DeleteObjects('my-bucket', keys);
  }

  async removeObject(key: string) {
    await this.seaweed.s3DeleteObject('my-bucket', key);
  }

  async copyObject(srcKey: string, destKey: string) {
    await this.seaweed.s3CopyObject('my-bucket', srcKey, 'my-bucket', destKey);
  }

  async checkObject(key: string) {
    return this.seaweed.s3HeadObject('my-bucket', key);
  }

  async ensureBucketExists() {
    const exists = await this.seaweed.s3BucketExists('my-bucket');
    if (!exists) {
      await this.seaweed.s3CreateBucket('my-bucket');
    }
  }
}
```

### Escape Hatch — Raw Clients

```typescript
const rawS3 = this.seaweed.getRawS3Client();
const rawHttp = this.seaweed.getRawFilerHttpClient();
```

## API Reference

### Filer Methods

| Method                              | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `upload(path, file, options?)`      | Upload a file (Buffer or Readable stream) via Filer |
| `uploadMultiple(files)`             | Upload multiple files sequentially                  |
| `download(path)`                    | Download a file as a Readable stream                |
| `downloadToBuffer(path)`            | Download a file as a Buffer                         |
| `delete(path, options?)`            | Delete a file (optional recursive)                  |
| `exists(path)`                      | Check if a file/directory exists                    |
| `getMetadata(path)`                 | Get file metadata (size, mime type, headers)        |
| `listDirectory(path, options?)`     | List directory with pagination support              |
| `createDirectory(path)`             | Create a directory                                  |
| `deleteDirectory(path, recursive?)` | Delete a directory                                  |
| `assignVolume()`                    | Assign a volume via Master server                   |

### S3 Methods

| Method                                                 | Description                               |
| ------------------------------------------------------ | ----------------------------------------- |
| `s3PutObject(bucket, key, body, options?)`             | Put an object                             |
| `s3PutObjectMultipart(bucket, key, body, options?)`    | Multipart upload with progress            |
| `s3GetObject(bucket, key)`                             | Get object as Readable stream             |
| `s3GetObjectAsBuffer(bucket, key)`                     | Get object as Buffer                      |
| `s3DeleteObject(bucket, key)`                          | Delete a single object                    |
| `s3DeleteObjects(bucket, keys)`                        | Batch delete objects                      |
| `s3HeadObject(bucket, key)`                            | Get object metadata                       |
| `s3ListObjects(bucket, options?)`                      | List objects with pagination              |
| `s3CopyObject(srcBucket, srcKey, destBucket, destKey)` | Copy an object                            |
| `s3CreateBucket(bucket)`                               | Create a bucket                           |
| `s3DeleteBucket(bucket)`                               | Delete a bucket                           |
| `s3BucketExists(bucket)`                               | Check if a bucket exists                  |
| `s3ListBuckets()`                                      | List all buckets                          |
| `s3GetPresignedUploadUrl(bucket, key, options?)`       | Generate presigned upload URL             |
| `s3GetPresignedDownloadUrl(bucket, key, options?)`     | Generate presigned download URL           |
| `s3SetBucketPolicy(bucket, policy)`                    | Throws unsupported (SeaweedFS limitation) |

### Error Classes

| Class                                | Description                                             |
| ------------------------------------ | ------------------------------------------------------- |
| `SeaweedFsException`                 | Base exception                                          |
| `SeaweedFsConnectionError`           | Connection failure (includes `source: 'filer' \| 's3'`) |
| `SeaweedFsNotFoundError`             | Resource not found                                      |
| `SeaweedFsConfigurationError`        | Invalid configuration                                   |
| `SeaweedFsUploadError`               | Upload failure                                          |
| `SeaweedFsS3Error`                   | S3-specific error (wraps AWS SDK errors)                |
| `SeaweedFsUnsupportedOperationError` | Unsupported operation                                   |

## Configuration

### Module Options

```typescript
interface SeaweedFsModuleOptions {
  filer: {
    url: string; // Required: Filer URL
    timeout?: number; // Default: 30000
    retries?: number; // Default: 3
  };
  masterUrl?: string; // Optional: for volume assignment
  s3: {
    endpoint: string; // Required: S3 Gateway URL
    accessKeyId: string; // Required
    secretAccessKey: string; // Required
    region?: string; // Default: 'us-east-1'
    forcePathStyle?: boolean; // Default: true (required by SeaweedFS)
    defaultBucket?: string;
  };
  isGlobal?: boolean; // Default: true
  validateConnectionOnBoot?: boolean; // Default: true
}
```

## When to Use Filer API vs S3 Gateway

| Use Case                                                                             | Recommended API          |
| ------------------------------------------------------------------------------------ | ------------------------ |
| Simple file storage with SeaweedFS-specific features (TTL, replication, collections) | Filer API                |
| S3-compatible application integration                                                | S3 Gateway               |
| Volume assignment for direct writes                                                  | Filer API (assignVolume) |
| Bucket management                                                                    | S3 Gateway               |
| Presigned URLs for client uploads                                                    | S3 Gateway               |
| Maximum throughput with SeaweedFS metadata                                           | Filer API                |
| Cross-platform compatibility (AWS SDK clients)                                       | S3 Gateway               |

## Disclaimer

This is an independent, community-built project. It is **not** an official NestJS or SeaweedFS package, and is not published or maintained by the NestJS core team, the SeaweedFS project, or Anthropic. "NestJS" and "SeaweedFS" are used here only to describe compatibility.

## License

MIT
