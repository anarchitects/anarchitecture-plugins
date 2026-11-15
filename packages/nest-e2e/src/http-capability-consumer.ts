// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { consumerEnvironment } from './consumer-environment';
import { createInstalledConsumer } from './installed-consumer';
import { usePackedPlugin, write } from './packed-plugin';
import { httpCapabilityFixture } from './http-capability-fixture';

type Platform = 'node' | 'express' | 'fastify';
const optionalVersions = {
  '@nestjs/swagger': '12.1.2',
  ejs: '5.0.1',
  '@fastify/static': '10.1.11',
  '@fastify/multipart': '10.1.8',
  '@fastify/view': '12.0.1',
};

function bootstrap(platform: Platform) {
  const [adapter, application] = {
    node: ['NodeAdapter', 'NestNodeApplication'],
    express: ['ExpressAdapter', 'NestExpressApplication'],
    fastify: ['FastifyAdapter', 'NestFastifyApplication'],
  }[platform];
  return `
import { NestFactory } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import { ${adapter}, type ${application} } from '@nestjs/platform-${platform}';
import { resolve } from 'node:path';
${platform === 'fastify' ? "import { createRequire } from 'node:module';" : ''}
export { FileInterceptor } from '@nestjs/platform-${platform}';
export const platform = '${platform}';
export async function createCapabilityApp(module: Type<unknown>, enabled: boolean) {
  const app = await NestFactory.create<${application}>(module, new ${adapter}(), { logger: false, forceCloseConnections: true });
  if (enabled) {
    const assets = resolve('capability-assets/public');
    const views = resolve('capability-assets/views');
    ${
      platform === 'fastify'
        ? `// Swagger owns reply.sendFile; the second static root must not redecorate it.
    app.useStaticAssets({ root: assets, prefix: '/assets/', decorateReply: false, dotfiles: 'ignore' });
    const require = createRequire(resolve('package.json'));
    app.setViewEngine({ engine: { ejs: require('ejs') }, root: views });`
        : `app.useStaticAssets(assets, { prefix: '/assets/' });
    app.setBaseViewsDir(views);
    app.setViewEngine('ejs');`
    }
  }
  return app;
}
`;
}

