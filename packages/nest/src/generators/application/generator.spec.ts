// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Real Node exercises native ESM factories and the emitted generator, avoiding
// Jest's CommonJS transform of import(). Host side effects are forbidden.
function runApplication(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nest-application-'));
  try {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const cp = require('node:child_process');
      const { createRequire, syncBuiltinESMExports } = require('node:module');
      const local = createRequire(${JSON.stringify(
        resolve(__dirname, '../../../package.json')
      )});
      const { createTreeWithEmptyWorkspace } = local('@nx/devkit/testing');
      const { applicationGenerator } = local('./dist/generators/application/generator.js');
      const { runNestSchematic } = local('./dist/generation-adapter/run-nest-schematic.js');
      const { snapshotNxTree } = local('./dist/generation-adapter/tree-snapshot.js');
      const tree = createTreeWithEmptyWorkspace();
      const forbidden = operation => () => { throw new Error('Forbidden host side effect: ' + operation); };
      for (const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) cp[key] = forbidden(key);
      for (const key of ['writeFile','appendFile','mkdir','rm','rmdir','unlink','rename','copyFile','symlink']) {
        fs[key] = forbidden(key);
        fs[key + 'Sync'] = forbidden(key);
        fs.promises[key] = forbidden(key);
      }
      process.exit = forbidden('exit');
      process.chdir = forbidden('chdir');
      syncBuiltinESMExports();
      (async () => {
        ${assertions}
        console.log('APPLICATION_OK');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      {
        cwd,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_NO_CLOUD: 'true',
        },
      }
    );
    expect(output).toContain('APPLICATION_OK');
    expect(readdirSync(cwd)).toEqual([]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('native Nest application generator', () => {
  it('keeps its public option surface and defaults aligned with the pinned native schema', () => {
    const nativeRoot = dirname(
      require.resolve('@nestjs/schematics/package.json')
    );
    const native = JSON.parse(
      readFileSync(join(nativeRoot, 'dist/lib/application/schema.json'), 'utf8')
    );
    const wrapper = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../schemas/application.json'),
        'utf8'
      )
    );
    expect(wrapper.properties).toEqual(native.properties);
    expect(wrapper.required).toEqual(native.required);
  });

  it.each([
    { options: { name: 'MyApi' }, root: 'my-api', name: 'my-api' },
    {
      options: { name: 'api', directory: 'apps/backend', type: 'cjs' },
      root: 'apps/backend',
      name: 'api',
    },
    {
      options: {
        name: '@team/api',
        directory: 'services/api',
        observe: true,
        strict: false,
        spec: false,
        packageManager: 'yarn',
        author: 'Team',
        description: 'API',
        version: '1.2.3',
      },
      root: 'services/api',
      name: '@team/api',
    },
    {
      options: {
        name: 123,
        directory: 'apps/numeric',
        specFileSuffix: 'test',
        packageManager: 'pnpm',
      },
      root: 'apps/numeric',
      name: '123',
    },
    {
      options: { name: 'formatted', directory: 'apps/formatted', format: true },
      root: 'apps/formatted',
      name: 'formatted',
    },
  ])('preserves every native byte for $options', ({ options, root, name }) => {
    runApplication(String.raw`
      const options = ${JSON.stringify(options)};
      const expected = createTreeWithEmptyWorkspace();
      const unrelated = 'export  const   untouched={value:1}';
      for (const target of [tree, expected]) target.write('existing/source.ts', unrelated);
      const originalRootManifest = tree.read('package.json');
      const originalOptions = structuredClone(options);
      await runNestSchematic(expected, {schematic:'application', options});
      await applicationGenerator(tree, options);
      assert.deepEqual(options, originalOptions);
      for (const [path, bytes] of snapshotNxTree(expected)) {
        if (path !== 'nx.json') assert.deepEqual(tree.read(path), bytes, path);
      }
      assert.equal(tree.read('existing/source.ts','utf8'), unrelated);
      assert.deepEqual(tree.read('package.json'), originalRootManifest);
      const root = ${JSON.stringify(root)};
      assert.deepEqual(JSON.parse(tree.read(root+'/project.json','utf8')), {
        name: ${JSON.stringify(
          name
        )}, projectType:'application', sourceRoot:root+'/src'
      });
      const manifest = JSON.parse(tree.read(root+'/package.json','utf8'));
      assert.equal(manifest.name, ${JSON.stringify(name)});
      assert.equal(manifest.type, options.type === 'cjs' ? undefined : 'module');
      assert.match(manifest.scripts.test, options.type === 'cjs' ? /jest/ : /vitest/);
      assert.match(manifest.scripts.lint, /oxlint/);
      assert.equal(JSON.parse(tree.read(root+'/tsconfig.json','utf8')).compilerOptions.module, 'nodenext');
      if (options.observe) {
        assert.ok(manifest.dependencies['@nestjs/observe']);
        assert.match(tree.read(root+'/src/main.ts','utf8'), /ObserveInstrument/);
      }
      assert.deepEqual(JSON.parse(tree.read('nx.json','utf8')).plugins, ['@anarchitects/nest/plugin']);
      const beforeRepeat = snapshotNxTree(tree);
      await applicationGenerator(tree, options);
      assert.deepEqual(snapshotNxTree(tree), beforeRepeat);
    `);
  });

  it('preserves existing registration options and additive metadata', () => {
    runApplication(String.raw`
      const plugins = [{plugin:'@anarchitects/nest/plugin',options:{buildTargetName:'compile',startTargetName:'serve'}}];
      tree.write('nx.json', JSON.stringify({plugins, defaultBase:'develop'}));
      tree.write('apps/api/project.json',JSON.stringify({name:'api',tags:['existing']}));
      await applicationGenerator(tree, {name:'api',directory:'apps/api'});
      assert.deepEqual(JSON.parse(tree.read('nx.json','utf8')), {plugins,defaultBase:'develop'});
      assert.deepEqual(JSON.parse(tree.read('apps/api/project.json','utf8')).tags, ['existing']);
    `);
  });

  it('rejects invalid paths, duplicate names, and native conflicts without partial changes', () => {
    runApplication(String.raw`
      tree.write('existing/project.json',JSON.stringify({name:'taken'}));
      tree.write('apps/conflict/src/main.ts','user-owned');
      const before = snapshotNxTree(tree);
      for (const options of [
        {name:''}, {name:'.'}, {name:'api',directory:'.'},
        {name:'api',directory:'../outside'}, {name:'api',directory:'/absolute'},
        {name:'taken',directory:'apps/taken'}, {name:'bad',type:'invalid'},
        {name:'conflict',directory:'apps/conflict'}
      ]) {
        await assert.rejects(applicationGenerator(tree,options));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
    `);
  });
});
