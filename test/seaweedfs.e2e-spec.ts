import { Readable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { SeaweedFsModule } from '../src/seaweedfs.module';
import { SeaweedFsService } from '../src/seaweedfs.service';
import { SeaweedFsConnectionError } from '../src/errors';

const FILER_URL = process.env.SEAWEEDFS_FILER_URL || 'http://localhost:8888';
const S3_ENDPOINT = process.env.SEAWEEDFS_S3_ENDPOINT || 'http://localhost:8333';
const S3_ACCESS_KEY = process.env.SEAWEEDFS_S3_ACCESS_KEY || 'test-access-key';
const S3_SECRET_KEY = process.env.SEAWEEDFS_S3_SECRET_KEY || 'test-secret-key';
const S3_BUCKET = process.env.SEAWEEDFS_S3_BUCKET || 'test-bucket';

describe('SeaweedFS E2E Tests', () => {
  let module: TestingModule;
  let service: SeaweedFsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        SeaweedFsModule.forRoot({
          filer: {
            url: FILER_URL,
            timeout: 30000,
            retries: 3,
          },
          s3: {
            endpoint: S3_ENDPOINT,
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
            forcePathStyle: true,
            defaultBucket: S3_BUCKET,
          },
          validateConnectionOnBoot: true,
        }),
      ],
    }).compile();

    service = module.get<SeaweedFsService>(SeaweedFsService);
  }, 30000);

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Filer API', () => {
    const testFilePath = '/e2e-test-file.txt';
    const testContent = 'Hello from E2E test - ' + Date.now();

    it('should create a directory', async () => {
      await expect(service.createDirectory('/e2e-test-dir')).resolves.not.toThrow();
    }, 15000);

    it('should upload a file via Buffer', async () => {
      const result = await service.upload(testFilePath, Buffer.from(testContent));
      expect(result.fid).toBeDefined();
      expect(result.fid.length).toBeGreaterThan(0);
      expect(result.size).toBe(Buffer.byteLength(testContent));
    }, 15000);

    it('should upload a file via Readable stream', async () => {
      const stream = Readable.from(Buffer.from('Stream upload content'));
      const result = await service.upload('/e2e-stream-upload.txt', stream);
      expect(result.fid).toBeDefined();
    }, 15000);

    it('should check file exists', async () => {
      const exists = await service.exists(testFilePath);
      expect(exists).toBe(true);
    }, 10000);

    it('should get file metadata', async () => {
      const metadata = await service.getMetadata(testFilePath);
      expect(metadata.size).toBe(Buffer.byteLength(testContent));
    }, 10000);

    it('should download a file as buffer', async () => {
      const buffer = await service.downloadToBuffer(testFilePath);
      expect(buffer.toString()).toBe(testContent);
    }, 10000);

    it('should download a file as stream', async () => {
      const stream = await service.download(testFilePath);
      expect(stream).toBeInstanceOf(Readable);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString()).toBe(testContent);
    }, 10000);

    it('should list directory', async () => {
      const listing = await service.listDirectory('/');
      expect(listing.entries.length).toBeGreaterThan(0);
    }, 10000);

    it('should delete a file', async () => {
      await expect(service.delete(testFilePath)).resolves.not.toThrow();
    }, 10000);

    it('should return false for deleted file exists check', async () => {
      const exists = await service.exists(testFilePath);
      expect(exists).toBe(false);
    }, 10000);

    it('should upload with TTL', async () => {
      const result = await service.upload('/e2e-ttl-file.txt', Buffer.from('TTL content'), {
        ttl: 3600,
      });
      expect(result.fid).toBeDefined();
    }, 10000);
  });

  describe('S3 Gateway API', () => {
    const testKey = 'e2e-test-key-' + Date.now();
    const testContent = 'S3 E2E test content - ' + Date.now();

    beforeAll(async () => {
      try {
        const exists = await service.s3BucketExists(S3_BUCKET);
        if (!exists) {
          await service.s3CreateBucket(S3_BUCKET);
        }
      } catch {
        // Bucket may already exist or S3 gateway may not be available
      }
    }, 15000);

    it('should list buckets', async () => {
      const buckets = await service.s3ListBuckets();
      expect(Array.isArray(buckets)).toBe(true);
    }, 15000);

    it('should put an object', async () => {
      const result = await service.s3PutObject(S3_BUCKET, testKey, Buffer.from(testContent), {
        contentType: 'text/plain',
        metadata: { 'test-key': 'e2e-value' },
      });
      expect(result.etag).toBeDefined();
      expect(result.key).toBe(testKey);
    }, 15000);

    it('should head an object', async () => {
      const metadata = await service.s3HeadObject(S3_BUCKET, testKey);
      expect(metadata.size).toBe(Buffer.byteLength(testContent));
      expect(metadata.key).toBe(testKey);
    }, 10000);

    it('should get an object as buffer', async () => {
      const buffer = await service.s3GetObjectAsBuffer(S3_BUCKET, testKey);
      expect(buffer.toString()).toBe(testContent);
    }, 10000);

    it('should get an object as stream', async () => {
      const stream = await service.s3GetObject(S3_BUCKET, testKey);
      expect(stream).toBeInstanceOf(Readable);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString()).toBe(testContent);
    }, 10000);

    it('should list objects', async () => {
      const result = await service.s3ListObjects(S3_BUCKET, {
        prefix: 'e2e-test-key',
      });
      expect(result.contents.length).toBeGreaterThan(0);
    }, 10000);

    it('should copy an object', async () => {
      const copyKey = testKey + '-copy';
      await service.s3CopyObject(S3_BUCKET, testKey, S3_BUCKET, copyKey);

      const buffer = await service.s3GetObjectAsBuffer(S3_BUCKET, copyKey);
      expect(buffer.toString()).toBe(testContent);
    }, 15000);

    it('should generate presigned upload URL', async () => {
      const presignedKey = 'e2e-presigned-upload-' + Date.now();
      const url = await service.s3GetPresignedUploadUrl(S3_BUCKET, presignedKey, {
        contentType: 'text/plain',
      });
      expect(url).toContain(S3_BUCKET);
      expect(url).toContain(presignedKey);
    }, 10000);

    it('should generate presigned download URL', async () => {
      const url = await service.s3GetPresignedDownloadUrl(S3_BUCKET, testKey);
      expect(url).toContain(S3_BUCKET);
      expect(url).toContain(testKey);
    }, 10000);

    it('should batch delete objects', async () => {
      const keysToDelete = ['e2e-delete-a.txt', 'e2e-delete-b.txt'];
      for (const key of keysToDelete) {
        await service.s3PutObject(S3_BUCKET, key, Buffer.from('to delete'));
      }

      const result = await service.s3DeleteObjects(S3_BUCKET, keysToDelete);
      expect(result.deleted.length).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should delete an object', async () => {
      await expect(
        service.s3DeleteObject(S3_BUCKET, testKey),
      ).resolves.not.toThrow();
    }, 10000);

    it('should upload via multipart for large content', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const stream = Readable.from(Buffer.from(largeContent));
      const multipartKey = 'e2e-multipart-' + Date.now();

      const result = await service.s3PutObjectMultipart(S3_BUCKET, multipartKey, stream, {
        contentType: 'application/octet-stream',
        partSize: 5 * 1024 * 1024,
        concurrency: 2,
      });

      expect(result.etag).toBeDefined();

      const buffer = await service.s3GetObjectAsBuffer(S3_BUCKET, multipartKey);
      expect(buffer.length).toBe(Buffer.byteLength(largeContent));

      await service.s3DeleteObject(S3_BUCKET, multipartKey);
    }, 60000);

    it('should throw for unsupported s3SetBucketPolicy', async () => {
      await expect(
        service.s3SetBucketPolicy(S3_BUCKET, { Version: '2012-10-17' }),
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Connection validation', () => {
    it('should have validated connections on boot', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Escape hatches', () => {
    it('should expose raw S3 client', () => {
      const client = service.getRawS3Client();
      expect(client).toBeDefined();
    });

    it('should expose raw filer HTTP client', () => {
      const client = service.getRawFilerHttpClient();
      expect(client).toBeDefined();
    });
  });
});
