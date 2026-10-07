// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Exercise the compiled CommonJS adapter in real Node, not Jest's ESM VM shim.
// Each invocation runs outside the repository and forbids host mutations.
function runNative(assertions: string): void {
  const root = mkdtempSync(join(tmpdir(), 'nest-adapter-'));
  try {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const childProcess = require('node:child_process');
      const { createRequire, syncBuiltinESMExports } = require('node:module');
      const requirePlugin = createRequire(${JSON.stringify(
        resolve(__dirname, '../../package.json')
      )});
      const { createTreeWithEmptyWorkspace } = requirePlugin('@nx/devkit/testing');
      const { runNestSchematic } = requirePlugin('./dist/generation-adapter/run-nest-schematic.js');
      const { snapshotNxTree } = requirePlugin('./dist/generation-adapter/tree-snapshot.js');
      const tree = createTreeWithEmptyWorkspace();
      tree.write('package.json', JSON.stringify({name:'test',type:'module',dependencies:{'@nestjs/common':'12.1.2'}}));
      const cwd = process.cwd();
      const forbidden = operation => () => { throw new Error('Forbidden host side effect: ' + operation); };
      for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) childProcess[key] = forbidden(key);
      for (const key of ['writeFile', 'appendFile', 'mkdir', 'rm', 'rmdir', 'unlink', 'rename', 'copyFile', 'symlink', 'chmod']) {
        fs[key] = forbidden(key);
        fs[key + 'Sync'] = forbidden(key + 'Sync');
        fs.promises[key] = forbidden(key);
      }
      process.exit = forbidden('exit');
      process.chdir = forbidden('chdir');
      syncBuiltinESMExports();
      (async () => {
        ${assertions}
        assert.equal(process.cwd(), cwd);
        console.log('ADAPTER_OK');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_NO_CLOUD: 'true',
          NODE_OPTIONS: '',
        },
        encoding: 'utf8',
        timeout: 30_000,
        stdio: 'pipe',
      }
    );
    expect(output).toContain('ADAPTER_OK');
    expect(readdirSync(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('stable native Nest schematic adapter', () => {
  it('runs the real ESM collection with native defaults, aliases, and unchanged framework output', () => {
    runNative(`
      const options = {name:'sample',sourceRoot:'src'};
      const before = structuredClone(options);
      const result = await runNestSchematic(tree, {schematic:'cl',options});
      assert.equal(result.schematicVersion, '12.0.6');
      assert.deepEqual(options, before);
      assert.deepEqual(result.deferredTasks, []);
      assert.equal(tree.read('src/sample.ts','utf8'), 'export class Sample {}\\n');
      assert.match(tree.read('src/sample.spec.ts','utf8'), /from '\\.\\/sample\\.js'/);
      assert.deepEqual(result.changes.map(change => change.path), ['src/sample.spec.ts','src/sample.ts']);
    `);
  });

  it('previews native files and post-processing without mutating the Nx Tree or disk', () => {
    runNative(`
      const before = snapshotNxTree(tree);
      const result = await runNestSchematic(tree, {
        schematic:'class', options:{name:'preview',sourceRoot:'src'}, dryRun:true,
        postTransform: guard => guard.addJsonProperties('package.json',{nx:{tags:['nest']}})
      });
      assert.deepEqual(snapshotNxTree(tree), before);
      assert.ok(result.changes.some(change => change.path === 'src/preview.ts'));
      assert.ok(result.changes.some(change => change.path === 'package.json' && change.type === 'update'));
    `);
  });

  it('records native dependency installation tasks without executing them', () => {
    runNative(`
      const result = await runNestSchematic(tree, {schematic:'resource',options:{name:'cats',sourceRoot:'src',type:'rest',skipImport:true,spec:false,crud:true}});
      assert.equal(result.deferredTasks.length, 1);
      assert.equal(result.deferredTasks[0].name, 'node-package');
      assert.ok(JSON.parse(tree.read('package.json','utf8')).dependencies['@nestjs/mapped-types']);
      assert.ok(tree.exists('src/cats/cats.controller.ts'));
    `);
  });

  it('rolls back all staged generation if post-processing tries to patch native source', () => {
    runNative(`
      const before = snapshotNxTree(tree);
      await assert.rejects(runNestSchematic(tree, {
        schematic:'class',options:{name:'sample',sourceRoot:'src'},
        postTransform: guard => guard.createFile('src/sample.ts','patched')
      }), /cannot overwrite/);
      assert.deepEqual(snapshotNxTree(tree), before);
    `);
  });

  it('rejects invalid options, conflicting native files, and migration entrypoints without partial changes', () => {
    runNative(`
      tree.write('src/sample.ts','user content');
      const before = snapshotNxTree(tree);
      await assert.rejects(runNestSchematic(tree, {schematic:'class',options:{}}));
      await assert.rejects(runNestSchematic(tree, {schematic:'class',options:{name:'sample',sourceRoot:'src'}}));
      await assert.rejects(runNestSchematic(tree, {schematic:'upgrade',options:{}}), /Unsupported/);
      await assert.rejects(runNestSchematic(tree, {schematic:'update',options:{}}), /Unsupported/);
      assert.deepEqual(snapshotNxTree(tree), before);
    `);
  });
});
