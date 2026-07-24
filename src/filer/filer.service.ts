import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Readable } from 'stream';
import {
  SeaweedFsModuleOptions,
  UploadOptions,
  UploadResult,
  FileMetadata,
  DirectoryListing,
  DirectoryEntry,
  AssignVolumeResult,
} from '../interfaces';
import {
  SeaweedFsConnectionError,
  SeaweedFsNotFoundError,
  SeaweedFsUploadError,
  SeaweedFsException,
} from '../errors';
import { DEFAULT_FILER_TIMEOUT, DEFAULT_FILER_RETRIES } from '../constants';

@Injectable()
export class SeaweedFsFilerService implements OnModuleInit {
  private readonly logger = new Logger(SeaweedFsFilerService.name);
  private httpClient!: AxiosInstance;
  private readonly filerUrl: string;
  private readonly masterUrl?: string;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(private readonly options: SeaweedFsModuleOptions) {
    this.filerUrl = options.filer.url.replace(/\/+$/, '');
    this.masterUrl = options.masterUrl?.replace(/\/+$/, '');
    this.timeout = options.filer.timeout ?? DEFAULT_FILER_TIMEOUT;
    this.retries = options.filer.retries ?? DEFAULT_FILER_RETRIES;
  }

  async onModuleInit(): Promise<void> {
    this.httpClient = axios.create({
      baseURL: this.filerUrl,
      timeout: this.timeout,
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...this.buildAuthHeaders(),
      },
      ...this.buildAuthConfig(),
    });

