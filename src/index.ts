export { SeaweedFsModule } from './seaweedfs.module';
export { SeaweedFsService } from './seaweedfs.service';
export { SeaweedFsFilerService } from './filer/filer.service';
export { SeaweedFsS3Service } from './s3/s3.service';

export {
  SeaweedFsModuleOptions,
  SeaweedFsModuleAsyncOptions,
  SeaweedFsModuleOptionsFactory,
  SeaweedFsFilerOptions,
  SeaweedFsS3Options,
  UploadOptions,
  UploadResult,
  FileMetadata,
  DirectoryEntry,
  DirectoryListing,
  AssignVolumeResult,
  S3PutOptions,
  S3MultipartOptions,
  S3ProgressEvent,
  S3UploadResult,
  S3ObjectMetadata,
  S3ListResult,
  S3ObjectInfo,
} from './interfaces';

export {
  SeaweedFsException,
  SeaweedFsConnectionError,
  SeaweedFsNotFoundError,
  SeaweedFsConfigurationError,
  SeaweedFsUploadError,
  SeaweedFsS3Error,
  SeaweedFsUnsupportedOperationError,
} from './errors';

export {
  SEAWEEDFS_MODULE_OPTIONS,
  SEAWEEDFS_FILER_CLIENT,
  SEAWEEDFS_S3_CLIENT,
  SEAWEEDFS_FILER_SERVICE,
  SEAWEEDFS_S3_SERVICE,
} from './constants';

export { S3Client } from '@aws-sdk/client-s3';
