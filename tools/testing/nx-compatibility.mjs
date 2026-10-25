import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Pack once, then install into independent workspaces. Never publish packages or
// mutate repository versions. CI selects one exact Nx version per matrix job.
const repository = process.cwd();
const versions = (
  process.argv.find((arg) => arg.startsWith('--versions='))?.split('=')[1] ??
  '19.0.0,19.2.0,20.0.0,21.6.4,22.0.0,23.2.0,24.0.1'
).split(',');
assert(
  versions.every((version) => /^\d+\.\d+\.\d+$/.test(version)),
  'Use exact stable Nx versions'
);
const temporary = mkdtempSync(join(tmpdir(), 'nx-compatibility-'));
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !key.startsWith('NX_') &&
      ![
        'NODE_OPTIONS',
        'TS_NODE_COMPILER_OPTIONS',
        'VSCODE_INSPECTOR_OPTIONS',
      ].includes(key)
  )
);
Object.assign(env, {
  NX_DAEMON: 'false',
  NX_ISOLATE_PLUGINS: 'false',
  NX_NO_CLOUD: 'true',
  NX_INTERACTIVE: 'false',
  NX_TUI: 'false',
  NX_VERBOSE_LOGGING: 'true',
  FORCE_COLOR: '0',
  CI: 'true',
});
function run(command, args, cwd, timeout = 180_000) {
  try {
    return execFileSync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}\n${error.stdout ?? ''}\n${
        error.stderr ?? ''
      }`
    );
  }
}
function write(root, path, value) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'
  );
}
const read = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
try {
  const packages = {};
  for (const directory of [
    'governance',
    'governance-adapter-nx',
    'governance-extension-nx',
    'typeorm',
    'js',
    'nest',
  ]) {
    const root = join(repository, 'packages', directory);
    const [artifact] = JSON.parse(
      run(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
        root
      )
    );
    packages[read(root, 'package.json').name] = `file:${join(
      temporary,
      artifact.filename
    )}`;
  }
  for (const version of versions) {
    const major = Number(version.split('.')[0]);
    const adapterOnly = major === 19 && Number(version.split('.')[1]) < 2;
    const root = join(temporary, `nx-${version}`);
    const js = major >= 21;
    const nest = major >= 23;
    const dependencies = {
      nx: version,
      '@nx/devkit': version,
      ...(!adapterOnly
        ? {
            '@anarchitects/nx-governance':
              packages['@anarchitects/nx-governance'],
            '@anarchitects/nx-typeorm': packages['@anarchitects/nx-typeorm'],
          }
        : {}),
      '@anarchitects/governance-adapter-nx':
        packages['@anarchitects/governance-adapter-nx'],
      '@anarchitects/governance-extension-nx':
        packages['@anarchitects/governance-extension-nx'],
      typeorm: '1.0.0',
      'ts-node': '10.9.2',
      'reflect-metadata': '0.2.2',
      typescript: nest ? '6.0.3' : '5.9.3',
      ...(js
        ? {
            '@nx/js': version,
            '@anarchitects/nx-js': packages['@anarchitects/nx-js'],
          }
        : {}),
      ...(nest
        ? {
            '@anarchitects/nest': packages['@anarchitects/nest'],
            '@nestjs/cli': '12.0.0',
            '@nx/vite': version,
            '@nx/rollup': version,
            vite: '8.0.0',
            rollup: '4.52.4',
            '@rollup/plugin-typescript': '12.3.0',
          }
        : {}),
    };
    write(root, 'package.json', {
      name: 'compatibility-consumer',
      private: true,
      version: '1.0.0',
      dependencies,
      nx: {
        name: 'consumer',
        targets: {
          'typeorm-version': { executor: '@anarchitects/nx-typeorm:version' },
        },
      },
    });
    write(root, 'nx.json', { plugins: [] });
    write(root, '.gitignore', 'node_modules\n.nx\ndist\n');
    console.log(`[Nx ${version}] Installing packed plugins`);
    run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
      root
    );
    const require = createRequire(join(root, 'package.json'));
    const nxPackage = require('nx/package.json');
    const nxCli = resolve(
      dirname(require.resolve('nx/package.json')),
      nxPackage.bin.nx
    );
    assert.equal(nxPackage.version, version);
    assert.equal(require('@nx/devkit/package.json').version, version);
    for (const name of Object.keys(dependencies).filter(
      (name) =>
        name.startsWith('@anarchitects/') &&
        name !== '@anarchitects/governance-extension-nx'
    )) {
      const pluginRequire = createRequire(
        require.resolve(`${name}/package.json`)
      );
      assert.equal(
        pluginRequire('@nx/devkit/package.json').version,
        version,
        `${name} must use the host devkit`
      );
    }
    if (js) {
      const pluginRequire = createRequire(
        require.resolve('@anarchitects/nx-js/package.json')
      );
      assert.equal(pluginRequire('@nx/js/package.json').version, version);
    }
    const nx = (...args) => run(process.execPath, [nxCli, ...args], root);
    const generate = (...args) => nx('generate', ...args, '--no-interactive');
    if (adapterOnly) {
      write(root, 'apps/db/project.json', { name: 'db', root: 'apps/db' });
      run(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import assert from 'node:assert/strict'; import {readNxWorkspaceSnapshot} from '@anarchitects/governance-adapter-nx'; await import('@anarchitects/governance-extension-nx'); const snapshot=await readNxWorkspaceSnapshot(); assert(snapshot.projects.some(p=>p.name==='db'));`,
        ],
        root
      );
      console.log(`[Nx ${version}] PASS (adapter/extension only)`);
      continue;
    }
    console.log(`[Nx ${version}] Generators, inference and executors`);
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "await import('@anarchitects/nx-governance'); await import('@anarchitects/nx-typeorm');",
      ],
      root
    );
    generate(
      '@anarchitects/nx-governance:init',
      '--configureEslint=false',
      '--skipFormat'
    );
    generate('@anarchitects/nx-typeorm:init', '--skipInstall', '--skipFormat');
    const initialized = [
      'package.json',
      'nx.json',
      'tools/governance/profiles/frontend-layered.json',
    ].map((path) => readFileSync(join(root, path), 'utf8'));
    generate(
      '@anarchitects/nx-governance:init',
      '--configureEslint=false',
      '--skipFormat'
    );
    generate('@anarchitects/nx-typeorm:init', '--skipInstall', '--skipFormat');
    assert.deepEqual(
      [
        'package.json',
        'nx.json',
        'tools/governance/profiles/frontend-layered.json',
      ].map((path) => readFileSync(join(root, path), 'utf8')),
      initialized
    );
    write(root, 'apps/db/project.json', {
      name: 'db',
      root: 'apps/db',
      projectType: 'application',
    });
    write(
      root,
      'apps/db/src/data-source.ts',
      'export const datasource = {};\n'
    );
    const db = JSON.parse(nx('show', 'project', 'db', '--json'));
    assert(
      Object.values(db.targets).some(
        (target) => target.executor === '@anarchitects/nx-typeorm:run'
      )
    );
    const consumer = JSON.parse(nx('show', 'project', 'consumer', '--json'));
    assert.equal(
      consumer.targets['repo-boundaries'].executor,
      '@anarchitects/nx-governance:repo-boundaries'
    );
    nx(
      'run',
      'consumer:repo-health',
      '--output=json',
      '--failOnViolation=false'
    );
    nx('run', 'consumer:typeorm-version');
    // Read the live graph through the packed adapter, not a mock graph.
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import assert from 'node:assert/strict'; import {readNxWorkspaceSnapshot} from '@anarchitects/governance-adapter-nx'; const snapshot=await readNxWorkspaceSnapshot(); assert(snapshot.projects.some(p=>p.name==='db'));`,
      ],
      root
    );
    if (js) {
      console.log(
        `[Nx ${version}] JS secondary entry point and real tsc build`
      );
      write(root, 'tsconfig.base.json', {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          skipLibCheck: true,
          ...(nest ? { ignoreDeprecations: '6.0' } : {}),
        },
      });
      write(root, 'libs/plain/package.json', {
        name: '@consumer/plain',
        version: '1.0.0',
      });
      write(root, 'libs/plain/project.json', {
        name: 'plain',
        root: 'libs/plain',
        sourceRoot: 'libs/plain/src',
        targets: {
          build: {
            executor: '@nx/js:tsc',
            options: {
              main: 'libs/plain/src/index.ts',
              tsConfig: 'libs/plain/tsconfig.lib.json',
              outputPath: 'dist/plain',
            },
          },
        },
      });
      write(root, 'libs/plain/tsconfig.lib.json', {
        extends: '../../tsconfig.base.json',
        compilerOptions: { declaration: true },
        include: ['src/**/*.ts'],
      });
      write(root, 'libs/plain/src/index.ts', 'export const primary = 1;\n');
      generate(
        '@anarchitects/nx-js:secondary-entry-point',
        '--project=plain',
        '--name=feature',
        '--skipFormat'
      );
      nx('build', 'plain');
      const exported = read(root, 'dist/plain/package.json').exports[
        './feature'
      ];
      assert(exported, 'tsc build must publish the secondary export');
      const runtimeEntry =
        typeof exported === 'string'
          ? exported
          : exported.default ?? exported.require ?? exported.import;
      assert.equal(
        require(join(root, 'dist/plain', runtimeEntry)).feature(),
        'feature'
      );
    }
    if (nest) {
      console.log(
        `[Nx ${version}] Nest generation and inferred Vite/Rollup builds`
      );
      generate(
        '@anarchitects/nest:init',
        '--buildTargetName=compile',
        '--startTargetName=serve'
      );
      generate(
        '@anarchitects/nest:application',
        'api',
        '--directory=apps/api',
        '--skipInstall'
      );
      const api = JSON.parse(nx('show', 'project', 'api', '--json'));
      assert.equal(
        api.targets.compile.options.command ?? api.targets.compile.command,
        'nest build'
      );
      assert.equal(api.targets.serve.continuous, true);
      const nxJson = read(root, 'nx.json');
      nxJson.plugins.push(
        { plugin: '@nx/vite/plugin', options: { buildTargetName: 'build' } },
        { plugin: '@nx/rollup/plugin', options: { buildTargetName: 'build' } }
      );
      write(root, 'nx.json', nxJson);
      for (const bundler of ['vite', 'rollup']) {
        const projectRoot = `libs/${bundler}`;
        write(root, `${projectRoot}/project.json`, {
          name: bundler,
          root: projectRoot,
          sourceRoot: `${projectRoot}/src`,
          targets: { build: { dependsOn: [] } },
        });
        write(root, `${projectRoot}/package.json`, {
          name: `@consumer/${bundler}`,
          version: '1.0.0',
          type: 'module',
        });
        write(
          root,
          `${projectRoot}/src/index.ts`,
          'export const primary = 1;\n'
        );
        write(root, `${projectRoot}/tsconfig.json`, {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            skipLibCheck: true,
          },
          include: ['src/**/*.ts'],
        });
        write(
          root,
          `${projectRoot}/${bundler}.config.mjs`,
          bundler === 'vite'
            ? `export default { build: { lib: { entry: 'src/index.ts', formats: ['es'], fileName: (_format, name) => name + '.js' } } };\n`
            : `import typescript from '@rollup/plugin-typescript'; export default { input: 'src/index.ts', output: { dir: 'dist', format: 'es', entryFileNames: '[name].js' }, plugins: [typescript({ tsconfig: new URL('./tsconfig.json', import.meta.url).pathname })] };\n`
        );
        generate(
          '@anarchitects/nx-js:secondary-entry-point',
          `--project=${bundler}`,
          '--name=feature',
          '--skipFormat'
        );
        const project = JSON.parse(nx('show', 'project', bundler, '--json'));
        assert.equal(project.targets.build.executor, 'nx:run-commands');
        assert.equal(
          project.targets.build.options.additionalEntryPoints,
          undefined
        );
        nx('build', bundler);
        run(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import assert from 'node:assert/strict'; import {feature} from './${projectRoot}/dist/feature/index.js'; assert.equal(feature(),'feature');`,
          ],
          root
        );
      }
    }
    console.log(`[Nx ${version}] PASS`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
