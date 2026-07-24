# Filer API

The Filer REST API is SeaweedFS's native HTTP interface. It provides file and directory operations with SeaweedFS-specific features like TTL, replication, and collections.

## Upload Files

### Upload a file (Buffer)

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Injectable()
export class FileService {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async uploadFile() {
    const result = await this.seaweed.upload('/uploads/document.pdf', Buffer.from('file content'));
    // result: { fid: '1,abc123', url: 'http://volume:8080/1,abc123', size: 12 }
    return result;
  }
}
```

### Upload a file (Readable stream)

```typescript
import { Readable } from 'stream';

async uploadFromStream() {
  const stream = Readable.from(Buffer.from('stream content'));
  const result = await this.seaweed.upload('/uploads/stream.txt', stream);
  return result;
}
```

### Upload with options

The `upload()` method accepts optional `UploadOptions`:

| Option | Type | Description |
|--------|------|-------------|
| `headers` | `Record<string, string>` | Custom HTTP headers |
| `ttl` | `number` | Time-to-live in seconds |
| `replication` | `string` | Replication strategy (e.g., `'001'`, `'002'`, `'100'`) |
| `collection` | `string` | Collection name for grouping files |

```typescript
async uploadWithOptions() {
  const result = await this.seaweed.upload('/uploads/file.txt', Buffer.from('content'), {
    ttl: 86400, // 24 hours
    replication: '001', // 1 copy
    collection: 'documents',
    headers: {
      'Content-Type': 'text/plain',
    },
  });
  return result;
}
```

### Upload multiple files

```typescript
async uploadMultiple() {
  const results = await this.seaweed.uploadMultiple([
    { path: '/uploads/file1.txt', file: Buffer.from('content 1') },
    { path: '/uploads/file2.txt', file: Buffer.from('content 2') },
    { path: '/uploads/file3.txt', file: Buffer.from('content 3') },
  ]);
  return results;
}
```

### Upload result

```typescript
interface UploadResult {
  fid: string;        // File ID (e.g., '1,abc123')
  url: string;        // Download URL
  size: number;       // File size in bytes
  etag?: string;      // ETag (if available)
}
```

## Download Files

### Download as Buffer

```typescript
async downloadFile(path: string) {
  const buffer = await this.seaweed.downloadToBuffer(path);
  return buffer;
}
```

### Download as Readable stream

```typescript
import { Readable } from 'stream';

async downloadAsStream(path: string) {
  const stream = await this.seaweed.download(path);
  return stream;
}
```

### Streaming download in a controller

```typescript
import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('files')
export class FileController {
  constructor(private readonly seaweed: SeaweedFsService) {}

  @Get('download/:path(*)')
  async download(@Param('path') path: string, @Res() res: Response) {
    const stream = await this.seaweed.download(`/${path}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`);
    stream.pipe(res);
  }
}
```

## Delete Files

### Delete a single file

```typescript
async deleteFile(path: string) {
  await this.seaweed.delete(path);
}
```

### Delete recursively

```typescript
async deleteDirectory(path: string) {
  await this.seaweed.delete(path, { recursive: true });
}
```

## Check File Existence

```typescript
async fileExists(path: string) {
  const exists = await this.seaweed.exists(path);
  return exists; // true or false
}
```

## File Metadata

### Get file metadata

```typescript
async getMetadata(path: string) {
  const metadata = await this.seaweed.getMetadata(path);
  return metadata;
}
```

### Metadata result

```typescript
interface FileMetadata {
  name: string;           // File name
  path: string;           // Full path
  size: number;           // File size in bytes
  mimeType: string;       // MIME type
  md5?: string;           // MD5 hash (if available)
  headers: Record<string, string>; // Custom headers
  chunks?: number;        // Number of chunks
  modifiedTime?: string;  // Last modified time
  expireAt?: string;      // Expiration time (if TTL set)
}
```

## Directory Operations

### Create a directory

```typescript
async createDirectory(path: string) {
  await this.seaweed.createDirectory(path);
}
```

### Delete a directory

```typescript
async deleteDirectory(path: string, recursive = false) {
  await this.seaweed.deleteDirectory(path, recursive);
}
```

### List directory contents

```typescript
async listDirectory(path: string, options?: {
  limit?: number;          // Maximum number of entries
  lastFileName?: string;   // Cursor for pagination
  namePattern?: string;    // Glob pattern (e.g., '*.txt')
}) {
  const listing = await this.seaweed.listDirectory(path, options);
  return listing;
}
```

### Directory listing result

```typescript
interface DirectoryListing {
  entries: DirectoryEntry[];     // Array of entries
  hasMore: boolean;              // Whether there are more entries
  nextFileName?: string;         // Cursor for next page
}

