# NestJS Integration

This guide covers how to integrate `nestjs-seaweedfs` into your NestJS application.

## Module Setup

### Synchronous configuration (`forRoot`)

The simplest way to configure the module is with `forRoot`:

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

### Asynchronous configuration (`forRootAsync`)

For production applications, you typically want to load configuration from environment variables. Use `forRootAsync` with `useFactory`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeaweedFsModule } from 'nestjs-seaweedfs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SeaweedFsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        filer: {
          url: config.get<string>('SEAWEEDFS_FILER_URL', 'http://localhost:8888'),
          timeout: 30000,
          retries: 3,
        },
        masterUrl: config.get<string>('SEAWEEDFS_MASTER_URL'),
        s3: {
          endpoint: config.get<string>('SEAWEEDFS_S3_ENDPOINT', 'http://localhost:8333'),
          accessKeyId: config.get<string>('SEAWEEDFS_S3_ACCESS_KEY', ''),
          secretAccessKey: config.get<string>('SEAWEEDFS_S3_SECRET_KEY', ''),
          forcePathStyle: true,
          defaultBucket: config.get<string>('SEAWEEDFS_S3_BUCKET', 'default'),
        },
        validateConnectionOnBoot: true,
      }),
    }),
  ],
})
export class AppModule {}
```

### Using `useClass`

You can also use a factory class:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeaweedFsModule, SeaweedFsModuleOptionsFactory, SeaweedFsModuleOptions } from 'nestjs-seaweedfs';

@Injectable()
export class SeaweedFsConfigService implements SeaweedFsModuleOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createSeaweedFsOptions(): SeaweedFsModuleOptions {
    return {
      filer: {
        url: this.config.get<string>('SEAWEEDFS_FILER_URL'),
      },
      s3: {
        endpoint: this.config.get<string>('SEAWEEDFS_S3_ENDPOINT'),
        accessKeyId: this.config.get<string>('SEAWEEDFS_S3_ACCESS_KEY'),
        secretAccessKey: this.config.get<string>('SEAWEEDFS_S3_SECRET_KEY'),
        forcePathStyle: true,
      },
    };
  }
}

@Module({
  imports: [
    SeaweedFsModule.forRootAsync({
      useClass: SeaweedFsConfigService,
    }),
  ],
})
export class AppModule {}
```

### Using `useExisting`

If you already have a configuration service, you can reuse it:

```typescript
@Module({
  imports: [
    SeaweedFsModule.forRootAsync({
      useExisting: SeaweedFsConfigService,
    }),
  ],
})
export class AppModule {}
```

## Configuration Options

### `SeaweedFsModuleOptions`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `filer` | `SeaweedFsFilerOptions` | Yes | — | Filer API configuration |
| `s3` | `SeaweedFsS3Options` | Yes | — | S3 Gateway configuration |
| `masterUrl` | `string` | No | — | Master server URL (required for `assignVolume()`) |
| `isGlobal` | `boolean` | No | `true` | Whether the module is global |
| `validateConnectionOnBoot` | `boolean` | No | `true` | Validate Filer and S3 connectivity on boot |

### `SeaweedFsFilerOptions`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `url` | `string` | Yes | — | Filer REST API URL |
| `timeout` | `number` | No | `30000` | Request timeout in milliseconds |
| `retries` | `number` | No | `3` | Maximum retry attempts for transient errors |
| `auth` | `SeaweedFsFilerAuth` | No | — | Authentication configuration |

### `SeaweedFsFilerAuth`

Authentication can be configured in three ways:

```typescript
// Basic auth
auth: {
  type: 'basic',
  username: 'admin',
  password: 'password',
}

// Bearer token
auth: {
  type: 'bearer',
  token: 'your-bearer-token',
}

// Custom header
auth: {
  type: 'header',
  name: 'X-Custom-Auth',
  value: 'custom-value',
}
```

