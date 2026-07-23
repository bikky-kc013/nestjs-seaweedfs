import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
  target: 'es2021',
  tsconfig: 'tsconfig.build.json',
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@aws-sdk/client-s3',
    '@aws-sdk/lib-storage',
    '@aws-sdk/s3-request-presigner',
    'axios',
    'rxjs',
    'reflect-metadata',
  ],
});
