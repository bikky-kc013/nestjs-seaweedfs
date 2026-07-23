import { Readable } from 'stream';
import { SeaweedFsS3Service } from './s3.service';
import { SeaweedFsModuleOptions } from '../interfaces';
import {
  SeaweedFsConnectionError,
  SeaweedFsS3Error,
  SeaweedFsUnsupportedOperationError,
} from '../errors';

const mockOptions: SeaweedFsModuleOptions = {
  filer: { url: 'http://localhost:8888' },
  s3: {
    endpoint: 'http://localhost:8333',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    region: 'us-east-1',
    forcePathStyle: true,
    defaultBucket: 'test-bucket',
  },
  validateConnectionOnBoot: false,
};

const mockSendFn = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSendFn,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectsCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ input })),
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CreateBucketCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteBucketCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadBucketCommand: jest.fn().mockImplementation((input) => ({ input })),
  ListBucketsCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutBucketPolicyCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: jest
      .fn()
      .mockResolvedValue({
        ETag: '"abc123"',
        VersionId: 'v1',
        Location: 'https://example.com/key',
      }),
    on: jest.fn(),
  })),
}));

describe('SeaweedFsS3Service', () => {
  let service: SeaweedFsS3Service;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendFn.mockReset();
    service = new SeaweedFsS3Service(mockOptions);
    await service.onModuleInit();
  });

  describe('s3PutObject', () => {
    it('should put an object successfully', async () => {
      mockSendFn.mockResolvedValueOnce({ ETag: '"etag123"', VersionId: 'v1' });

      const result = await service.s3PutObject('test-bucket', 'key.txt', Buffer.from('data'));

      expect(result.key).toBe('key.txt');
      expect(result.bucket).toBe('test-bucket');
      expect(result.etag).toBe('etag123');
      expect(result.versionId).toBe('v1');
    });

    it('should put an object with custom options', async () => {
      mockSendFn.mockResolvedValueOnce({ ETag: '"etag456"' });

      const result = await service.s3PutObject('test-bucket', 'key.txt', Buffer.from('data'), {
        contentType: 'text/plain',
        metadata: { custom: 'value' },
        acl: 'public-read',
      });

      expect(result.etag).toBe('etag456');
    });

    it('should use defaultBucket when no bucket specified', async () => {
      mockSendFn.mockResolvedValueOnce({ ETag: '"etag789"' });

      const result = await service.s3PutObject(undefined as never, 'key.txt', Buffer.from('data'));

      expect(result.bucket).toBe('test-bucket');
    });

    it('should throw when no bucket and no defaultBucket', async () => {
      const noDefaultService = new SeaweedFsS3Service({
        ...mockOptions,
        s3: { ...mockOptions.s3, defaultBucket: undefined },
      });
      await noDefaultService.onModuleInit();

      await expect(
        noDefaultService.s3PutObject(undefined as never, 'key.txt', Buffer.from('data')),
      ).rejects.toThrow(SeaweedFsS3Error);
    });

    it('should wrap S3 errors properly', async () => {
      const s3Error = new Error('Access Denied');
      s3Error.name = 'AccessDenied';
      mockSendFn.mockRejectedValueOnce(s3Error);

      await expect(
        service.s3PutObject('test-bucket', 'key.txt', Buffer.from('data')),
      ).rejects.toThrow(SeaweedFsS3Error);
    });
  });

  describe('s3PutObjectMultipart', () => {
    it('should upload via multipart successfully', async () => {
      const stream = Readable.from(Buffer.from('multipart data'));

      const result = await service.s3PutObjectMultipart('test-bucket', 'large.bin', stream);

      expect(result.key).toBe('large.bin');
      expect(result.etag).toBe('abc123');
    });

    it('should call onProgress callback', async () => {
      const { Upload } = require('@aws-sdk/lib-storage');
      const mockOn = jest.fn();
      Upload.mockImplementationOnce(() => ({
        done: jest.fn().mockResolvedValue({ ETag: '"abc"' }),
        on: mockOn,
      }));

      const onProgress = jest.fn();
      const stream = Readable.from(Buffer.from('data'));

      await service.s3PutObjectMultipart('test-bucket', 'large.bin', stream, {
        onProgress,
        partSize: 5 * 1024 * 1024,
        concurrency: 2,
      });

      expect(mockOn).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
    });
  });

  describe('s3GetObject', () => {
    it('should get an object as a stream', async () => {
      const mockBody = Readable.from(Buffer.from('content'));
      mockSendFn.mockResolvedValueOnce({ Body: mockBody });

      const result = await service.s3GetObject('test-bucket', 'key.txt');

      expect(result).toBe(mockBody);
    });

    it('should throw when body is empty', async () => {
      mockSendFn.mockResolvedValueOnce({});

      await expect(service.s3GetObject('test-bucket', 'key.txt')).rejects.toThrow(SeaweedFsS3Error);
    });

    it('should wrap errors properly', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      mockSendFn.mockRejectedValueOnce(error);

      await expect(service.s3GetObject('test-bucket', 'missing.txt')).rejects.toThrow(
        SeaweedFsS3Error,
      );
    });
  });

  describe('s3GetObjectAsBuffer', () => {
    it('should get an object as a buffer', async () => {
      const mockBody = Readable.from(Buffer.from('content'));
      mockSendFn.mockResolvedValueOnce({ Body: mockBody });

      const result = await service.s3GetObjectAsBuffer('test-bucket', 'key.txt');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('content');
    });
  });

  describe('s3DeleteObject', () => {
    it('should delete an object', async () => {
      mockSendFn.mockResolvedValueOnce({});

      await service.s3DeleteObject('test-bucket', 'key.txt');

      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should wrap errors', async () => {
      const error = new Error('Access Denied');
      mockSendFn.mockRejectedValueOnce(error);

      await expect(service.s3DeleteObject('test-bucket', 'key.txt')).rejects.toThrow(
        SeaweedFsS3Error,
      );
    });
  });

  describe('s3DeleteObjects', () => {
    it('should batch delete objects', async () => {
      mockSendFn.mockResolvedValueOnce({
        Deleted: [{ Key: 'a.txt' }, { Key: 'b.txt' }],
        Errors: [{ Key: 'c.txt', Message: 'Access Denied' }],
      });

      const result = await service.s3DeleteObjects('test-bucket', ['a.txt', 'b.txt', 'c.txt']);

      expect(result.deleted).toEqual(['a.txt', 'b.txt']);
      expect(result.errors).toEqual([{ key: 'c.txt', error: 'Access Denied' }]);
    });

    it('should handle empty keys array', async () => {
      const result = await service.s3DeleteObjects('test-bucket', []);

      expect(result.deleted).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockSendFn).not.toHaveBeenCalled();
    });
  });

  describe('s3HeadObject', () => {
    it('should get object metadata', async () => {
      mockSendFn.mockResolvedValueOnce({
        ContentLength: 1024,
        ContentType: 'text/plain',
        LastModified: new Date('2024-01-01'),
        ETag: '"abc123"',
        Metadata: { custom: 'value' },
      });

      const result = await service.s3HeadObject('test-bucket', 'key.txt');

      expect(result.key).toBe('key.txt');
      expect(result.size).toBe(1024);
      expect(result.contentType).toBe('text/plain');
      expect(result.etag).toBe('abc123');
    });
  });

  describe('s3ListObjects', () => {
    it('should list objects with pagination', async () => {
      mockSendFn.mockResolvedValueOnce({
        Contents: [
          { Key: 'a.txt', Size: 100, LastModified: new Date(), ETag: '"a"' },
          { Key: 'b.txt', Size: 200, LastModified: new Date(), ETag: '"b"' },
        ],
        CommonPrefixes: [{ Prefix: 'dir/' }],
        IsTruncated: true,
        NextContinuationToken: 'token123',
      });

      const result = await service.s3ListObjects('test-bucket', {
        prefix: 'test/',
        maxKeys: 10,
      });

      expect(result.contents).toHaveLength(2);
      expect(result.commonPrefixes).toEqual(['dir/']);
      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe('token123');
    });

    it('should list objects without pagination', async () => {
      mockSendFn.mockResolvedValueOnce({
        Contents: [{ Key: 'a.txt', Size: 100, LastModified: new Date(), ETag: '"a"' }],
        IsTruncated: false,
      });

      const result = await service.s3ListObjects('test-bucket');

      expect(result.isTruncated).toBe(false);
      expect(result.maxKeys).toBe(1000);
    });
  });

  describe('s3CopyObject', () => {
    it('should copy an object', async () => {
      mockSendFn.mockResolvedValueOnce({});

      await service.s3CopyObject('src-bucket', 'src.txt', 'dest-bucket', 'dest.txt');

      expect(mockSendFn).toHaveBeenCalled();
    });
  });

  describe('s3CreateBucket', () => {
    it('should create a bucket', async () => {
      mockSendFn.mockResolvedValueOnce({});

      await service.s3CreateBucket('new-bucket');

      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should wrap errors', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('BucketAlreadyExists'));

      await expect(service.s3CreateBucket('new-bucket')).rejects.toThrow(SeaweedFsS3Error);
    });
  });

  describe('s3DeleteBucket', () => {
    it('should delete a bucket', async () => {
      mockSendFn.mockResolvedValueOnce({});

      await service.s3DeleteBucket('old-bucket');

      expect(mockSendFn).toHaveBeenCalled();
    });
  });

  describe('s3BucketExists', () => {
    it('should return true when bucket exists', async () => {
      mockSendFn.mockResolvedValueOnce({});

      const result = await service.s3BucketExists('existing-bucket');

      expect(result).toBe(true);
    });

    it('should return false when bucket does not exist', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('NotFound'));

      const result = await service.s3BucketExists('missing-bucket');

      expect(result).toBe(false);
    });
  });

  describe('s3ListBuckets', () => {
    it('should list all buckets', async () => {
      mockSendFn.mockResolvedValueOnce({
        Buckets: [{ Name: 'bucket1' }, { Name: 'bucket2' }],
      });

      const result = await service.s3ListBuckets();

      expect(result).toEqual(['bucket1', 'bucket2']);
    });

    it('should wrap errors', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('AccessDenied'));

      await expect(service.s3ListBuckets()).rejects.toThrow(SeaweedFsS3Error);
    });
  });

  describe('s3GetPresignedUploadUrl', () => {
    it('should generate a presigned upload URL', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValueOnce('https://presigned-upload.example.com');

      const url = await service.s3GetPresignedUploadUrl('test-bucket', 'key.txt');

      expect(url).toBe('https://presigned-upload.example.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should accept custom expiresIn and contentType', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValueOnce('https://presigned.example.com');

      await service.s3GetPresignedUploadUrl('test-bucket', 'key.txt', {
        expiresIn: 600,
        contentType: 'image/png',
      });

      expect(getSignedUrl).toHaveBeenCalled();
    });
  });

  describe('s3GetPresignedDownloadUrl', () => {
    it('should generate a presigned download URL', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValueOnce('https://presigned-download.example.com');

      const url = await service.s3GetPresignedDownloadUrl('test-bucket', 'key.txt');

      expect(url).toBe('https://presigned-download.example.com');
    });
  });

  describe('s3SetBucketPolicy', () => {
    it('should throw SeaweedFsUnsupportedOperationError', async () => {
      await expect(
        service.s3SetBucketPolicy('test-bucket', { Version: '2012-10-17' }),
      ).rejects.toThrow(SeaweedFsUnsupportedOperationError);
    });
  });

  describe('getRawS3Client', () => {
    it('should return the S3Client instance', () => {
      const client = service.getRawS3Client();
      expect(client).toBeDefined();
    });
  });

  describe('validateConnectionOnBoot', () => {
    it('should validate connection when enabled', async () => {
      mockSendFn.mockResolvedValueOnce({ Buckets: [] });

      const validateService = new SeaweedFsS3Service({
        ...mockOptions,
        validateConnectionOnBoot: true,
      });

      await validateService.onModuleInit();
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should throw SeaweedFsConnectionError when validation fails', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('Connection refused'));

      const validateService = new SeaweedFsS3Service({
        ...mockOptions,
        validateConnectionOnBoot: true,
      });

      await expect(validateService.onModuleInit()).rejects.toThrow(SeaweedFsConnectionError);
    });
  });
});