### `SeaweedFsS3Options`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `endpoint` | `string` | Yes | — | S3 Gateway endpoint URL |
| `accessKeyId` | `string` | Yes | — | S3 access key |
| `secretAccessKey` | `string` | Yes | — | S3 secret key |
| `region` | `string` | No | `us-east-1` | AWS region (not used by SeaweedFS, but required by SDK) |
| `forcePathStyle` | `boolean` | No | `true` | Use path-style URLs (required by SeaweedFS) |
| `defaultBucket` | `string` | No | — | Default bucket name (used when bucket is not specified) |

## Feature-Level Modules

For scenarios where you need multiple SeaweedFS configurations (e.g., different buckets for different features), use `register()`:

```typescript
import { Module } from '@nestjs/common';
import { SeaweedFsModule } from 'nestjs-seaweedfs';

@Module({
  imports: [
    SeaweedFsModule.register({
      filer: { url: 'http://localhost:8888' },
      s3: {
        endpoint: 'http://localhost:8333',
        accessKeyId: 'feature-key',
        secretAccessKey: 'feature-secret',
        forcePathStyle: true,
        defaultBucket: 'feature-bucket',
      },
    }),
  ],
})
export class FeatureModule {}
```

The `register()` method creates non-global, scoped instances. Each call generates unique provider tokens, so you can have multiple configurations without conflicts.

## Dependency Injection

Inject `SeaweedFsService` into your services or controllers:

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Injectable()
export class FileService {
  constructor(private readonly seaweed: SeaweedFsService) {}

  async upload(path: string, buffer: Buffer) {
    return this.seaweed.upload(path, buffer);
  }
}
```

### Injecting sub-services

You can also inject the individual Filer and S3 services:

```typescript
import { Injectable } from '@nestjs/common';
import { SeaweedFsFilerService, SeaweedFsS3Service } from 'nestjs-seaweedfs';

@Injectable()
export class AdvancedService {
  constructor(
    private readonly filer: SeaweedFsFilerService,
    private readonly s3: SeaweedFsS3Service,
  ) {}
}
```

## Connection Validation

By default, the module validates connectivity to both the Filer and S3 Gateway on application startup. If either service is unreachable, the application will fail to start with a descriptive error.

To disable connection validation (e.g., for testing):

```typescript
SeaweedFsModule.forRoot({
  filer: { url: 'http://localhost:8888' },
  s3: {
    endpoint: 'http://localhost:8333',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    forcePathStyle: true,
  },
  validateConnectionOnBoot: false,
}),
```

## Environment-based configuration

A common pattern is to use environment variables for configuration:

```typescript
// src/config/seaweedfs.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('seaweedfs', () => ({
  filer: {
    url: process.env.SEAWEEDFS_FILER_URL || 'http://localhost:8888',
    timeout: parseInt(process.env.SEAWEEDFS_FILER_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.SEAWEEDFS_FILER_RETRIES || '3', 10),
  },
  masterUrl: process.env.SEAWEEDFS_MASTER_URL,
  s3: {
    endpoint: process.env.SEAWEEDFS_S3_ENDPOINT || 'http://localhost:8333',
    accessKeyId: process.env.SEAWEEDFS_S3_ACCESS_KEY || '',
    secretAccessKey: process.env.SEAWEEDFS_S3_SECRET_KEY || '',
    region: process.env.SEAWEEDFS_S3_REGION || 'us-east-1',
    forcePathStyle: true,
    defaultBucket: process.env.SEAWEEDFS_S3_BUCKET || 'default',
  },
  validateConnectionOnBoot: process.env.NODE_ENV !== 'test',
}));
```

Then use it in your module:

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import seaweedfsConfig from './config/seaweedfs.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigModule.forFeature(seaweedfsConfig),
    SeaweedFsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('seaweedfs'),
    }),
  ],
})
export class AppModule {}
```

## Next steps

- [Filer API](filer-api.md) — Filer REST API operations
- [S3 API](s3-api.md) — S3 Gateway operations
- [Examples](../examples/) — Complete controller examples