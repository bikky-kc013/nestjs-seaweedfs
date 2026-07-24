# S3 Gateway API

The S3 Gateway provides an S3-compatible interface on top of SeaweedFS. `nestjs-seaweedfs` wraps all S3 operations through the `SeaweedFsService`, making them available as first-class NestJS methods.

## Put Object

### Upload a single object

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Injectable()
export class S3Service {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async uploadObject() {
    return this.seaweed.s3PutObject('my-bucket', 'key.txt', Buffer.from('content'), {
      contentType: 'text/plain',
      metadata: { uploadedBy: 'service' },
    });
  }
}
```

| Option | Type | Description |
|--------|------|-------------|
| `contentType` | `string` | MIME type of the object |
| `metadata` | `Record<string, string>` | Custom metadata headers |
| `acl` | `string` | Canned ACL (e.g., `'public-read'`) |

### Multipart upload (large files)

```typescript
import { Readable } from 'stream';

async uploadLargeFile() {
  const stream = Readable.from(Buffer.from('large file content'));
  const result = await this.seaweed.s3PutObjectMultipart('my-bucket', 'large-file.bin', stream, {
    partSize: 10 * 1024 * 1024, // 10 MB per part
    concurrency: 4,
    onProgress: (event) => {
      console.log(`Upload progress: ${event.percentage}%`);
    },
  });
  return result;
}
```

| Option | Type | Description |
|--------|------|-------------|
| `partSize` | `number` | Size of each part in bytes (default: 5 MB) |
| `concurrency` | `number` | Number of concurrent uploads (default: 4) |
| `onProgress` | `(event: S3ProgressEvent) => void` | Progress callback |

## Get Object

### Download as buffer

```typescript
async downloadBuffer() {
  return this.seaweed.s3GetObjectAsBuffer('my-bucket', 'key.txt');
}
```

### Download as readable stream

```typescript
async downloadStream() {
  return this.seaweed.s3GetObject('my-bucket', 'key.txt');
}
```

### Stream download in a controller

```typescript
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('s3')
export class S3Controller {
  constructor(private readonly seaweed: SeaweedFsService) {}

