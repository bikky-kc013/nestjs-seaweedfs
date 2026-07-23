import { Controller, Post, Get, Delete, Param, Body, UploadedFile, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SeaweedFsService } from 'nestjs-seaweedfs';

@Controller('filer')
export class FilerController {
  constructor(private readonly seaweed: SeaweedFsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('path') path: string) {
    try {
      const result = await this.seaweed.upload(path || `/uploads/${file.originalname}`, file.buffer, {
        headers: file.mimetype ? { 'Content-Type': file.mimetype } : undefined,
      });
      return { success: true, ...result };
    } catch (error) {
      throw new HttpException(
        `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download/:path(*)')
  async downloadFile(@Param('path') path: string) {
    try {
      const buffer = await this.seaweed.downloadToBuffer(`/${path}`);
      return { success: true, size: buffer.length, data: buffer.toString('base64') };
    } catch (error) {
      if (error instanceof Error && error.name === 'SeaweedFsNotFoundError') {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Download failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('list/:path(*)')
  async listDirectory(@Param('path') path: string) {
    try {
      const listing = await this.seaweed.listDirectory(`/${path || ''}`, { limit: 100 });
      return { success: true, ...listing };
    } catch (error) {
      throw new HttpException(
        `List failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('delete/:path(*)')
  async deleteFile(@Param('path') path: string) {
    try {
      await this.seaweed.delete(`/${path}`);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('exists/:path(*)')
  async fileExists(@Param('path') path: string) {
    const exists = await this.seaweed.exists(`/${path}`);
    return { exists };
  }

  @Get('metadata/:path(*)')
  async getMetadata(@Param('path') path: string) {
    try {
      const metadata = await this.seaweed.getMetadata(`/${path}`);
      return { success: true, ...metadata };
    } catch (error) {
      throw new HttpException(
        `Metadata failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
