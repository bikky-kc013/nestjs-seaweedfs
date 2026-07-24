# Quick Start

Get up and running with `nestjs-seaweedfs` in under 5 minutes.

## Prerequisites

- Node.js >= 18.0.0
- A running SeaweedFS instance (Filer + S3 Gateway)

## 1. Install the package

```bash
npm install nestjs-seaweedfs
```

> **Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs` — these are typically already installed in any NestJS project.

## 2. Start SeaweedFS (Docker)

```bash
docker run -d \
  --name seaweedfs \
  -p 8888:8888 \
  -p 8333:8333 \
  -p 9333:9333 \
  chrislusf/seaweedfs:latest \
  filer -master=localhost:9333 -s3 -s3.port=8333
```

> This starts the Filer on port 8888 and the S3 Gateway on port 8333.

## 3. Configure the module

Create `src/app.module.ts`:

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

## 4. Upload your first file

Create `src/file.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Injectable()
export class FileService {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async uploadFile() {
    return this.seaweed.upload('/uploads/hello.txt', Buffer.from('Hello, SeaweedFS!'), {
      ttl: 86400,
      replication: '001',
    });
  }

  async downloadFile() {
    return this.seaweed.downloadToBuffer('/uploads/hello.txt');
  }
}
```

## 5. Verify

Run your NestJS application:

```bash
npm run start:dev
```

Then call your service method — the file will be uploaded to SeaweedFS via the Filer API.

## What's next?

- [Filer API](filer-api.md) — Full Filer REST API operations
- [S3 API](s3-api.md) — S3 Gateway operations including presigned URLs
- [Examples](../examples/) — Complete controller examples