  @Get('download/:key(*)')
  async download(@Param('key') key: string, @Res() res: Response) {
    const stream = await this.seaweed.s3GetObject('my-bucket', key);
    res.setHeader('Content-Type', 'application/octet-stream');
    stream.pipe(res);
  }
}
```

## Delete Object

### Delete a single object

```typescript
async deleteObject() {
  await this.seaweed.s3DeleteObject('my-bucket', 'key.txt');
}
```

### Batch delete objects

```typescript
async batchDelete() {
  const result = await this.seaweed.s3DeleteObjects('my-bucket', ['key1.txt', 'key2.txt']);
  // result: { deleted: string[], errors: { key: string; error: string }[] }
  return result;
}
```

## Head Object

Get object metadata without downloading the content:

```typescript
async headObject() {
  const metadata = await this.seaweed.s3HeadObject('my-bucket', 'key.txt');
  return metadata;
}
```

## List Objects

```typescript
async listObjects() {
  const result = await this.seaweed.s3ListObjects('my-bucket', {
    prefix: 'uploads/',
    maxKeys: 100,
  });
  return result;
}
```

| Option | Type | Description |
|--------|------|-------------|
| `prefix` | `string` | Filter objects by prefix |
| `maxKeys` | `number` | Maximum number of keys to return |
| `continuationToken` | `string` | Token for pagination |

## Copy Object

Copy an object within or between buckets:

```typescript
async copyObject() {
  await this.seaweed.s3CopyObject('my-bucket', 'source-key', 'my-bucket', 'dest-key');
}
```

## Bucket Management

### Create a bucket

```typescript
async createBucket() {
  await this.seaweed.s3CreateBucket('my-bucket');
}
```

### Delete a bucket

```typescript
async deleteBucket() {
  await this.seaweed.s3DeleteBucket('my-bucket');
}
```

### Check if a bucket exists

```typescript
async checkBucket() {
  const exists = await this.seaweed.s3BucketExists('my-bucket');
  return exists;
}
```

### List all buckets

```typescript
async listBuckets() {
  const buckets = await this.seaweed.s3ListBuckets();
  return buckets;
}
```

## Presigned URLs

### Generate presigned upload URL

```typescript
async getUploadUrl() {
  return this.seaweed.s3GetPresignedUploadUrl('my-bucket', 'key.txt', {
    expiresIn: 3600, // 1 hour
    contentType: 'image/png',
  });
}
```

| Option | Type | Description |
|--------|------|-------------|
| `expiresIn` | `number` | URL expiry in seconds |
| `contentType` | `string` | Expected content type |

### Generate presigned download URL

```typescript
async getDownloadUrl() {
  return this.seaweed.s3GetPresignedDownloadUrl('my-bucket', 'key.txt', {
    expiresIn: 3600,
  });
}
```

| Option | Type | Description |
|--------|------|-------------|
| `expiresIn` | `number` | URL expiry in seconds |

## Unsupported Operations

### Set bucket policy

The SeaweedFS S3 Gateway does not support bucket policies. Calling this method will always throw `SeaweedFsUnsupportedOperationError`:

```typescript
try {
  await this.seaweed.s3SetBucketPolicy('my-bucket', { /* policy */ });
} catch (error) {
  if (error instanceof SeaweedFsUnsupportedOperationError) {
    // SeaweedFS does not support bucket policies
  }
}
```

## Escape Hatch — Raw S3 Client

For operations not covered by the SDK, you can access the raw AWS `S3Client`:

```typescript
const rawS3 = this.seaweed.getRawS3Client();
```

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  constructor(private readonly seaweed: SeaweedFsService) {}

  // Put
  async putObject(bucket: string, key: string, body: Buffer) {
    return this.seaweed.s3PutObject(bucket, key, body);
  }

  async putMultipart(bucket: string, key: string, stream: Readable) {
    return this.seaweed.s3PutObjectMultipart(bucket, key, stream);
  }

  // Get
  async getBuffer(bucket: string, key: string) {
    return this.seaweed.s3GetObjectAsBuffer(bucket, key);
  }

  async getStream(bucket: string, key: string) {
    return this.seaweed.s3GetObject(bucket, key);
  }

  // Delete
  async deleteObject(bucket: string, key: string) {
    await this.seaweed.s3DeleteObject(bucket, key);
  }

  async deleteMultiple(bucket: string, keys: string[]) {
    return this.seaweed.s3DeleteObjects(bucket, keys);
  }

  // Metadata
  async headObject(bucket: string, key: string) {
    return this.seaweed.s3HeadObject(bucket, key);
  }

  async listObjects(bucket: string, prefix?: string) {
    return this.seaweed.s3ListObjects(bucket, { prefix });
  }

  // Copy
  async copyObject(srcBucket: string, srcKey: string, destBucket: string, destKey: string) {
    await this.seaweed.s3CopyObject(srcBucket, srcKey, destBucket, destKey);
  }

  // Bucket management
  async createBucket(bucket: string) {
    await this.seaweed.s3CreateBucket(bucket);
  }

  async deleteBucket(bucket: string) {
    await this.seaweed.s3DeleteBucket(bucket);
  }

  async bucketExists(bucket: string) {
    return this.seaweed.s3BucketExists(bucket);
  }

  async listBuckets() {
    return this.seaweed.s3ListBuckets();
  }

  // Presigned URLs
  async getUploadUrl(bucket: string, key: string, expiresIn?: number) {
    return this.seaweed.s3GetPresignedUploadUrl(bucket, key, { expiresIn });
  }

  async getDownloadUrl(bucket: string, key: string, expiresIn?: number) {
    return this.seaweed.s3GetPresignedDownloadUrl(bucket, key, { expiresIn });
  }
}
```

## Next steps

- [Filer API](filer-api.md) — Filer REST API operations
- [Examples](../examples/) — Complete controller examples