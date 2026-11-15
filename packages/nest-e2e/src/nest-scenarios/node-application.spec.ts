// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';

const suite = usePackedPlugin();
it.each(['esm', 'cjs'])(
  'runs a clean installed explicit Node %s application',
  async (type) => {
    const root = join(suite.root, type);
    const { yarn, env } = createInstalledConsumer(root, suite.tarball, {});
    const json = (path: string) =>
      JSON.parse(readFileSync(join(root, path), 'utf8'));
    const nxJson = json('nx.json');
    writeFileSync(
      join(root, 'nx.json'),
      JSON.stringify({
        ...nxJson,
        generators: { '@anarchitects/nest:application': { platform: 'node' } },
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
      '--no-interactive',
    ];
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
    const manifest = readFileSync(join(root, 'package.json'), 'utf8');
    expect(() => yarn([...generate, '--platform=fastify'])).toThrow();
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
    console.log(JSON.stringify(Object.fromEntries(['common','core','testing','platform-node'].map(name=>{
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
      common: '12.3.0',
      core: '12.3.0',
      testing: '12.3.0',
      'platform-node': '12.3.0',
    });
    const main = readFileSync(join(root, 'packages/api/src/main.ts'), 'utf8');
    expect(main).toContain('new NodeAdapter()');
    const specPath = join(root, 'packages/api/test/app.e2e-spec.ts');
    const spec = readFileSync(specPath, 'utf8');
    expect(spec).toContain('new NodeAdapter()');
    // Assert the running adapter, alongside the native HTTP assertion and cleanup.
    writeFileSync(
      specPath,
      spec.replace(
        'await app.init();',
        "await app.init();\n    expect(app.getHttpAdapter().getType()).toBe('node');"
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
