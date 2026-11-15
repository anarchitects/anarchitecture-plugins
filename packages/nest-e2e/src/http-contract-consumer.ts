// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { consumerEnvironment } from './consumer-environment';
import { createInstalledConsumer } from './installed-consumer';
import { usePackedPlugin, write } from './packed-plugin';
import { httpContractFixture } from './http-contract-fixture';

type Selection = 'node' | 'express' | 'fastify' | 'implicit';

/** Only verified public bootstrap configuration varies between adapters. */
function bootstrap(selection: Selection) {
  const platform = selection === 'implicit' ? 'express' : selection;
  const names = {
    node: ['NodeAdapter', 'NestNodeApplication'],
    express: ['ExpressAdapter', 'NestExpressApplication'],
    fastify: ['FastifyAdapter', 'NestFastifyApplication'],
  };
  const [adapter, application] = names[platform];
  const construction =
    selection === 'implicit'
      ? 'options'
      : `new ${adapter}(${
          platform === 'node'
            ? '{ trustProxy: trust }'
            : platform === 'fastify'
            ? '{ trustProxy: trust, bodyLimit: 512, ...(tls ? { https: tls } : {}) }'
            : ''
        }), options`;
  return `
import { NestFactory } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import { ${
    selection === 'implicit' ? '' : `${adapter}, `
  }type ${application} } from '@nestjs/platform-${platform}';
export const platform: string = '${platform}';
export async function createContractApp(module: Type<unknown>, trust: false | string, tls?: { key: Buffer; cert: Buffer }) {
  const options = { logger: false as const, rawBody: true, forceCloseConnections: true,
    cookies: { secret: 'fixture-cookie-secret' },
    ${platform === 'fastify' ? '' : '...(tls ? { httpsOptions: tls } : {}),'}
  };
  const app = await NestFactory.create<${application}>(module, ${construction});
  ${
    platform === 'express'
      ? "app.set('trust proxy', trust); app.set('query parser', 'simple');"
      : ''
  }
  ${
    platform === 'fastify'
      ? "app.useBodyParser('application/json', { bodyLimit: 512 }); app.useBodyParser('application/x-www-form-urlencoded', { bodyLimit: 512 });"
      : "app.useBodyParser('json', { limit: 512 }); app.useBodyParser('urlencoded', { limit: 512, extended: false });"
  }
  return app;
}
`;
}

