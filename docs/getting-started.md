# Getting Started

## Prerequisites

### Node.js

- **Node.js >= 18.0.0** (required by the package)
- **npm** or **pnpm** or **yarn**

### SeaweedFS

You need a running SeaweedFS cluster with:

- **Filer** service (port 8888 by default)
- **S3 Gateway** enabled on the Filer (port 8333 by default)
- **Master** server (port 9333 by default, needed for volume assignment)

See the [README.md](../README.md) for configuration instructions.

### NestJS

This package requires:

- `@nestjs/common` ^10.0.0 || ^11.0.0
- `@nestjs/core` ^10.0.0 || ^11.0.0
- `reflect-metadata` ^0.1.13 || ^0.2.0
- `rxjs` ^7.0.0 || ^8.0.0

These are peer dependencies and should already be installed in your NestJS project.

## Installation

### npm

```bash
npm install nestjs-seaweedfs
```

### pnpm

```bash
pnpm add nestjs-seaweedfs
```

### yarn

```bash
yarn add nestjs-seaweedfs
```

### Bun

```bash
bun add nestjs-seaweedfs
```

## Peer Dependencies

The following packages are required as peer dependencies. They should already be present in your NestJS project:

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | ^10.0.0 \|\| ^11.0.0 | NestJS common utilities |
| `@nestjs/core` | ^10.0.0 \|\| ^11.0.0 | NestJS core framework |
| `reflect-metadata` | ^0.1.13 \|\| ^0.2.0 | TypeScript decorator metadata |
| `rxjs` | ^7.0.0 \|\| ^8.0.0 | Reactive extensions for JavaScript |

If you're starting a new NestJS project, install these first:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Package Dependencies

The following packages are installed automatically as dependencies of `nestjs-seaweedfs`:

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | ^3.600.0 | AWS SDK v3 S3 client |
| `@aws-sdk/lib-storage` | ^3.600.0 | AWS SDK v3 multipart upload support |
| `@aws-sdk/s3-request-presigner` | ^3.600.0 | AWS SDK v3 presigned URL support |
| `axios` | ^1.7.0 | HTTP client for Filer REST API |
| `change-case` | ^5.4.0 | String case conversion utilities |

## Verifying the installation

After installation, verify the package is available:

```bash
# Check the installed version
npm list nestjs-seaweedfs
```

You can also verify the TypeScript types are available:

```bash
# This should resolve to the package's type definitions
npx tsc --noEmit
```

## Next steps

- [Quick Start](quick-start.md) — Get running in 5 minutes
- [NestJS Integration](nestjs-integration.md) — Module configuration