/** One spec per adapter keeps Nx inference/atomization and temporary roots isolated. */
export function httpCapabilityConsumer(platform: Platform) {
  const suite = usePackedPlugin();
  let node: string;
  beforeAll(() => {
    node = execFileSync(
      'npm',
      [
        'exec',
        '--yes',
        '--package=node@24.21.0',
        '--',
        'node',
        '-p',
        'process.execPath',
      ],
      {
        cwd: suite.root,
        env: consumerEnvironment(suite.root),
        encoding: 'utf8',
        timeout: 180_000,
      }
    ).trim();
    expect(execFileSync(node, ['--version'], { encoding: 'utf8' }).trim()).toBe(
      'v24.21.0'
    );
  }, 240_000);

  it.each(['esm', 'cjs'])(
    `${platform}: verifies optional HTTP capabilities in %s`,
    (type) => {
      const root = join(suite.root, `${platform}-${type}`);
      try {
        const { yarn: run } = createInstalledConsumer(root, suite.tarball, {
          node,
          nx: '24.0.1',
          cli: '12.0.13',
          resolutionLock: join(
            __dirname,
            'consumer-locks/http-capabilities-yarn.lock'
          ),
        });
        const generate = [
          'nx',
          'g',
          '@anarchitects/nest:application',
          'api',
          '--directory=packages/api',
          `--type=${type}`,
          '--packageManager=yarn',
          `--platform=${platform}`,
          '--skipInstall',
          '--no-interactive',
        ];
        run([...generate, '--dry-run']);
        run(generate);
        const owner = join(root, 'packages/api');
        const nativeFiles = [
          'src/main.ts',
          'src/app.module.ts',
          'src/app.controller.ts',
          'src/app.service.ts',
          'test/app.e2e-spec.ts',
          'nest-cli.json',
          'tsconfig.json',
        ];
        const before = nativeFiles.map(
          (path) => [path, readFileSync(join(owner, path), 'utf8')] as const
        );
        const manifest = JSON.parse(
          readFileSync(join(owner, 'package.json'), 'utf8')
        );
        for (const name of Object.keys(optionalVersions)) {
          expect(manifest.dependencies[name]).toBeUndefined();
          expect(manifest.devDependencies[name]).toBeUndefined();
        }
        const optional = Object.fromEntries(
          Object.entries(optionalVersions).filter(
            ([name]) => platform === 'fastify' || !name.startsWith('@fastify/')
          )
        );
        Object.assign(manifest.dependencies, optional);
        manifest.devDependencies['@standard-schema/spec'] = '1.1.0';
        write(owner, 'package.json', manifest);
        run(['install']);
        const installedManifest = readFileSync(
          join(owner, 'package.json'),
          'utf8'
        );
        write(owner, 'src/capability-bootstrap.ts', bootstrap(platform));
        write(owner, 'src/http-capability.ts', httpCapabilityFixture);
        write(
          owner,
          'capability-assets/public/hello.txt',
          'public capability asset'
        );
        write(
          owner,
          'capability-assets/public/.secret',
          'private capability sentinel'
        );
        write(
          owner,
          'capability-assets/private.txt',
          'private capability sentinel'
        );
        write(
          owner,
          'capability-assets/views/hello.ejs',
          '<p><%= message %></p>'
        );
        write(owner, 'tsconfig.capability.json', {
          extends: './tsconfig.json',
          compilerOptions: {
            rootDir: 'src',
            outDir: 'dist-capability',
            types: ['node'],
            incremental: false,
          },
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts'],
        });
        const project = JSON.parse(
          readFileSync(join(owner, 'project.json'), 'utf8')
        );
        project.targets = {
          ...project.targets,
          'verify-http-capability': {
            executor: 'nx:run-commands',
            options: {
              command: 'tsc -p tsconfig.capability.json',
              cwd: 'packages/api',
            },
          },
        };
        write(owner, 'project.json', project);
        const expected = {
          ...optional,
          '@nestjs/common': '12.5.0',
          '@nestjs/core': '12.5.0',
          [`@nestjs/platform-${platform}`]: '12.5.0',
          '@nestjs/cli': '12.0.13',
          '@nestjs/schematics': '12.0.13',
          nx: '24.0.1',
          typescript: '6.0.3',
          '@standard-schema/spec': '1.1.0',
        };
        const versions = JSON.parse(
          run(
            [
              'node',
              '-e',
              `
        const {createRequire}=require('node:module');const fs=require('node:fs');const path=require('node:path');
        const r=createRequire(process.cwd()+'/package.json');
        const version=n=>JSON.parse(fs.readFileSync(r.resolve.paths(n).map(p=>path.join(p,n,'package.json')).find(p=>fs.existsSync(p)),'utf8')).version;
        console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(
          Object.keys(expected)
        )}.map(n=>[n,version(n)]))));
      `,
            ],
            undefined,
            true,
            owner
          )
        );
        expect(versions).toEqual(expected);
        run(['nx', 'run', 'api:build']);
        run(['nx', 'run', 'api:verify-http-capability']);
        for (const enabled of [false, true]) {
          const output = run(
            [
              'node',
              'dist-capability/http-capability.js',
              enabled ? 'enabled' : 'disabled',
            ],
            undefined,
            true,
            owner
          );
          expect(output).toContain(
            'HTTP_CAPABILITY_OK ' + JSON.stringify({ platform, enabled })
          );
        }
        for (const [path, contents] of before)
          expect(readFileSync(join(owner, path), 'utf8')).toBe(contents);
        expect(readFileSync(join(owner, 'package.json'), 'utf8')).toBe(
          installedManifest
        );
        console.log(
          `[http-capability] ${JSON.stringify({
            platform,
            type,
            node: '24.21.0',
            versions,
          })}`
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    600_000
  );
}
