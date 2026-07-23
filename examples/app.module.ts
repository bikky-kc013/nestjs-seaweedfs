import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeaweedFsModule } from 'nestjs-seaweedfs';
import { FilerController } from './filer.controller';
import { S3Controller } from './s3.controller';
import { PresignController } from './presign.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SeaweedFsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        filer: {
          url: config.get('SEAWEEDFS_FILER_URL', 'http://localhost:8888'),
          timeout: 30000,
          retries: 3,
        },
        masterUrl: config.get('SEAWEEDFS_MASTER_URL'),
        s3: {
          endpoint: config.get('SEAWEEDFS_S3_ENDPOINT', 'http://localhost:8333'),
          accessKeyId: config.get('SEAWEEDFS_S3_ACCESS_KEY', 'test-access-key'),
          secretAccessKey: config.get('SEAWEEDFS_S3_SECRET_KEY', 'test-secret-key'),
          forcePathStyle: true,
          defaultBucket: config.get('SEAWEEDFS_S3_BUCKET', 'test-bucket'),
        },
        validateConnectionOnBoot: true,
      }),
    }),
  ],
  controllers: [FilerController, S3Controller, PresignController],
})
export class AppModule {}