    if (this.options.validateConnectionOnBoot !== false) {
      await this.validateConnection();
    }
  }

  private buildAuthConfig(): Partial<{ auth: { username: string; password: string } }> {
    const auth = this.options.filer.auth;
    if (auth?.type === 'basic') {
      return { auth: { username: auth.username, password: auth.password } };
    }
    return {};
  }

  private buildAuthHeaders(): Record<string, string> {
    const auth = this.options.filer.auth;
    if (!auth) return {};
    switch (auth.type) {
      case 'basic':
        return {};
      case 'bearer':
        return { Authorization: `Bearer ${auth.token}` };
      case 'header':
        return { [auth.name]: auth.value };
      default:
        const _exhaustive: never = auth;
        return _exhaustive;
    }
  }

  private async validateConnection(): Promise<void> {
    try {
      await this.httpClient.get('/', {
        headers: { Accept: 'application/json', 'Content-Type': 'application/octet-stream' },
      });
      this.logger.log('Filer connection validated successfully');
    } catch (error) {
      throw new SeaweedFsConnectionError(
        'filer',
        `Failed to connect to Filer at ${this.filerUrl}`,
        error instanceof Error ? error : undefined,
      );
    }
  }
  private async requestWithRetry<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    config?: Record<string, unknown>,
    attempt = 1,
  ): Promise<T> {
    try {
      const response = await this.httpClient.request<T>({
        method,
        url,
        ...config,
      });
      return response.data;
    } catch (error) {
      if (this.isRetryable(error) && attempt < this.retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.warn(
          `Retryable error on ${method.toUpperCase()} ${url} (attempt ${attempt}/${this.retries}), waiting ${delay}ms`,
        );
        await this.sleep(delay);
        return this.requestWithRetry<T>(method, url, config, attempt + 1);
      }
      throw this.wrapError(error, url);
    }
  }

  private isRetryable(error: unknown): boolean {
    const status = this.extractResponseStatus(error);
    if (!status) return true;
    return status === 429 || status === 503 || status === 504;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private wrapError(error: unknown, url: string): SeaweedFsException {
    if (error instanceof SeaweedFsException) return error;
    const status = this.extractResponseStatus(error);
    if (status === 404) {
      return new SeaweedFsNotFoundError(url);
    }
    if (error instanceof AxiosError) {
      return new SeaweedFsException(`Filer request failed: ${error.message}`, error);
    }
    return new SeaweedFsException(
      `Filer request failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }

  async upload(
    filePath: string,
    file: Buffer | Readable,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const headers: Record<string, string> = { ...options?.headers };
    if (options?.ttl !== undefined) headers['Seaweed-TTL'] = String(options.ttl);
    if (options?.replication) headers['Seaweed-Replication'] = options.replication;
    if (options?.collection) headers['Seaweed-Collection'] = options.collection;

    try {
      const data = Buffer.isBuffer(file) ? file : await this.streamToBuffer(file);
      const response = await this.httpClient.post(`/submit`, data, {
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': data.length,
        },
        params: { output: 'json' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const result = response.data as Record<string, unknown>;
      const fid = (result.fid as string) || '';
      const fileUrl = (result.url as string) || '';

      return {
        fid,
        url: fileUrl,
        size: data.length,
        etag: (result.etag as string) || undefined,
      };
    } catch (error) {
      if (error instanceof SeaweedFsException) throw error;
      throw new SeaweedFsUploadError(
        filePath,
        'Failed to upload via filer submit endpoint',
        error instanceof Error ? error : undefined,
      );
    }
  }

  async uploadMultiple(
    files: { path: string; file: Buffer | Readable }[],
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const item of files) {
      results.push(await this.upload(item.path, item.file));
    }
    return results;
  }

  async download(path: string): Promise<Readable> {
    const encodedPath = this.encodePath(path);
    try {
      const response = await this.httpClient.get(`/` + encodedPath, {
        responseType: 'stream',
      });
      return response.data as Readable;
    } catch (error) {
      const status = this.extractResponseStatus(error);
      if (status === 404) {
        throw new SeaweedFsNotFoundError(path);
      }
      throw this.wrapError(error, path);
    }
  }

  async downloadToBuffer(path: string): Promise<Buffer> {
    const encodedPath = this.encodePath(path);
    try {
      const response = await this.httpClient.get(`/` + encodedPath, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      const status = this.extractResponseStatus(error);
      if (status === 404) {
        throw new SeaweedFsNotFoundError(path);
      }
      throw this.wrapError(error, path);
    }
  }

  private extractResponseStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      return response?.status;
    }
    return undefined;
  }

  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    const encodedPath = this.encodePath(path);
    const params: Record<string, string> = {};
    if (options?.recursive) params.recursive = 'true';
    await this.requestWithRetry('delete', `/${encodedPath}`, { params });
  }

  async exists(path: string): Promise<boolean> {
    const encodedPath = this.encodePath(path);
    try {
      const result = await this.requestWithRetry<{ name: string; path: string }>(
        'get',
        `/` + encodedPath,
      );
      return !!result;
    } catch (error) {
      if (error instanceof SeaweedFsNotFoundError) return false;
      throw error;
    }
  }

  async getMetadata(path: string): Promise<FileMetadata> {
    const encodedPath = this.encodePath(path);
    try {
      const result = await this.requestWithRetry<FileMetadata>('get', `/` + encodedPath);
      return {
        name: result.name || path.split('/').pop() || '',
        path: result.path || path,
        size: result.size || 0,
        mimeType: result.mimeType || 'application/octet-stream',
        md5: result.md5,
        headers: result.headers || {},
        chunks: result.chunks,
        modifiedTime: result.modifiedTime,
        expireAt: result.expireAt,
      };
    } catch (error) {
      if (error instanceof SeaweedFsNotFoundError) throw error;
      throw this.wrapError(error, path);
    }
  }

  async listDirectory(
    path: string,
    options?: { limit?: number; lastFileName?: string; namePattern?: string },
  ): Promise<DirectoryListing> {
    const encodedPath = this.encodePath(path);
    const params: Record<string, string> = {};
    if (options?.limit) params.limit = String(options.limit);
    if (options?.lastFileName) params.lastFileName = options.lastFileName;
    if (options?.namePattern) params.namePattern = options.namePattern;

    try {
      const result = await this.requestWithRetry<Record<string, unknown>>(
        'get',
        `/` + encodedPath,
        { params },
      );

      const rawEntries = (result['Entries'] as Record<string, unknown>[] | undefined) ?? [];
      const entries: DirectoryEntry[] = rawEntries.map((entry: Record<string, unknown>) => ({
        name: (entry.name as string) ?? '',
        path: (entry.path as string) || `${path}/${entry.name}`,
        size: (entry.size as number) || 0,
        mimeType: (entry.mimeType as string) || 'application/octet-stream',
        isDirectory: entry.IsDirectory === true || entry.isDirectory === true,
        chunks: entry.chunks as number | undefined,
        modifiedTime: entry.modifiedTime as string | undefined,
      }));

      const subdirectories = (result['Subdirectories'] as string[] | undefined) ?? [];
      for (const sub of subdirectories) {
        entries.push({
          name: sub,
          path: `${path}/${sub}`,
          size: 0,
          mimeType: 'directory',
          isDirectory: true,
        });
      }

      const hasMore = entries.length > 0 && entries.length >= (options?.limit ?? 100);
      const nextFileName = hasMore ? entries[entries.length - 1]?.name : undefined;

      return { entries, hasMore, nextFileName };
    } catch (error) {
      if (error instanceof SeaweedFsNotFoundError) throw error;
      throw this.wrapError(error, path);
    }
  }

  async createDirectory(path: string): Promise<void> {
    const encodedPath = this.encodePath(path);
    await this.requestWithRetry('post', `/` + encodedPath);
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    await this.delete(path, { recursive });
  }

  async assignVolume(): Promise<AssignVolumeResult> {
    if (!this.masterUrl) {
      throw new SeaweedFsException('masterUrl is not configured; cannot assign volume');
    }
    try {
      const masterClient = axios.create({
        baseURL: this.masterUrl,
        timeout: this.timeout,
      });
      const response = await masterClient.get('/dir/assign');
      const data = response.data as Record<string, unknown>;
      return {
        fid: data.fid as string,
        volumeId: data.volumeId as string,
        url: data.url as string,
        publicUrl: data.publicUrl as string,
        count: (data.count as number) || 0,
      };
    } catch (error) {
      throw new SeaweedFsException(
        `Failed to assign volume: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  getRawHttpClient(): AxiosInstance {
    return this.httpClient;
  }

  private encodePath(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
