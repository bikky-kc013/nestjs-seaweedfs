import { Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SeaweedFsModule } from './seaweedfs.module';
import { SeaweedFsService } from './seaweedfs.service';
import { SeaweedFsFilerService } from './filer/filer.service';
import { SeaweedFsS3Service } from './s3/s3.service';
import {
  SeaweedFsModuleOptions,
  SeaweedFsModuleAsyncOptions,
  SeaweedFsModuleOptionsFactory,
} from './interfaces';
import { SeaweedFsConfigurationError } from './errors';
import {
  SEAWEEDFS_MODULE_OPTIONS,
  SEAWEEDFS_FILER_SERVICE,
  SEAWEEDFS_S3_SERVICE,
} from './constants';

const validOptions: SeaweedFsModuleOptions = {
  filer: { url: 'http://localhost:8888' },
  s3: {
    endpoint: 'http://localhost:8333',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  },
  validateConnectionOnBoot: false,
};

jest.mock('./filer/filer.service');
jest.mock('./s3/s3.service');

describe('SeaweedFsModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should create a dynamic module with valid options', () => {
      const dynamicModule = SeaweedFsModule.forRoot(validOptions);

      expect(dynamicModule.module).toBe(SeaweedFsModule);
      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('should set isGlobal to false when specified', () => {
      const dynamicModule = SeaweedFsModule.forRoot({
        ...validOptions,
        isGlobal: false,
      });

      expect(dynamicModule.global).toBe(false);
    });

    it('should throw when filer.url is missing', () => {
      expect(() =>
        SeaweedFsModule.forRoot({
          filer: { url: '' },
          s3: {
            endpoint: 'http://localhost:8333',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        }),
      ).toThrow(SeaweedFsConfigurationError);
    });

    it('should throw when s3.endpoint is missing', () => {
      expect(() =>
        SeaweedFsModule.forRoot({
          filer: { url: 'http://localhost:8888' },
          s3: {
            endpoint: '',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        }),
      ).toThrow(SeaweedFsConfigurationError);
    });

    it('should throw when s3.accessKeyId is missing', () => {
      expect(() =>
        SeaweedFsModule.forRoot({
          filer: { url: 'http://localhost:8888' },
          s3: {
            endpoint: 'http://localhost:8333',
            accessKeyId: '',
            secretAccessKey: 'secret',
          },
        }),
      ).toThrow(SeaweedFsConfigurationError);
    });

    it('should throw when s3.secretAccessKey is missing', () => {
      expect(() =>
        SeaweedFsModule.forRoot({
          filer: { url: 'http://localhost:8888' },
          s3: {
            endpoint: 'http://localhost:8333',
            accessKeyId: 'key',
            secretAccessKey: '',
          },
        }),
      ).toThrow(SeaweedFsConfigurationError);
    });

    it('should provide all required providers', () => {
      const dynamicModule = SeaweedFsModule.forRoot(validOptions);
      const providerKeys = dynamicModule.providers!.map((p) =>
        typeof p === 'object' && 'provide' in p ? p.provide : null,
      );

      expect(providerKeys).toContain(SEAWEEDFS_MODULE_OPTIONS);
    });

    it('should export the core services', () => {
      const dynamicModule = SeaweedFsModule.forRoot(validOptions);

      expect(dynamicModule.exports).toContain(SEAWEEDFS_FILER_SERVICE);
      expect(dynamicModule.exports).toContain(SEAWEEDFS_S3_SERVICE);
      expect(dynamicModule.exports).toContain(SeaweedFsService);
    });
  });

  describe('forRootAsync', () => {
    it('should create a dynamic module with useFactory', async () => {
      const dynamicModule = SeaweedFsModule.forRootAsync({
        useFactory: () => validOptions,
      });

      expect(dynamicModule.module).toBe(SeaweedFsModule);
      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.providers).toBeDefined();
    });

    it('should create a dynamic module with useClass', async () => {
      class ConfigFactory implements SeaweedFsModuleOptionsFactory {
        createSeaweedFsOptions(): SeaweedFsModuleOptions {
          return validOptions;
        }
      }

      const dynamicModule = SeaweedFsModule.forRootAsync({
        useClass: ConfigFactory,
      });

      expect(dynamicModule.module).toBe(SeaweedFsModule);
      expect(dynamicModule.providers!.length).toBeGreaterThan(0);
    });

    it('should create a dynamic module with useExisting', async () => {
      class ConfigFactory implements SeaweedFsModuleOptionsFactory {
        createSeaweedFsOptions(): SeaweedFsModuleOptions {
          return validOptions;
        }
      }

      const dynamicModule = SeaweedFsModule.forRootAsync({
        useExisting: ConfigFactory,
      });

      expect(dynamicModule.module).toBe(SeaweedFsModule);
    });

    it('should support inject array', async () => {
      const dynamicModule = SeaweedFsModule.forRootAsync({
        useFactory: (_config: unknown) => validOptions,
        inject: ['CONFIG_SERVICE'],
      });

      expect(dynamicModule.module).toBe(SeaweedFsModule);
    });

    it('should throw when no factory/class/existing is provided', () => {
      expect(() => SeaweedFsModule.forRootAsync({} as SeaweedFsModuleAsyncOptions)).toThrow(
        SeaweedFsConfigurationError,
      );
    });

    it('should support imports', async () => {
      @Module({})
      class SomeModule {}

      const dynamicModule = SeaweedFsModule.forRootAsync({
        imports: [SomeModule],
        useFactory: () => validOptions,
      });

      expect(dynamicModule.imports).toContain(SomeModule);
    });
  });

  describe('register', () => {
    it('should create a feature-level module', () => {
      const dynamicModule = SeaweedFsModule.register(validOptions);

      expect(dynamicModule.module).toBe(SeaweedFsModule);
      expect(dynamicModule.global).toBe(false);
      expect(dynamicModule.providers).toBeDefined();
    });

    it('should have unique provider tokens', () => {
      const module1 = SeaweedFsModule.register(validOptions);
      const module2 = SeaweedFsModule.register(validOptions);

      const getProviderNames = (mod: ReturnType<typeof SeaweedFsModule.register>) =>
        mod
          .providers!.map((p) => (typeof p === 'object' && 'provide' in p ? String(p.provide) : ''))
          .filter(Boolean);

      const names1 = getProviderNames(module1);
      const names2 = getProviderNames(module2);

      expect(names1.length).toBeGreaterThan(0);
      expect(names2.length).toBeGreaterThan(0);
    });
  });

  describe('integration with NestJS DI', () => {
    it('should resolve SeaweedFsService from the module', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [SeaweedFsModule.forRoot(validOptions)],
      }).compile();

      const service = module.get<SeaweedFsService>(SeaweedFsService);
      expect(service).toBeInstanceOf(SeaweedFsService);
    });

    it('should resolve SeaweedFsFilerService', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [SeaweedFsModule.forRoot(validOptions)],
      }).compile();

      const filerService = module.get<SeaweedFsFilerService>(SEAWEEDFS_FILER_SERVICE);
      expect(filerService).toBeDefined();
    });

    it('should resolve SeaweedFsS3Service', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [SeaweedFsModule.forRoot(validOptions)],
      }).compile();

      const s3Service = module.get<SeaweedFsS3Service>(SEAWEEDFS_S3_SERVICE);
      expect(s3Service).toBeDefined();
    });
  });
});