interface DirectoryEntry {
  name: string;           // Entry name
  path: string;           // Full path
  size: number;           // Size in bytes
  mimeType: string;       // MIME type
  isDirectory: boolean;   // Whether it's a directory
  chunks?: number;        // Number of chunks
  modifiedTime?: string;  // Last modified time
}
```

### Example: Paginated directory listing

```typescript
async listAllFiles(directory: string) {
  const allEntries: DirectoryEntry[] = [];
  let hasMore = true;
  let lastFileName: string | undefined;

  while (hasMore) {
    const listing = await this.seaweed.listDirectory(directory, {
      limit: 100,
      lastFileName,
    });
    allEntries.push(...listing.entries);
    hasMore = listing.hasMore;
    lastFileName = listing.nextFileName;
  }

  return allEntries;
}
```

## Volume Assignment

### Assign a volume

The `assignVolume()` method requires `masterUrl` to be configured. It returns a volume assignment from the Master server:

```typescript
async assignVolume() {
  const result = await this.seaweed.assignVolume();
  return result;
}
```

### Volume assignment result

```typescript
interface AssignVolumeResult {
  fid: string;        // File ID
  volumeId: string;     // Volume ID
  url: string;         // Volume server URL
  publicUrl: string;   // Public URL
  count: number;       // Number of volumes
}
```

## Streaming

### Stream upload

```typescript
import { Readable } from 'stream';

async streamUpload(path: string, stream: Readable) {
  const result = await this.seaweed.upload(path, stream);
  return result;
}
```

### Stream download

```typescript
async streamDownload(path: string) {
  const stream = await this.seaweed.download(path);
  return stream;
}
```

## Complete example

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService, UploadOptions, FileMetadata, DirectoryListing } from 'nestjs-seaweedfs';
import { Readable } from 'stream';

@Injectable()
export class FileService {
  constructor(private readonly seaweed: SeaweedFsService) {}

  // Upload
  async upload(path: string, buffer: Buffer, options?: UploadOptions) {
    return this.seaweed.upload(path, buffer, options);
  }

  async uploadStream(path: string, stream: Readable) {
    return this.seaweed.upload(path, stream);
  }

  async uploadMultiple(files: { path: string; file: Buffer }[]) {
    return this.seaweed.uploadMultiple(files);
  }

  // Download
  async download(path: string) {
    return this.seaweed.downloadToBuffer(path);
  }

  async downloadStream(path: string) {
    return this.seaweed.download(path);
  }

  // Delete
  async delete(path: string, recursive = false) {
    await this.seaweed.delete(path, { recursive });
  }

  // Check
  async exists(path: string) {
    return this.seaweed.exists(path);
  }

  // Metadata
  async getMetadata(path: string): Promise<FileMetadata> {
    return this.seaweed.getMetadata(path);
  }

  // Directory
  async listDirectory(path: string, options?: { limit?: number; lastFileName?: string; namePattern?: string }): Promise<DirectoryListing> {
    return this.seaweed.listDirectory(path, options);
  }

  async createDirectory(path: string) {
    await this.seaweed.createDirectory(path);
  }

  async deleteDirectory(path: string, recursive = false) {
    await this.seaweed.deleteDirectory(path, recursive);
  }

  // Volume
  async assignVolume() {
    return this.seaweed.assignVolume();
  }
}
```

## Next steps

- [S3 API](s3-api.md) — S3 Gateway operations
- [Examples](../examples/) — Complete controller examples
- [API Reference](../README.md#api-reference) — Full API reference