/** Separate spec files retain Project Crystal atomization and fixture ownership. */
export function httpContractConsumer(selection: Selection) {
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
    `${selection}: enforces shared HTTP/security contracts in %s`,
    (type) => {
      const root = join(suite.root, `${selection}-${type}`);
      const { yarn: run, env } = createInstalledConsumer(root, suite.tarball, {
        node,
        nx: '24.0.1',
        cli: '12.0.13',
        resolutionLock: join(__dirname, 'consumer-locks/http-yarn.lock'),
      });
      try {
        const generate = [
          'nx',
          'g',
          '@anarchitects/nest:application',
          'api',
          '--directory=packages/api',
          `--type=${type}`,
          '--packageManager=yarn',
          ...(selection === 'implicit' ? [] : [`--platform=${selection}`]),
          '--skipInstall',
          '--no-interactive',
        ];
        run([...generate, '--dry-run']);
        run(generate);
        const owner = join(root, 'packages/api');
        const manifest = JSON.parse(
          readFileSync(join(owner, 'package.json'), 'utf8')
        );
        // The omitted-platform control keeps native source, selecting the same
        // audited runtime through ordinary consumer-owned dependency declarations.
        if (selection === 'implicit') {
          for (const name of ['common', 'core', 'platform-express'])
            manifest.dependencies[`@nestjs/${name}`] = '12.5.0';
          manifest.devDependencies['@nestjs/testing'] = '12.5.0';
          // Native omission leaves the CLI loader/checker's Webpack peer to the
          // consumer. Declare it normally; strict peer validation stays enabled.
          manifest.devDependencies.webpack = '5.112.2';
        }
        manifest.devDependencies['@standard-schema/spec'] = '1.1.0';
        write(owner, 'package.json', manifest);
        run(['install']);
        const resource = [
          'nx',
          'g',
          '@anarchitects/nest:resource',
          'users',
          '--project=api',
          '--type=rest',
          '--crud=true',
          '--spec=false',
          '--skipInstall',
          '--no-interactive',
        ];
        run([...resource, '--dry-run']);
        run(resource);
        run(['install']);
        const sourceFiles = [
          'src/main.ts',
          'src/app.module.ts',
          'src/users/users.controller.ts',
          'src/users/users.service.ts',
          'test/app.e2e-spec.ts',
          'package.json',
          'nest-cli.json',
          'tsconfig.json',
        ];
        const before = sourceFiles.map(
          (path) => [path, readFileSync(join(owner, path), 'utf8')] as const
        );
        expect(before[0][1].includes('new ')).toBe(selection !== 'implicit');
        write(owner, 'src/contract-bootstrap.ts', bootstrap(selection));
        write(owner, 'src/http-contract.ts', httpContractFixture);
        write(owner, 'tsconfig.contract.json', {
          extends: './tsconfig.json',
          compilerOptions: {
            rootDir: 'src',
            outDir: 'dist-contract',
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
          'verify-http-contract': {
            executor: 'nx:run-commands',
            options: {
              command: 'tsc -p tsconfig.contract.json',
              cwd: 'packages/api',
            },
          },
        };
        write(owner, 'project.json', project);
        // Disposable TLS identity: no private key or expiring certificate is committed.
        execFileSync(
          'openssl',
          [
            'req',
            '-x509',
            '-newkey',
            'rsa:2048',
            '-nodes',
            '-days',
            '1',
            '-subj',
            '/CN=localhost',
            '-addext',
            'subjectAltName=DNS:localhost,IP:127.0.0.1',
            '-keyout',
            'contract-key.pem',
            '-out',
            'contract-cert.pem',
          ],
          { cwd: owner, env, stdio: 'pipe', timeout: 30_000 }
        );
        const versions = JSON.parse(
          run(
            [
              'node',
              '-e',
              `
        const {createRequire}=require('node:module');const r=createRequire(process.cwd()+'/package.json');
        const fs=require('node:fs');const path=require('node:path');
        const version=n=>n==='@standard-schema/spec'
          ? JSON.parse(fs.readFileSync(r.resolve.paths(n).map(p=>path.join(p,n,'package.json')).find(p=>fs.existsSync(p)),'utf8')).version
          : r(n+'/package.json').version;
        console.log(JSON.stringify(Object.fromEntries(${JSON.stringify([
          '@nestjs/common',
          '@nestjs/core',
          '@nestjs/testing',
          '@nestjs/platform-express',
          ...(selection === 'node' || selection === 'fastify'
            ? [`@nestjs/platform-${selection}`]
            : []),
          '@nestjs/cli',
          '@nestjs/schematics',
          '@standard-schema/spec',
          'nx',
          'typescript',
        ])}.map(n=>[n,version(n)]))));
      `,
            ],
            undefined,
            true,
            owner
          )
        );
        for (const [name, version] of Object.entries(versions))
          expect(version).toBe(
            name === '@standard-schema/spec'
              ? '1.1.0'
              : name === 'nx'
              ? '24.0.1'
              : name === 'typescript'
              ? '6.0.3'
              : name === '@nestjs/cli' || name === '@nestjs/schematics'
              ? '12.0.13'
              : '12.5.0'
          );
        run(['nx', 'run', 'api:build']);
        run(['nx', 'run', 'api:verify-http-contract']);
        const output = run(
          ['node', 'dist-contract/http-contract.js'],
          undefined,
          true,
          owner
        );
        const modes = output
          .split('\n')
          .filter((line) => line.startsWith('HTTP_CONTRACT_MODE_OK '))
          .map((line) =>
            JSON.parse(line.slice('HTTP_CONTRACT_MODE_OK '.length))
          );
        expect(modes).toEqual(
          ['direct', 'trusted', 'untrusted', 'https'].map((mode) => ({
            platform: selection === 'implicit' ? 'express' : selection,
            mode,
          }))
        );
        for (const [path, contents] of before)
          expect(readFileSync(join(owner, path), 'utf8')).toBe(contents);
        console.log(
          `[http-contract] ${JSON.stringify({
            selection,
            type,
            node: '24.21.0',
            versions,
            modes,
          })}`
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    600_000
  );
}
