// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Real Node exercises native ESM factories and the emitted generator, avoiding
// Jest's CommonJS transform of import(). Host side effects are forbidden.
function runConfiguration(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nest-configuration-'));
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
      const { configurationGenerator } = local('./dist/generators/configuration/generator.js');
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
        console.log('CONFIGURATION_OK');
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
    expect(output).toContain('CONFIGURATION_OK');
    expect(readdirSync(cwd)).toEqual([]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('native Nest configuration generator', () => {
  it.each([
    { root: '.', options: {} },
    { root: '.', options: { language: 'js' } },
    { root: 'services/api', options: { directory: 'services/api' } },
    { root: 'services/api', options: { project: 'api', language: 'js' } },
    {
      root: 'services/api',
      options: { project: 'api', collection: '@example/schematics' },
    },
  ])('matches native output for $options', ({ root, options }) => {
    runConfiguration(String.raw`
      const root=${JSON.stringify(root)};
      const options=${JSON.stringify(options)};
      const expected=createTreeWithEmptyWorkspace();
      for(const target of [tree,expected]) {
        if(root!=='.') target.write(root+'/project.json',JSON.stringify({name:'api',targets:{custom:{command:'echo untouched'}}}));
        target.write('unrelated.txt','keep exact bytes');
      }
      const {project,directory,...nativeOptions}=options;
      await runNestSchematic(expected,{schematic:'configuration',options:{...nativeOptions,project:root}});
      const original=structuredClone(options);
      await configurationGenerator(tree,options);
      assert.deepEqual(options,original);
      const actualFiles=snapshotNxTree(tree), expectedFiles=snapshotNxTree(expected);
      actualFiles.delete('nx.json'); expectedFiles.delete('nx.json');
      assert.deepEqual(actualFiles,expectedFiles);
      assert.deepEqual(JSON.parse(tree.read('nx.json','utf8')).plugins,['@anarchitects/nest/plugin']);
      const config=JSON.parse(tree.read((root==='.'?'':root+'/')+'nest-cli.json','utf8'));
      assert.equal(config.sourceRoot,'src');
      assert.equal(config.collection,options.collection??'@nestjs/schematics');
      assert.equal(config.language,options.language==='js'?'js':undefined);
      const before=snapshotNxTree(tree);
      await configurationGenerator(tree,options);
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
  });

  it.each([
    '{ "sourceRoot": "custom", "compilerOptions": {"builder":"rspack"}, "projects": {"worker":{"root":"apps/worker"}} }',
    '// Keep my comments\n{"sourceRoot":"src"}',
    '{ invalid config',
    '',
  ])(
    'preserves differing existing configuration atomically: %s',
    (contents) => {
      runConfiguration(String.raw`
      tree.write('services/api/package.json','{"name":"api"}');
      tree.write('services/api/nest-cli.json',${JSON.stringify(contents)});
      const before=snapshotNxTree(tree);
      await assert.rejects(configurationGenerator(tree,{directory:'services/api'}),/existing configuration is preserved/);
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
    }
  );

  it('preserves custom plugin registration, project metadata, and all unrelated config', () => {
    runConfiguration(String.raw`
      const plugins=[{plugin:'@anarchitects/nest/plugin',include:['services/**'],options:{buildTargetName:'compile',startTargetName:'serve',future:'keep'}}];
      tree.write('nx.json',JSON.stringify({plugins,namedInputs:{custom:['keep']}}));
      tree.write('services/api/project.json','{"name":"api","targets":{"build":{"command":"custom"}},"tags":["existing"]}');
      tree.write('services/api/tsconfig.json','{"compilerOptions":{"outDir":"custom"}}');
      const before=snapshotNxTree(tree);
      await configurationGenerator(tree,{project:'api'});
      for(const [path,bytes] of before) assert.deepEqual(tree.read(path),bytes);
      assert.ok(tree.exists('services/api/nest-cli.json'));
    `);
  });

  it('rejects invalid paths, selection, options, or plugin registration before staging changes', () => {
    runConfiguration(String.raw`
      for(const options of [{directory:'../outside'},{directory:'/absolute'},{directory:'node_modules/api'},{directory:'.git'},{directory:''},{directory:'unowned'},{project:'missing'},{project:'api',directory:'.'},{language:'invalid'},{collection:''},{collection:'bad"name'},{collection:'bad\nname'}]) {
        const before=snapshotNxTree(tree);
        await assert.rejects(configurationGenerator(tree,options));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
      tree.write('nx.json',JSON.stringify({plugins:[{plugin:'@anarchitects/nest/plugin',options:{buildTargetName:'same',startTargetName:'same'}}]}));
      const before=snapshotNxTree(tree);
      await assert.rejects(configurationGenerator(tree),/must be different/);
      assert.deepEqual(snapshotNxTree(tree),before);
      tree.delete('nx.json');
      await assert.rejects(configurationGenerator(tree),/existing Nx workspace/);
      assert.equal(tree.exists('nest-cli.json'),false);
    `);
  });
});
