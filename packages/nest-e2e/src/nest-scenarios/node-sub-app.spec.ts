// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';

function snapshotFiles(root: string, directory = ''): Record<string, string> {
  return Object.fromEntries(
    readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
      (entry) => {
        if (['node_modules', 'dist', '.nx', 'coverage'].includes(entry.name))
          return [];
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? Object.entries(snapshotFiles(root, path))
          : [[path, readFileSync(join(root, path)).toString('base64')]];
      }
    )
  );
}
const suite = usePackedPlugin();
it.each(['esm', 'cjs'])(
  'preserves a mixed %s owner and runs its explicit Node member',
  async (type) => {
    const root = join(suite.root, type);
    const { yarn, env } = createInstalledConsumer(root, suite.tarball, {});
    const owner = join(root, 'services/api');
    const read = (file: string) => readFileSync(join(owner, file), 'utf8');
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:application',
      'api',
      '--directory=services/api',
      `--type=${type}`,
      '--skipInstall',
      '--no-interactive',
    ]);
    const generate = [
      'nx',
      'g',
      '@anarchitects/nest:app',
      'worker',
      '--project=api',
      '--platform=node',
      '--rootDir=apps',
      '--no-interactive',
    ];
    const beforeInstall = snapshotFiles(owner);
    expect(() => yarn([...generate, '--skipInstall'])).toThrow(
      /cannot generate a Node sub-app/
    );
    expect(snapshotFiles(owner)).toEqual(beforeInstall);
    // An explicit consumer upgrade, never a generator-side dependency upgrade.
    const manifest = JSON.parse(read('package.json'));
    for (const name of ['common', 'core', 'platform-express'])
      manifest.dependencies['@nestjs/' + name] = '12.3.0';
    manifest.devDependencies['@nestjs/testing'] = '12.3.0';
    if (type === 'cjs') {
      manifest.dependencies['@nestjs/platform-fastify'] = '12.3.0';
      writeFileSync(
        join(owner, 'src/main.ts'),
        "import { FastifyAdapter } from '@nestjs/platform-fastify';\n" +
          read('src/main.ts').replace(
            'NestFactory.create(AppModule)',
            'NestFactory.create(AppModule, new FastifyAdapter())'
          )
      );
    }
    writeFileSync(
      join(owner, 'package.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );
    yarn(['install']);
    const original = snapshotFiles(owner);
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
    yarn([...generate, '--dry-run']);
    expect(snapshotFiles(owner)).toEqual(original);
    expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
    if (type === 'esm') {
      yarn([...generate, '--skipInstall']);
      expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
      yarn(['install']);
    } else yarn(generate);
    for (const [path, bytes] of Object.entries(original)) {
      if (path.startsWith('src/') || path.startsWith('test/'))
        expect(
          readFileSync(join(owner, 'apps/api', path)).toString('base64')
        ).toBe(bytes);
    }
    const next = JSON.parse(read('package.json'));
    expect(next.dependencies).toMatchObject(manifest.dependencies);
    expect(next.dependencies['@nestjs/platform-node']).toBe('12.3.0');
    const stable = snapshotFiles(owner);
    expect(() => yarn(generate)).toThrow(/exists/);
    expect(snapshotFiles(owner)).toEqual(stable);
    const member = 'apps/worker';
    expect(read(member + '/src/main.ts')).toContain('new NodeAdapter()');
    const specPath = member + '/test/app.e2e-spec.ts';
    writeFileSync(
      join(owner, specPath),
      read(specPath).replace(
        'await app.init();',
        "await app.init();\n    expect(app.getHttpAdapter().getType()).toBe('node');"
      )
    );
    for (const name of ['api-api', 'api-worker']) {
      const project = JSON.parse(
        yarn(['nx', 'show', 'project', name, '--json'], undefined, true)
      );
      expect(project.targets.build.options.cwd).toBe('services/api');
      expect(project.targets.start.options.cwd).toBe('services/api');
      yarn(['nx', 'run', name + ':build', '--skipNxCache']);
      await assertHttp(root, env, name + ':start', '/', 'Hello World!');
    }
    if (type === 'esm') yarn(['nx', 'run', 'api:test:e2e']);
    else {
      const config = JSON.parse(read('apps/api/test/jest-e2e.json'));
      writeFileSync(
        join(owner, 'node-jest-e2e.json'),
        JSON.stringify({ ...config, rootDir: '.' })
      );
      yarn(
        [
          'nx',
          'exec',
          '--projects=api',
          '--',
          'yarn',
          'jest',
          '--config',
          'node-jest-e2e.json',
          '--runInBand',
        ],
        '--experimental-vm-modules'
      );
    }
    if (type === 'esm') yarn(['nx', 'run', 'api:lint']);
    else
      expect(() => yarn(['nx', 'run', 'api:lint'])).toThrow(
        /floating-promises/
      );
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:resource',
      'orders',
      '--project=api-worker',
      '--type=rest',
      '--crud',
      '--no-interactive',
    ]);
    yarn(['nx', 'run', 'api-worker:build']);
    await assertHttp(
      root,
      env,
      'api-worker:start',
      '/orders',
      'This action returns all orders'
    );
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:library',
      'shared',
      '--project=api',
      '--no-interactive',
    ]);
    yarn(['nx', 'run', 'api-shared:build']);
    expect(existsSync(join(owner, member, 'src/main.ts'))).toBe(true);
  },
  360_000
);
