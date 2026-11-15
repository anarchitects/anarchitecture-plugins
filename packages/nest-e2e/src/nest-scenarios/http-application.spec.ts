// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';

const suite = usePackedPlugin();
it.each(
  ['node', 'express', 'fastify'].flatMap((platform) =>
    ['esm', 'cjs'].flatMap((type) =>
      (platform === 'fastify' ? [false, true] : [false]).map((observe) => ({
        platform,
        type,
        observe,
        adapter: {
          node: 'NodeAdapter',
          express: 'ExpressAdapter',
          fastify: 'FastifyAdapter',
        }[platform],
      }))
    )
  )
)(
  'runs a clean installed explicit $platform $type application (observe=$observe)',
  async ({ type, platform, adapter, observe }) => {
    const root = join(suite.root, platform + '-' + type + '-' + observe);
    const { yarn, env } = createInstalledConsumer(root, suite.tarball, {});
    const json = (path: string) =>
      JSON.parse(readFileSync(join(root, path), 'utf8'));
    const nxJson = json('nx.json');
    writeFileSync(
      join(root, 'nx.json'),
      JSON.stringify({
        ...nxJson,
        generators: {
          '@anarchitects/nest:application': {
            platform:
              platform === 'fastify'
                ? observe
                  ? 'fastify'
                  : type === 'esm'
                  ? 'node'
                  : 'express'
                : platform === 'express' && type === 'esm'
                ? 'fastify'
                : 'node',
          },
        },
      })
    );
    const generate = [
      'nx',
      'g',
      '@anarchitects/nest:application',
      'api',
      '--directory=packages/api',
      `--type=${type}`,
      '--packageManager=yarn',
      ...(platform !== 'node' && !(platform === 'fastify' && observe)
        ? [`--platform=${platform}`]
        : []),
      ...(observe ? ['--observe'] : []),
      '--no-interactive',
    ];
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
    const manifest = readFileSync(join(root, 'package.json'), 'utf8');
    expect(() => yarn([...generate, '--platform=Fastify'])).toThrow();
    yarn([...generate, '--dry-run']);
    expect(existsSync(join(root, 'packages/api'))).toBe(false);
    expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
    if (type === 'esm') {
      yarn([...generate, '--skipInstall']);
      expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
      yarn(['install']);
    } else {
      yarn(generate);
      expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).not.toBe(lock);
    }
    yarn(generate);
    const versions = JSON.parse(
      yarn(
        [
          'node',
          '-e',
          `
    const {createRequire}=require('node:module');
    const {realpathSync}=require('node:fs');
    const local=createRequire(require('node:path').resolve('packages/api/package.json'));
    console.log(JSON.stringify(Object.fromEntries(['common','core','testing','platform-${platform}',...('${platform}'==='fastify'?['platform-express']:[])].map(name=>{
      const path=local.resolve('@nestjs/'+name+'/package.json');
      if(!realpathSync(path).startsWith(process.cwd()+'/')) throw new Error('External framework link: '+path);
      return [name,local(path).version];
    }))));
  `,
        ],
        undefined,
        true
      )
    );
    expect(versions).toEqual({
      common: '12.5.0',
      core: '12.5.0',
      testing: '12.5.0',
      ['platform-' + platform]: '12.5.0',
      ...(platform === 'fastify' ? { 'platform-express': '12.5.0' } : {}),
    });
    const generatedManifest = json('packages/api/package.json');
    if (platform !== 'node')
      expect(
        generatedManifest.dependencies['@nestjs/platform-node']
      ).toBeUndefined();
    if (platform === 'fastify') {
      for (const name of [
        'fastify',
        'express',
        '@fastify/multipart',
        '@fastify/static',
        '@fastify/view',
        'zod',
        '@nestjs/swagger',
      ])
        expect(generatedManifest.dependencies[name]).toBeUndefined();
    }
    const main = readFileSync(join(root, 'packages/api/src/main.ts'), 'utf8');
    expect(main).toContain(`new ${adapter}()`);
    const specPath = join(root, 'packages/api/test/app.e2e-spec.ts');
    const spec = readFileSync(specPath, 'utf8');
    expect(spec).toContain(`new ${adapter}()`);
    expect(
      spec.includes('await app.getHttpAdapter().getInstance().ready();')
    ).toBe(platform === 'fastify');
    expect(main.includes('instrument: ObserveInstrument')).toBe(observe);
    // Assert the running adapter, alongside the native HTTP assertion and cleanup.
    writeFileSync(
      specPath,
      spec.replace(
        'await app.init();',
        `await app.init();\n    expect(app.getHttpAdapter().getType()).toBe('${platform}');`
      )
    );
    yarn([
      'nx',
      'run-many',
      '-t',
      'build',
      ...(type === 'esm' ? ['test', 'test:e2e'] : []),
      'lint',
      '-p',
      'api',
      '--skipNxCache',
      '--parallel=1',
      '--output-style=static',
    ]);
    if (type === 'cjs') {
      // Preserve the documented native CJS scripts and default Yarn hoisting.
      // Resolve Jest through the package manager, as in cjs-jest-consumer.ts.
      for (const args of [[], ['--config', './test/jest-e2e.json']])
        yarn(
          [
            'nx',
            'exec',
            '--projects=api',
            '--',
            'yarn',
            'jest',
            '--runInBand',
            ...args,
          ],
          '--experimental-vm-modules'
        );
    }
    await assertHttp(root, env, 'api:start', '/', 'Hello World!');
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:resource',
      'orders',
      '--project=api',
      '--type=rest',
      '--crud',
      '--no-interactive',
    ]);
    expect(readFileSync(join(root, 'packages/api/src/main.ts'), 'utf8')).toBe(
      main
    );
    yarn(['nx', 'run', 'api:build']);
    await assertHttp(
      root,
      env,
      'api:start',
      '/orders',
      'This action returns all orders'
    );
  },
  360_000
);
