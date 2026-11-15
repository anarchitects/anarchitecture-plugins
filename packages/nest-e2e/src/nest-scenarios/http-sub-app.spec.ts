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
it.each(
  ['node', 'express', 'fastify'].flatMap((platform) =>
    ['esm', 'cjs'].flatMap((type) =>
      (platform === 'fastify'
        ? ['express', 'node', 'custom']
        : ['existing']
      ).map((ownerPlatform) => ({
        platform,
        type,
        ownerPlatform,
        adapter: {
          node: 'NodeAdapter',
          express: 'ExpressAdapter',
          fastify: 'FastifyAdapter',
        }[platform],
      }))
    )
  )
)(
  'preserves a $ownerPlatform $type owner and runs its explicit $platform member',
  async ({ type, platform, adapter, ownerPlatform }) => {
    const root = join(suite.root, platform + '-' + type + '-' + ownerPlatform);
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
      ...(platform === 'express' && type === 'esm' ? ['--platform=node'] : []),
      ...(platform === 'fastify'
        ? [
            `--platform=${ownerPlatform === 'node' ? 'node' : 'express'}`,
            '--observe',
          ]
        : []),
      '--skipInstall',
      '--no-interactive',
    ]);
    if (platform !== 'node') {
      const nxPath = join(root, 'nx.json');
      const nxConfig = JSON.parse(readFileSync(nxPath, 'utf8'));
      nxConfig.generators = {
        '@anarchitects/nest:sub-app': {
          platform:
            platform === 'fastify'
              ? ownerPlatform === 'custom'
                ? 'fastify'
                : ownerPlatform
              : type === 'esm'
              ? 'node'
              : 'fastify',
        },
      };
      writeFileSync(nxPath, JSON.stringify(nxConfig));
    }
    const generate = [
      'nx',
      'g',
      '@anarchitects/nest:app',
      'worker',
      '--project=api',
      ...(ownerPlatform === 'custom' ? [] : [`--platform=${platform}`]),
      '--rootDir=apps',
      '--no-interactive',
    ];
    const beforeInstall = snapshotFiles(owner);
    expect(() => yarn([...generate, '--skipInstall'])).toThrow(
      new RegExp(
        `cannot generate (a|an) ${
          platform === 'node'
            ? 'Node'
            : platform === 'express'
            ? 'Express'
            : 'Fastify'
        } sub-app`
      )
    );
    expect(snapshotFiles(owner)).toEqual(beforeInstall);
    // An explicit consumer upgrade, never a generator-side dependency upgrade.
    const manifest = JSON.parse(read('package.json'));
    for (const name of ['common', 'core', 'platform-express'])
      manifest.dependencies['@nestjs/' + name] = '12.3.0';
    manifest.devDependencies['@nestjs/testing'] = '12.3.0';
    if (manifest.dependencies['@nestjs/platform-node'])
      manifest.dependencies['@nestjs/platform-node'] = '12.3.0';
    if (type === 'cjs' && platform !== 'fastify') {
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
    if (ownerPlatform === 'custom') {
      for (const file of ['src/main.ts', 'test/app.e2e-spec.ts']) {
        writeFileSync(
          join(owner, file),
          read(file)
            .replace('new ExpressAdapter()', 'new CustomAdapter()')
            .replace(
              file.startsWith('src/')
                ? 'async function bootstrap()'
                : 'describe(',
              '\nclass CustomAdapter extends ExpressAdapter {\n  override getType(): string { return "express"; }\n}\n' +
                (file.startsWith('src/')
                  ? 'async function bootstrap()'
                  : 'describe(')
            )
        );
      }
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
    expect(next.dependencies['@nestjs/platform-' + platform]).toBe('12.3.0');
    if (platform === 'fastify') {
      // Read actual consumer-local installations, rather than trusting ranges.
      const versions = yarn(
        [
          'node',
          '-e',
          `
        const {createRequire}=require('node:module');
        const {realpathSync}=require('node:fs');
        const local=createRequire(require('node:path').resolve('services/api/package.json'));
        console.log(JSON.stringify(Object.fromEntries(['common','core','testing','platform-fastify','platform-express',...('${ownerPlatform}'==='node'?['platform-node']:[])].map(name=>{
          const path=local.resolve('@nestjs/'+name+'/package.json');
          if(!realpathSync(path).startsWith(process.cwd()+'/')) throw new Error('External framework link: '+path);
          return [name,local(path).version];
        }))));
      `,
        ],
        undefined,
        true
      );
      expect(Object.values(JSON.parse(versions))).toEqual(
        Array(ownerPlatform === 'node' ? 6 : 5).fill('12.3.0')
      );
      expect(read('apps/api/src/main.ts')).toContain(
        'instrument: ObserveInstrument'
      );
      expect(read('apps/worker/src/main.ts')).not.toContain('Observe');
      for (const name of [
        'fastify',
        '@fastify/multipart',
        '@fastify/static',
        '@fastify/view',
        '@nestjs/swagger',
        'zod',
      ])
        expect(next.dependencies[name]).toBeUndefined();
      // Reuse the adapter without changing dependencies or prior member source.
      const priorMember = snapshotFiles(join(owner, 'apps/worker'));
      yarn([
        'nx',
        'g',
        '@anarchitects/nest:sub-app',
        'second',
        '--project=api',
        '--platform=fastify',
        '--skipInstall',
        '--no-interactive',
      ]);
      expect(JSON.parse(read('package.json')).dependencies).toEqual(
        next.dependencies
      );
      expect(snapshotFiles(join(owner, 'apps/worker'))).toEqual(priorMember);
    }
    const stable = snapshotFiles(owner);
    expect(() => yarn(generate)).toThrow(/exists/);
    expect(snapshotFiles(owner)).toEqual(stable);
    const member = 'apps/worker';
    expect(read(member + '/src/main.ts')).toContain(`new ${adapter}()`);
    const specPath = member + '/test/app.e2e-spec.ts';
    expect(
      read(specPath).includes(
        'await app.getHttpAdapter().getInstance().ready();'
      )
    ).toBe(platform === 'fastify');
    writeFileSync(
      join(owner, specPath),
      read(specPath).replace(
        'await app.init();',
        `await app.init();\n    expect(app.getHttpAdapter().getType()).toBe('${platform}');`
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
        join(owner, 'http-jest-e2e.json'),
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
          'http-jest-e2e.json',
          '--runInBand',
        ],
        '--experimental-vm-modules'
      );
    }
    yarn(['nx', 'run', 'api:lint']);
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
