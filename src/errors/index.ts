export class SeaweedFsException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SeaweedFsException';
    Object.defineProperty(this, 'cause', { value: cause, writable: false, enumerable: false });
  }
}

export class SeaweedFsConnectionError extends SeaweedFsException {
  public readonly source: 'filer' | 's3';

  constructor(source: 'filer' | 's3', message: string, cause?: Error) {
    super(`[${source}] ${message}`, cause);
    this.name = 'SeaweedFsConnectionError';
    this.source = source;
  }
}

export class SeaweedFsNotFoundError extends SeaweedFsException {
  public readonly path: string;

  constructor(path: string, cause?: Error) {
    super(`Resource not found: ${path}`, cause);
    this.name = 'SeaweedFsNotFoundError';
    this.path = path;
  }
}

export class SeaweedFsConfigurationError extends SeaweedFsException {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SeaweedFsConfigurationError';
  }
}

export class SeaweedFsUploadError extends SeaweedFsException {
  public readonly path: string;

  constructor(path: string, message: string, cause?: Error) {
    super(`Upload failed for ${path}: ${message}`, cause);
    this.name = 'SeaweedFsUploadError';
    this.path = path;
  }
}

export class SeaweedFsS3Error extends SeaweedFsException {
  public readonly bucket: string;
  public readonly key?: string;
  public readonly awsErrorCode?: string;

  constructor(bucket: string, key: string | undefined, message: string, cause?: Error) {
    const context = key ? `${bucket}/${key}` : bucket;
    super(`[S3] ${context}: ${message}`, cause);
    this.name = 'SeaweedFsS3Error';
    this.bucket = bucket;
    this.key = key;
    this.awsErrorCode = cause?.name;
  }
}

export class SeaweedFsUnsupportedOperationError extends SeaweedFsException {
  constructor(operation: string, message: string) {
    super(`Unsupported operation '${operation}': ${message}`);
    this.name = 'SeaweedFsUnsupportedOperationError';
  }
}
