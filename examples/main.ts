import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
  console.log('Endpoints:');
  console.log('  Filer: POST /api/filer/upload, GET /api/filer/download/:path');
  console.log('  S3:    POST /api/s3/upload/:key, GET /api/s3/download/:key');
  console.log('  Presign: POST /api/presign/upload-url, POST /api/presign/download-url');
}
bootstrap();
