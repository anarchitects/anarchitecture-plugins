// SPDX-License-Identifier: MIT
export interface NestFixture {
  name: string;
  root: string;
  moduleType: 'module' | 'commonjs';
  output: string;
  emittedMain: string;
  files: Record<string, unknown>;
  buildTargetName?: string;
  startTargetName?: string;
  configInputs?: string[];
}

const compilerOptions = {
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  target: 'ES2022',
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  esModuleInterop: true,
  skipLibCheck: true,
  types: ['node'],
};

// Small real Nest applications, not copies of Nest's generation templates.
function application(sourceRoot: string, shared = false) {
  return {
    [`${sourceRoot}/main.ts`]: `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableShutdownHooks();
  await app.listen(0, '127.0.0.1');
  console.log('NEST_E2E_URL=' + await app.getUrl());
}
void bootstrap();
`,
    [`${sourceRoot}/app.module.ts`]: `import { Controller, Get, Module } from '@nestjs/common';
${
  shared
    ? "import { message } from '../../../libs/shared/src/index.js';"
    : "const message = 'Nest v12 fixture';"
}
@Controller()
class AppController {
  @Get() hello() { return { message }; }
}
@Module({ controllers: [AppController] })
export class AppModule {}
`,
  };
}

const standalone: NestFixture = {
  name: 'standalone-esm',
  root: '.',
  moduleType: 'module',
  output: '{projectRoot}/dist',
  emittedMain: 'dist/main.js',
  files: {
    'nest-cli.json': { sourceRoot: 'src' },
    'tsconfig.json': {
      compilerOptions: {
        ...compilerOptions,
        outDir: './dist',
        rootDir: './src',
      },
    },
    'tsconfig.build.json': {
      extends: './tsconfig.json',
      include: ['src/**/*.ts'],
    },
    ...application('src'),
  },
};

const commonjs: NestFixture = {
  ...standalone,
  name: 'standalone-commonjs-builder-config',
  moduleType: 'commonjs',
  files: {
    ...standalone.files,
    'nest-cli.json': {
      sourceRoot: 'src',
      compilerOptions: {
        builder: { type: 'tsc', options: { configPath: 'config/build.json' } },
      },
    },
    'config/build.json': {
      extends: '../tsconfig.json',
      include: ['../src/**/*.ts'],
    },
    // This must lose to the tsc builder's configPath.
    'tsconfig.build.json': {
      extends: './tsconfig.json',
      compilerOptions: { outDir: './wrong-output' },
    },
  },
};

const nested: NestFixture = {
  name: 'nested-solution-custom-output',
  root: 'services/api',
  moduleType: 'module',
  output: '{workspaceRoot}/artifacts/api',
  emittedMain: 'artifacts/api/main.js',
  buildTargetName: 'compile',
  startTargetName: 'serve',
  configInputs: [
    '{workspaceRoot}/config/base.json',
    '{workspaceRoot}/services/api/config/build.json',
  ],
  files: {
    'tsconfig.json': { files: [], references: [{ path: './services/api' }] },
    'config/base.json': {
      compilerOptions: { ...compilerOptions, outDir: '../artifacts/api' },
    },
    'services/api/tsconfig.json': {
      files: [],
      references: [{ path: './config/build.json' }],
    },
    'services/api/nest-cli.json': {
      sourceRoot: 'src',
      compilerOptions: {
        tsConfigPath: 'config/build.json',
        builder: {
          type: 'tsc',
          options: { configPath: 'tsconfig.build.json' },
        },
      },
    },
    'services/api/config/build.json': {
      extends: '../../../config/base.json',
      compilerOptions: { rootDir: '../src' },
      include: ['../src/**/*.ts'],
    },
    'services/api/tsconfig.build.json': {
      compilerOptions: { outDir: './wrong-output' },
    },
    ...application('services/api/src'),
  },
};

function monorepo(rspack: boolean): NestFixture {
  return {
    name: rspack ? 'monorepo-rspack' : 'monorepo-tsc',
    root: '.',
    moduleType: 'module',
    output: '{projectRoot}/dist',
    emittedMain: rspack ? 'dist/main.js' : 'dist/apps/api/src/main.js',
    files: {
      'nest-cli.json': {
        monorepo: true,
        root: 'apps/api',
        sourceRoot: 'apps/api/src',
        compilerOptions: {
          tsConfigPath: 'apps/api/tsconfig.app.json',
          builder: rspack
            ? { type: 'rspack', options: { configPath: 'rspack.config.cjs' } }
            : 'tsc',
        },
        projects: {
          api: {
            type: 'application',
            root: 'apps/api',
            entryFile: 'main',
            sourceRoot: 'apps/api/src',
            compilerOptions: { tsConfigPath: 'apps/api/tsconfig.app.json' },
          },
          shared: {
            type: 'library',
            root: 'libs/shared',
            entryFile: 'index',
            sourceRoot: 'libs/shared/src',
            compilerOptions: { tsConfigPath: 'libs/shared/tsconfig.lib.json' },
          },
        },
      },
      'tsconfig.json': {
        compilerOptions: { ...compilerOptions, outDir: './dist' },
      },
      'apps/api/tsconfig.app.json': {
        extends: '../../tsconfig.json',
        compilerOptions: { rootDir: '../..' },
        include: ['src/**/*.ts', '../../libs/shared/src/**/*.ts'],
      },
      'libs/shared/tsconfig.lib.json': {
        extends: '../../tsconfig.json',
        include: ['src/**/*.ts'],
      },
      'libs/shared/src/index.ts':
        "export const message = 'Nest v12 fixture';\n",
      ...(rspack
        ? {
            'rspack.config.cjs': `module.exports = (options) => ({
  ...options,
  output: { ...options.output, filename: 'main.js' },
});\n`,
          }
        : {}),
      ...application('apps/api/src', true),
    },
  };
}

export const fixtures = [
  standalone,
  commonjs,
  nested,
  monorepo(false),
  monorepo(true),
];
