import { Readable } from 'stream';
import { SeaweedFsFilerService } from './filer.service';
import { SeaweedFsModuleOptions } from '../interfaces';
import {
  SeaweedFsConnectionError,
  SeaweedFsNotFoundError,
  SeaweedFsUploadError,
  SeaweedFsException,
} from '../errors';

const mockOptions: SeaweedFsModuleOptions = {
  filer: {
    url: 'http://localhost:8888',
    timeout: 5000,
    retries: 2,
  },
  masterUrl: 'http://localhost:9333',
  s3: {
    endpoint: 'http://localhost:8333',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  },
  validateConnectionOnBoot: false,
};

jest.mock('axios');
const axios = require('axios');

function createMockAxios() {
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  };
  axios.create = jest.fn(() => instance);
  return instance;
}

describe('SeaweedFsFilerService', () => {
  let service: SeaweedFsFilerService;
  let mockClient: ReturnType<typeof createMockAxios>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockAxios();
    service = new SeaweedFsFilerService(mockOptions);
    (service as unknown as { httpClient: typeof mockClient }).httpClient = mockClient;
  });

  describe('upload', () => {
    it('should upload a Buffer successfully', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { fid: '1,abc123', url: 'http://volume:8080/1,abc123' },
      });

      const result = await service.upload('test/file.txt', Buffer.from('hello'));

      expect(result.fid).toBe('1,abc123');
      expect(result.url).toBe('http://volume:8080/1,abc123');
      expect(result.size).toBe(5);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/submit',
        expect.any(Buffer),
        expect.objectContaining({
          params: { output: 'json' },
        }),
      );
    });

    it('should upload a Readable stream successfully', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { fid: '2,def456', url: 'http://volume:8080/2,def456' },
      });

      const stream = Readable.from(Buffer.from('stream data'));
      const result = await service.upload('test/stream.txt', stream);

      expect(result.fid).toBe('2,def456');
      expect(result.size).toBe(11);
    });

    it('should include Seaweed-TTL header when ttl is specified', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { fid: '3,ghi789', url: 'http://volume:8080/3,ghi789' },
      });

      await service.upload('test/ttl.txt', Buffer.from('ttl'), { ttl: 3600 });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/submit',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Seaweed-TTL': '3600',
          }),
        }),
      );
    });

    it('should include Seaweed-Replication header when replication is specified', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { fid: '4,jkl012', url: 'http://volume:8080/4,jkl012' },
      });

      await service.upload('test/repl.txt', Buffer.from('repl'), { replication: '001' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/submit',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Seaweed-Replication': '001',
          }),
        }),
      );
    });

    it('should include Seaweed-Collection header when collection is specified', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { fid: '5,mno345', url: 'http://volume:8080/5,mno345' },
      });

      await service.upload('test/coll.txt', Buffer.from('coll'), { collection: 'myCollection' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/submit',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Seaweed-Collection': 'myCollection',
          }),
        }),
      );
    });

    it('should throw SeaweedFsUploadError on upload failure', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('network error'));

      await expect(service.upload('test/fail.txt', Buffer.from('fail'))).rejects.toThrow(
        SeaweedFsUploadError,
      );
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files sequentially', async () => {
      mockClient.post
        .mockResolvedValueOnce({ data: { fid: '1,a', url: 'http://v/1,a' } })
        .mockResolvedValueOnce({ data: { fid: '2,b', url: 'http://v/2,b' } });

      const results = await service.uploadMultiple([
        { path: 'a.txt', file: Buffer.from('a') },
        { path: 'b.txt', file: Buffer.from('b') },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].fid).toBe('1,a');
      expect(results[1].fid).toBe('2,b');
    });
  });

  describe('download', () => {
    it('should download a file as a Readable stream', async () => {
      const mockStream = Readable.from(Buffer.from('file content'));
      mockClient.get.mockResolvedValueOnce({ data: mockStream });

      const result = await service.download('test/file.txt');

      expect(result).toBe(mockStream);
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('test'),
        expect.objectContaining({ responseType: 'stream' }),
      );
    });

    it('should throw SeaweedFsNotFoundError on 404', async () => {
      const error = new Error('Request failed with status code 404');
      Object.defineProperty(error, 'response', {
        value: { status: 404, data: null, headers: {}, config: {}, statusText: 'Not Found' },
      });
      Object.defineProperty(error, 'isAxiosError', { value: true });
      error.name = 'AxiosError';
      mockClient.get.mockRejectedValueOnce(error);

      await expect(service.download('test/missing.txt')).rejects.toThrow(SeaweedFsNotFoundError);
    });
  });

  describe('downloadToBuffer', () => {
    it('should download a file as a Buffer', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: new ArrayBuffer(11),
      });

      const result = await service.downloadToBuffer('test/file.txt');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw SeaweedFsNotFoundError on 404', async () => {
      const error = new Error('Request failed with status code 404');
      Object.defineProperty(error, 'response', {
        value: { status: 404, data: null, headers: {}, config: {}, statusText: 'Not Found' },
      });
      Object.defineProperty(error, 'isAxiosError', { value: true });
      error.name = 'AxiosError';
      mockClient.get.mockRejectedValueOnce(error);

      await expect(service.downloadToBuffer('test/missing.txt')).rejects.toThrow(
        SeaweedFsNotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      mockClient.request.mockResolvedValueOnce({ data: null });

      await service.delete('test/file.txt');

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
        }),
      );
    });

    it('should pass recursive option', async () => {
      mockClient.request.mockResolvedValueOnce({ data: null });

      await service.delete('test/dir', { recursive: true });

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { recursive: 'true' },
        }),
      );
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockClient.request.mockResolvedValueOnce({ data: { name: 'file.txt' } });

      const result = await service.exists('test/file.txt');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const error = new Error('Not Found') as import('axios').AxiosError;
      Object.defineProperty(error, 'response', {
        value: { status: 404, data: null, headers: {}, config: {} as never, statusText: '' },
      });
      mockClient.request.mockRejectedValueOnce(error);

      const result = await service.exists('test/missing.txt');

      expect(result).toBe(false);
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      mockClient.request.mockResolvedValueOnce({
        data: {
          Entries: [
            { name: 'file1.txt', size: 100, mimeType: 'text/plain' },
            { name: 'file2.txt', size: 200, mimeType: 'text/plain' },
          ],
          Subdirectories: ['subdir1'],
        },
      });

      const result = await service.listDirectory('test');

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].name).toBe('file1.txt');
      expect(result.entries[2].name).toBe('subdir1');
      expect(result.entries[2].isDirectory).toBe(true);
    });

    it('should handle pagination with limit and lastFileName', async () => {
      mockClient.request.mockResolvedValueOnce({
        data: {
          Entries: Array.from({ length: 10 }, (_, i) => ({
            name: `file${i}.txt`,
            size: 100,
            mimeType: 'text/plain',
          })),
        },
      });

      const result = await service.listDirectory('test', { limit: 10 });

      expect(result.hasMore).toBe(true);
      expect(result.nextFileName).toBe('file9.txt');
    });

    it('should return hasMore false when fewer items than limit', async () => {
      mockClient.request.mockResolvedValueOnce({
        data: {
          Entries: [{ name: 'file1.txt', size: 100, mimeType: 'text/plain' }],
        },
      });

      const result = await service.listDirectory('test', { limit: 10 });

      expect(result.hasMore).toBe(false);
    });
  });

  describe('createDirectory', () => {
    it('should create a directory', async () => {
      mockClient.request.mockResolvedValueOnce({ data: null });

      await service.createDirectory('test/newdir');

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
        }),
      );
    });
  });

  describe('deleteDirectory', () => {
    it('should delete a directory', async () => {
      mockClient.request.mockResolvedValueOnce({ data: null });

      await service.deleteDirectory('test/dir');

      expect(mockClient.request).toHaveBeenCalled();
    });

    it('should pass recursive flag', async () => {
      mockClient.request.mockResolvedValueOnce({ data: null });

      await service.deleteDirectory('test/dir', true);

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { recursive: 'true' },
        }),
      );
    });
  });

  describe('assignVolume', () => {
    it('should assign a volume via master server', async () => {
      const masterMock = { get: jest.fn() };
      axios.create.mockReturnValueOnce(masterMock);
      masterMock.get.mockResolvedValueOnce({
        data: {
          fid: '1,abc',
          volumeId: '1',
          url: 'http://v:8080',
          publicUrl: 'http://v:8080',
          count: 1,
        },
      });

      const result = await service.assignVolume();

      expect(result.fid).toBe('1,abc');
      expect(result.volumeId).toBe('1');
      expect(masterMock.get).toHaveBeenCalledWith('/dir/assign');
    });

    it('should throw when masterUrl is not configured', async () => {
      const noMasterService = new SeaweedFsFilerService({
        ...mockOptions,
        masterUrl: undefined,
      });

      await expect(noMasterService.assignVolume()).rejects.toThrow('masterUrl is not configured');
    });
  });

  describe('retry logic', () => {
    it('should retry on 503 errors', async () => {
      const error503 = new Error('Request failed with status code 503');
      Object.defineProperty(error503, 'response', {
        value: {
          status: 503,
          data: null,
          headers: {},
          config: {},
          statusText: 'Service Unavailable',
        },
      });
      Object.defineProperty(error503, 'isAxiosError', { value: true });
      error503.name = 'AxiosError';

      mockClient.request
        .mockRejectedValueOnce(error503)
        .mockResolvedValueOnce({ data: { Entries: [] } });

      const result = await service.listDirectory('test');

      expect(result.entries).toHaveLength(0);
      expect(mockClient.request).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      const error503 = new Error('Request failed with status code 503');
      Object.defineProperty(error503, 'response', {
        value: {
          status: 503,
          data: null,
          headers: {},
          config: {},
          statusText: 'Service Unavailable',
        },
      });
      Object.defineProperty(error503, 'isAxiosError', { value: true });
      error503.name = 'AxiosError';

      mockClient.request.mockRejectedValueOnce(error503).mockRejectedValueOnce(error503);

      await expect(service.listDirectory('test')).rejects.toThrow();
      expect(mockClient.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRawHttpClient', () => {
    it('should return the underlying axios client', () => {
      const client = service.getRawHttpClient();
      expect(client).toBe(mockClient);
    });
  });

  describe('getMetadata', () => {
    it('should return file metadata', async () => {
      mockClient.request.mockResolvedValueOnce({
        data: {
          name: 'test.txt',
          path: 'test/test.txt',
          size: 123,
          mimeType: 'text/plain',
          headers: { 'x-custom': 'value' },
        },
      });

      const result = await service.getMetadata('test/test.txt');

      expect(result.name).toBe('test.txt');
      expect(result.size).toBe(123);
      expect(result.mimeType).toBe('text/plain');
    });
  });
});
