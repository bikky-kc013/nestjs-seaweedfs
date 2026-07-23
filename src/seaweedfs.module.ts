import { Module, Global, DynamicModule, Provider, Logger } from '@nestjs/common';
import {
  SeaweedFsModuleOptions,
  SeaweedFsModuleAsyncOptions,
  SeaweedFsModuleOptionsFactory,
} from './interfaces';
import { SeaweedFsFilerService } from './filer/filer.service';
import { SeaweedFsS3Service } from './s3/s3.service';
import { SeaweedFsService } from './seaweedfs.service';
import { SeaweedFsConfigurationError } from './errors';
import {
  SEAWEEDFS_MODULE_OPTIONS,
  SEAWEEDFS_FILER_SERVICE,
  SEAWEEDFS_S3_SERVICE,
} from './constants';

const SEAWEEDFS_CORE_PROVIDERS = [
  {
    provide: SEAWEEDFS_FILER_SERVICE,
    useFactory: (options: SeaweedFsModuleOptions) => new SeaweedFsFilerService(options),
    inject: [SEAWEEDFS_MODULE_OPTIONS],
  },
  {
    provide: SEAWEEDFS_S3_SERVICE,
    useFactory: (options: SeaweedFsModuleOptions) => new SeaweedFsS3Service(options),
    inject: [SEAWEEDFS_MODULE_OPTIONS],
  },
  {
    provide: SeaweedFsService,
    useFactory: (filerService: SeaweedFsFilerService, s3Service: SeaweedFsS3Service) =>
      new SeaweedFsService(filerService, s3Service),
    inject: [SEAWEEDFS_FILER_SERVICE, SEAWEEDFS_S3_SERVICE],
  },
];

@Global()
@Module({})
export class SeaweedFsModule {
  private static readonly logger = new Logger(SeaweedFsModule.name);

  static forRoot(options: SeaweedFsModuleOptions): DynamicModule {
    this.validateOptions(options);

    const optionsProvider: Provider = {
      provide: SEAWEEDFS_MODULE_OPTIONS,
      useValue: options,
    };

    const providers = [optionsProvider, ...SEAWEEDFS_CORE_PROVIDERS];
    const exports = [SEAWEEDFS_FILER_SERVICE, SEAWEEDFS_S3_SERVICE, SeaweedFsService];

    return {
      module: SeaweedFsModule,
      global: options.isGlobal ?? true,
      providers,
      exports,
    };
  }

  static forRootAsync(options: SeaweedFsModuleAsyncOptions): DynamicModule {
    const optionsProvider = this.createAsyncOptionsProvider(options);

    const providers = [optionsProvider, ...SEAWEEDFS_CORE_PROVIDERS];
    const exports = [SEAWEEDFS_FILER_SERVICE, SEAWEEDFS_S3_SERVICE, SeaweedFsService];

    return {
      module: SeaweedFsModule,
      global: true,
      imports: options.imports ?? [],
      providers,
      exports,
    };
  }

  static register(options: SeaweedFsModuleOptions): DynamicModule {
    this.validateOptions(options);

    const optionsProvider: Provider = {
      provide: SEAWEEDFS_MODULE_OPTIONS,
      useValue: options,
    };

    const filerProvider: Provider = {
      provide: `${SEAWEEDFS_FILER_SERVICE.toString()}_${Math.random().toString(36).slice(2, 8)}`,
      useFactory: (opts: SeaweedFsModuleOptions) => new SeaweedFsFilerService(opts),
      inject: [SEAWEEDFS_MODULE_OPTIONS],
    };

    const s3Provider: Provider = {
      provide: `${SEAWEEDFS_S3_SERVICE.toString()}_${Math.random().toString(36).slice(2, 8)}`,
      useFactory: (opts: SeaweedFsModuleOptions) => new SeaweedFsS3Service(opts),
      inject: [SEAWEEDFS_MODULE_OPTIONS],
    };

    const serviceProvider: Provider = {
      provide: SeaweedFsService,
      useFactory: (filerService: SeaweedFsFilerService, s3Service: SeaweedFsS3Service) =>
        new SeaweedFsService(filerService, s3Service),
      inject: [filerProvider.provide, s3Provider.provide],
    };

    return {
      module: SeaweedFsModule,
      global: false,
      providers: [optionsProvider, filerProvider, s3Provider, serviceProvider],
      exports: [serviceProvider, SeaweedFsService],
    };
  }

  private static createAsyncOptionsProvider(options: SeaweedFsModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: SEAWEEDFS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      };
    }

    if (options.useClass) {
      return {
        provide: SEAWEEDFS_MODULE_OPTIONS,
        useFactory: async (factory: SeaweedFsModuleOptionsFactory) =>
          factory.createSeaweedFsOptions(),
        inject: [options.useClass],
      };
    }

    if (options.useExisting) {
      return {
        provide: SEAWEEDFS_MODULE_OPTIONS,
        useFactory: async (factory: SeaweedFsModuleOptionsFactory) =>
          factory.createSeaweedFsOptions(),
        inject: [options.useExisting],
      };
    }

    throw new SeaweedFsConfigurationError(
      'SeaweedFsModule.forRootAsync requires one of: useFactory, useClass, or useExisting',
    );
  }

  private static validateOptions(options: SeaweedFsModuleOptions): void {
    if (!options.filer?.url) {
      throw new SeaweedFsConfigurationError('SeaweedFsModule: filer.url is required');
    }
    if (!options.s3?.endpoint) {
      throw new SeaweedFsConfigurationError('SeaweedFsModule: s3.endpoint is required');
    }
    if (!options.s3?.accessKeyId) {
      throw new SeaweedFsConfigurationError('SeaweedFsModule: s3.accessKeyId is required');
    }
    if (!options.s3?.secretAccessKey) {
      throw new SeaweedFsConfigurationError('SeaweedFsModule: s3.secretAccessKey is required');
    }
  }
}
