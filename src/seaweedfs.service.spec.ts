import { Readable } from 'stream';
import { SeaweedFsService } from './seaweedfs.service';
import { SeaweedFsFilerService } from './filer/filer.service';
import { SeaweedFsS3Service } from './s3/s3.service';
import { SeaweedFsUnsupportedOperationError } from './errors';

jest.mock('./filer/filer.service');
jest.mock('./s3/s3.service');

describe('SeaweedFsService', () => {
  let service: SeaweedFsService;
  let mockFilerService: jest.Mocked<SeaweedFsFilerService>;
  let mockS3Service: jest.Mocked<SeaweedFsS3Service>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFilerService = new SeaweedFsFilerService(null!) as jest.Mocked<SeaweedFsFilerService>;
    mockS3Service = new SeaweedFsS3Service(null!) as jest.Mocked<SeaweedFsS3Service>;
    service = new SeaweedFsService(mockFilerService, mockS3Service);
  });

  describe('Filer API delegation', () => {
    it('should delegate upload to filerService', async () => {
      mockFilerService.upload.mockResolvedValueOnce({
        fid: '1,abc',
        url: 'http://v/1,abc',
        size: 100,
      });

      const result = await service.upload('test.txt', Buffer.from('data'), { ttl: 3600 });

      expect(mockFilerService.upload).toHaveBeenCalledWith('test.txt', expect.any(Buffer), {
        ttl: 3600,
      });
      expect(result.fid).toBe('1,abc');
    });

    it('should delegate uploadMultiple to filerService', async () => {
      mockFilerService.uploadMultiple.mockResolvedValueOnce([
        { fid: '1,a', url: 'http://v/1,a', size: 10 },
        { fid: '2,b', url: 'http://v/2,b', size: 20 },
      ]);

      const results = await service.uploadMultiple([
        { path: 'a.txt', file: Buffer.from('a') },
        { path: 'b.txt', file: Buffer.from('b') },
      ]);

      expect(results).toHaveLength(2);
    });

    it('should delegate download to filerService', async () => {
      const mockStream = Readable.from(Buffer.from('data'));
      mockFilerService.download.mockResolvedValueOnce(mockStream);

      const result = await service.download('test.txt');

      expect(result).toBe(mockStream);
    });

    it('should delegate downloadToBuffer to filerService', async () => {
      mockFilerService.downloadToBuffer.mockResolvedValueOnce(Buffer.from('data'));

      const result = await service.downloadToBuffer('test.txt');

      expect(result.toString()).toBe('data');
    });

    it('should delegate delete to filerService', async () => {
      mockFilerService.delete.mockResolvedValueOnce(undefined);

      await service.delete('test.txt', { recursive: true });

      expect(mockFilerService.delete).toHaveBeenCalledWith('test.txt', { recursive: true });
    });

    it('should delegate exists to filerService', async () => {
      mockFilerService.exists.mockResolvedValueOnce(true);

      const result = await service.exists('test.txt');

      expect(result).toBe(true);
    });

    it('should delegate getMetadata to filerService', async () => {
      mockFilerService.getMetadata.mockResolvedValueOnce({
        name: 'test.txt',
        path: 'test.txt',
        size: 100,
        mimeType: 'text/plain',
        headers: {},
      });

      const result = await service.getMetadata('test.txt');

      expect(result.size).toBe(100);
    });

    it('should delegate listDirectory to filerService', async () => {
      mockFilerService.listDirectory.mockResolvedValueOnce({
        entries: [],
        hasMore: false,
      });

      const result = await service.listDirectory('test/', { limit: 10 });

      expect(mockFilerService.listDirectory).toHaveBeenCalledWith('test/', { limit: 10 });
    });

    it('should delegate createDirectory to filerService', async () => {
      mockFilerService.createDirectory.mockResolvedValueOnce(undefined);

      await service.createDirectory('newdir');

      expect(mockFilerService.createDirectory).toHaveBeenCalledWith('newdir');
    });

    it('should delegate deleteDirectory to filerService', async () => {
      mockFilerService.deleteDirectory.mockResolvedValueOnce(undefined);

      await service.deleteDirectory('dir', true);

      expect(mockFilerService.deleteDirectory).toHaveBeenCalledWith('dir', true);
    });

    it('should delegate assignVolume to filerService', async () => {
      mockFilerService.assignVolume.mockResolvedValueOnce({
        fid: '1,abc',
        volumeId: '1',
        url: 'http://v:8080',
        publicUrl: 'http://v:8080',
        count: 1,
      });

      const result = await service.assignVolume();

      expect(result.fid).toBe('1,abc');
    });
  });

  describe('S3 API delegation', () => {
    it('should delegate s3PutObject to s3Service', async () => {
      mockS3Service.s3PutObject.mockResolvedValueOnce({
        key: 'key.txt',
        bucket: 'bucket',
        etag: 'abc',
      });

      const result = await service.s3PutObject('bucket', 'key.txt', Buffer.from('data'));

      expect(mockS3Service.s3PutObject).toHaveBeenCalled();
      expect(result.etag).toBe('abc');
    });

    it('should delegate s3PutObjectMultipart to s3Service', async () => {
      mockS3Service.s3PutObjectMultipart.mockResolvedValueOnce({
        key: 'large.bin',
        bucket: 'bucket',
        etag: 'def',
      });

      const stream = Readable.from(Buffer.from('data'));
      const result = await service.s3PutObjectMultipart('bucket', 'large.bin', stream, {
        partSize: 10 * 1024 * 1024,
      });

      expect(result.etag).toBe('def');
    });

    it('should delegate s3GetObject to s3Service', async () => {
      const mockStream = Readable.from(Buffer.from('data'));
      mockS3Service.s3GetObject.mockResolvedValueOnce(mockStream);

      const result = await service.s3GetObject('bucket', 'key.txt');

      expect(result).toBe(mockStream);
    });

    it('should delegate s3GetObjectAsBuffer to s3Service', async () => {
      mockS3Service.s3GetObjectAsBuffer.mockResolvedValueOnce(Buffer.from('data'));

      const result = await service.s3GetObjectAsBuffer('bucket', 'key.txt');

      expect(result.toString()).toBe('data');
    });

    it('should delegate s3DeleteObject to s3Service', async () => {
      mockS3Service.s3DeleteObject.mockResolvedValueOnce(undefined);

      await service.s3DeleteObject('bucket', 'key.txt');

      expect(mockS3Service.s3DeleteObject).toHaveBeenCalledWith('bucket', 'key.txt');
    });

    it('should delegate s3DeleteObjects to s3Service', async () => {
      mockS3Service.s3DeleteObjects.mockResolvedValueOnce({
        deleted: ['a.txt'],
        errors: [{ key: 'b.txt', error: 'Access Denied' }],
      });

      const result = await service.s3DeleteObjects('bucket', ['a.txt', 'b.txt']);

      expect(result.deleted).toEqual(['a.txt']);
      expect(result.errors).toHaveLength(1);
    });

    it('should delegate s3HeadObject to s3Service', async () => {
      mockS3Service.s3HeadObject.mockResolvedValueOnce({
        key: 'key.txt',
        bucket: 'bucket',
        size: 100,
        contentType: 'text/plain',
        lastModified: new Date(),
        etag: 'abc',
      });

      const result = await service.s3HeadObject('bucket', 'key.txt');

      expect(result.size).toBe(100);
    });

    it('should delegate s3ListObjects to s3Service', async () => {
      mockS3Service.s3ListObjects.mockResolvedValueOnce({
        contents: [],
        commonPrefixes: [],
        isTruncated: false,
        maxKeys: 1000,
      });

      const result = await service.s3ListObjects('bucket', { prefix: 'test/' });

      expect(result.isTruncated).toBe(false);
    });

    it('should delegate s3CopyObject to s3Service', async () => {
      mockS3Service.s3CopyObject.mockResolvedValueOnce(undefined);

      await service.s3CopyObject('src', 'src.txt', 'dest', 'dest.txt');

      expect(mockS3Service.s3CopyObject).toHaveBeenCalledWith('src', 'src.txt', 'dest', 'dest.txt');
    });

    it('should delegate s3CreateBucket to s3Service', async () => {
      mockS3Service.s3CreateBucket.mockResolvedValueOnce(undefined);

      await service.s3CreateBucket('new-bucket');

      expect(mockS3Service.s3CreateBucket).toHaveBeenCalledWith('new-bucket');
    });

    it('should delegate s3DeleteBucket to s3Service', async () => {
      mockS3Service.s3DeleteBucket.mockResolvedValueOnce(undefined);

      await service.s3DeleteBucket('old-bucket');

      expect(mockS3Service.s3DeleteBucket).toHaveBeenCalledWith('old-bucket');
    });

    it('should delegate s3BucketExists to s3Service', async () => {
      mockS3Service.s3BucketExists.mockResolvedValueOnce(true);

      const result = await service.s3BucketExists('bucket');

      expect(result).toBe(true);
    });

    it('should delegate s3ListBuckets to s3Service', async () => {
      mockS3Service.s3ListBuckets.mockResolvedValueOnce(['b1', 'b2']);

      const result = await service.s3ListBuckets();

      expect(result).toEqual(['b1', 'b2']);
    });

    it('should delegate s3GetPresignedUploadUrl to s3Service', async () => {
      mockS3Service.s3GetPresignedUploadUrl.mockResolvedValueOnce('https://presigned.example.com');

      const url = await service.s3GetPresignedUploadUrl('bucket', 'key.txt');

      expect(url).toBe('https://presigned.example.com');
    });

    it('should delegate s3GetPresignedDownloadUrl to s3Service', async () => {
      mockS3Service.s3GetPresignedDownloadUrl.mockResolvedValueOnce(
        'https://presigned-download.example.com',
      );

      const url = await service.s3GetPresignedDownloadUrl('bucket', 'key.txt');

      expect(url).toBe('https://presigned-download.example.com');
    });

    it('should delegate s3SetBucketPolicy and throw unsupported', async () => {
      mockS3Service.s3SetBucketPolicy.mockRejectedValueOnce(
        new SeaweedFsUnsupportedOperationError('s3SetBucketPolicy', 'Not supported'),
      );

      await expect(service.s3SetBucketPolicy('bucket', { Version: '2012-10-17' })).rejects.toThrow(
        SeaweedFsUnsupportedOperationError,
      );
    });
  });

  describe('Escape hatches', () => {
    it('should expose getRawS3Client', () => {
      const mockClient = {} as never;
      mockS3Service.getRawS3Client.mockReturnValueOnce(mockClient);

      const result = service.getRawS3Client();

      expect(result).toBe(mockClient);
    });

    it('should expose getRawFilerHttpClient', () => {
      const mockClient = {} as never;
      mockFilerService.getRawHttpClient.mockReturnValueOnce(mockClient);

      const result = service.getRawFilerHttpClient();

      expect(result).toBe(mockClient);
    });
  });
});
