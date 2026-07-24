import { ModuleMetadata, Type } from '@nestjs/common';

export type SeaweedFsFilerAuth =
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'header'; name: string; value: string };
export interface SeaweedFsFilerOptions {
  url: string;
  timeout?: number;
  retries?: number;
  auth?: SeaweedFsFilerAuth;
}

export interface SeaweedFsS3Options {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  forcePathStyle?: boolean;
  defaultBucket?: string;
}

export interface SeaweedFsModuleOptions {
  filer: SeaweedFsFilerOptions;
  masterUrl?: string;
  s3: SeaweedFsS3Options;
  isGlobal?: boolean;
  validateConnectionOnBoot?: boolean;
}

export interface SeaweedFsModuleOptionsFactory {
  createSeaweedFsOptions(): Promise<SeaweedFsModuleOptions> | SeaweedFsModuleOptions;
}

export interface SeaweedFsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<SeaweedFsModuleOptionsFactory>;
  useClass?: Type<SeaweedFsModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<SeaweedFsModuleOptions> | SeaweedFsModuleOptions;
  inject?: (string | symbol | Type<unknown>)[];
}

export interface UploadOptions {
  headers?: Record<string, string>;
  ttl?: number;
  replication?: string;
  collection?: string;
}

export interface UploadResult {
  fid: string;
  url: string;
  size: number;
  etag?: string;
}

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  md5?: string;
  headers: Record<string, string>;
  chunks?: number;
  modifiedTime?: string;
  expireAt?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  isDirectory: boolean;
  chunks?: number;
  modifiedTime?: string;
}

export interface DirectoryListing {
  entries: DirectoryEntry[];
  hasMore: boolean;
  nextFileName?: string;
}

export interface AssignVolumeResult {
  fid: string;
  volumeId: string;
  url: string;
  publicUrl: string;
  count: number;
}

export interface S3PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface S3MultipartOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  partSize?: number;
  concurrency?: number;
  onProgress?: (event: S3ProgressEvent) => void;
}

export interface S3ProgressEvent {
  loaded: number;
  total: number;
  percentage: number;
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  etag: string;
  versionId?: string;
  location?: string;
}

export interface S3ObjectMetadata {
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
}

export interface S3ListResult {
  contents: S3ObjectInfo[];
  commonPrefixes: string[];
  isTruncated: boolean;
  continuationToken?: string;
  nextContinuationToken?: string;
  maxKeys: number;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass?: string;
}
