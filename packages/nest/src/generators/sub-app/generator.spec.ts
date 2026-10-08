// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function runMembers(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nest-members-'));
  const hostManifest = JSON.stringify({ name: '@native/backend' });
  writeFileSync(join(cwd, 'package.json'), hostManifest);
  try {
    const result = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const { createRequire } = require('node:module');
      const local = createRequire(${JSON.stringify(
        resolve(__dirname, '../../../package.json')
      )});
      const {createTreeWithEmptyWorkspace} = local('@nx/devkit/testing');
      const {applicationGenerator} = local('./dist/generators/application/generator');
      const {subAppGenerator} = local('./dist/generators/sub-app/generator');
      const {libraryGenerator} = local('./dist/generators/library/generator');
      const {runNativeSchematic} = local('./dist/generation-adapter/run-native-schematic');
      const {snapshotNxTree} = local('./dist/generation-adapter/tree-snapshot');
      (async()=> { ${assertions}; console.log('MEMBERS_OK'); })().catch(e=>{console.error(e);process.exitCode=1});
    `,
      ],
      {
        cwd,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          NODE_ENV: 'production',
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_NO_CLOUD: 'true',
        },
      }
    );
    expect(result).toContain('MEMBERS_OK');
    expect(readdirSync(cwd)).toEqual(['package.json']);
    expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toBe(hostManifest);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('native Nest workspace members', () => {
  it('materializes native directory deletions without losing moved files or touching siblings', () => {
    runMembers(`
      const tree=createTreeWithEmptyWorkspace();
      await applicationGenerator(tree,{name:'api',directory:'packages/api'});
      tree.write('packages/api/src/nested/custom.txt','consumer content');
      tree.write('packages/api/src-other/keep.txt','sibling content');
      const originals=[...snapshotNxTree(tree)].filter(([p])=>p.startsWith('packages/api/src/') || p.startsWith('packages/api/test/'));
      const before=snapshotNxTree(tree);
      const {runNestSchematic}=local('./dist/generation-adapter/run-nest-schematic');
      const preview=await runNestSchematic(tree,{schematic:'sub-app',options:{name:'worker'},workingDirectory:'packages/api',isolateHostReads:true,dryRun:true});
      assert.deepEqual(snapshotNxTree(tree),before);
      assert.ok(preview.changes.some(c=>c.type==='delete' && c.path==='packages/api/src/app.controller.ts'));
      await subAppGenerator(tree,{name:'worker',project:'api',skipInstall:true});
      for(const [path,bytes] of originals) {
        assert.equal(tree.exists(path),false,path);
        assert.deepEqual(tree.read(path.replace('packages/api/','packages/api/apps/api/')),bytes,path);
      }
      assert.equal(tree.read('packages/api/src-other/keep.txt','utf8'),'sibling content');
    `);
  });

  it.each(['sub-app', 'library'])(
    'exposes all native %s options plus the Nx owner selector',
    (schematic) => {
      const nativeRoot = dirname(
        require.resolve('@nestjs/schematics/package.json')
      );
      const native = JSON.parse(
        readFileSync(
          join(nativeRoot, `dist/lib/${schematic}/schema.json`),
          'utf8'
        )
      );
      const wrapper = JSON.parse(
        readFileSync(
          resolve(__dirname, `../../../schemas/${schematic}.json`),
          'utf8'
        )
      );
      const { project, directory, skipInstall, ...properties } =
        wrapper.properties;
      if (schematic === 'library') {
        expect(directory.type).toBe('string');
        delete native.properties.prefix['x-prompt'];
        native.properties.language.description =
          'Nest library language. Nx-native libraries currently support ts only.';
        for (const key of ['prefix', 'path', 'rootDir']) {
          native.properties[key].description +=
            ' Native Nest mode only (requires project).';
        }
      } else expect(directory).toBeUndefined();
      expect(properties).toEqual(native.properties);
      expect(project.type).toBe('string');
      expect(skipInstall.type).toBe('boolean');
      expect(wrapper.required).toEqual(native.required);
    }
  );

  it.each(['esm', 'cjs'])(
    'matches native sub-app conversion and library output for %s, including a second sub-app',
    (type) => {
      runMembers(`
      const tree=createTreeWithEmptyWorkspace();
      await applicationGenerator(tree,{name:'@native/backend',directory:'services/backend',type:${JSON.stringify(
        type
      )}});
      const prefix='services/backend/';
      const initial=new Map([...snapshotNxTree(tree)].filter(([p])=>p.startsWith(prefix)).map(([p,b])=>[p.slice(prefix.length),b]));
      initial.delete('project.json');
      const first=await runNativeSchematic(initial,{schematic:'sub-app',options:{name:'worker'}});
      const second=await runNativeSchematic(first.after,{schematic:'sub-app',options:{name:'other'}});
      const expected=await runNativeSchematic(second.after,{schematic:'library',options:{name:'shared',prefix:'@domain',specFileSuffix:'test'}});
      // Host cwd has a different layout and NODE_ENV=test; the wrapper must use
      // its selected Tree and production native behavior in an isolated worker.
      process.env.NODE_ENV='test';
      await subAppGenerator(tree,{name:'worker',project:'@native/backend'});
      await subAppGenerator(tree,{name:'other',project:'@native/backend'});
      await libraryGenerator(tree,{name:'shared',project:'@native/backend',prefix:'@domain',specFileSuffix:'test'});
      for(const [p,b] of expected.after) {
        if(p==='package.json') {
          const actual=JSON.parse(tree.read(prefix+p,'utf8'));
          for(const dep of ['@rspack/core','webpack-node-externals','tsconfig-paths-webpack-plugin',...(${JSON.stringify(
            type
          )}==='esm'?['@swc/core','unplugin-swc']:[])]) {
            assert.ok(actual.devDependencies[dep]);
            delete actual.devDependencies[dep];
          }
          assert.equal(actual.scripts.lint,local('./dist/utils/setup-lint').nestMemberLintScript);
          actual.scripts.lint=JSON.parse(b).scripts.lint;
          assert.deepEqual(actual,JSON.parse(b));
        } else if(p==='nest-cli.json') {
          const actual=JSON.parse(tree.read(prefix+p,'utf8'));
          assert.deepEqual(actual.compilerOptions.builder,{type:'rspack',options:{configPath:'rspack.config.cjs'}});
          actual.compilerOptions.builder='rspack';
          assert.deepEqual(actual,JSON.parse(b));
        } else if(p.startsWith('vitest.config')) {
          assert.equal(tree.read(prefix+p,'utf8'),local('./dist/utils/setup-vitest').addNestTransform(b.toString()));
        } else assert.deepEqual(tree.read(prefix+p),b,p);
      }
      assert.equal(tree.exists(prefix+'src/app.controller.ts'),false);
      assert.equal(tree.exists(prefix+'test/app.e2e-spec.ts'),false);
      const config=JSON.parse(tree.read(prefix+'nest-cli.json','utf8'));
      assert.equal(config.compilerOptions.builder.type,'rspack');
      assert.ok(config.projects['native-backend']);
      for(const [name,member] of Object.entries(config.projects)) {
        assert.deepEqual(JSON.parse(tree.read(prefix+member.root+'/project.json','utf8')),{
          name:'@native/backend-'+name,projectType:member.type,sourceRoot:prefix+member.sourceRoot
        });
      }
      assert.equal(JSON.parse(tree.read(prefix+'project.json','utf8')).sourceRoot,prefix+config.sourceRoot);
      const before=snapshotNxTree(tree);
      await assert.rejects(subAppGenerator(tree,{name:'worker',project:'@native/backend'}),/exists/);
      await assert.rejects(libraryGenerator(tree,{name:'shared',project:'@native/backend'}),/exists/);
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
    }
  );

  it('reads library defaults from the selected pending Tree and preserves native path/root behavior', () => {
    runMembers(`
      const tree=createTreeWithEmptyWorkspace();
      await applicationGenerator(tree,{name:'backend',directory:'services/backend'});
      const config=JSON.parse(tree.read('services/backend/nest-cli.json','utf8'));
      config.defaultLibraryPrefix='@selected';
      tree.write('services/backend/nest-cli.json',JSON.stringify(config));
      await libraryGenerator(tree,{name:'MyLib',project:'backend',rootDir:'modules',path:'nested'});
      const ts=JSON.parse(tree.read('services/backend/tsconfig.json','utf8'));
      assert.deepEqual(ts.compilerOptions.paths['@selected/my-lib'],['./modules/nested/my-lib/src/index.ts']);
      assert.equal(JSON.parse(tree.read('services/backend/nest-cli.json','utf8')).projects['my-lib'].root,'modules/nested/my-lib');
      assert.ok(tree.exists('services/backend/modules/nested/my-lib/src/my-lib.module.ts'));
      assert.ok(tree.exists('services/backend/modules/nested/my-lib/project.json'));
      config.defaultLibraryPrefix='';
      tree.write('services/backend/nest-cli.json',JSON.stringify(config));
      await libraryGenerator(tree,{name:'unprefixed',project:'backend'});
      assert.ok(JSON.parse(tree.read('services/backend/tsconfig.json','utf8')).compilerOptions.paths.unprefixed);
    `);
  });

  it('preserves an explicit Rspack configuration during first-sub-app conversion', () => {
    runMembers(`
      const tree=createTreeWithEmptyWorkspace();
      await applicationGenerator(tree,{name:'api',directory:'packages/api'});
      const configPath='packages/api/nest-cli.json';
      const config=JSON.parse(tree.read(configPath,'utf8'));
      const builder={type:'rspack',options:{configPath:'custom.cjs',custom:true}};
      config.compilerOptions.builder=builder;
      tree.write(configPath,JSON.stringify(config));
      tree.write('packages/api/custom.cjs','module.exports = {};');
      const install=await subAppGenerator(tree,{name:'worker',project:'api'});
      assert.equal(typeof install,'function');
      assert.deepEqual(JSON.parse(tree.read(configPath,'utf8')).compilerOptions.builder,builder);
      assert.equal(tree.read('packages/api/custom.cjs','utf8'),'module.exports = {};');
      assert.equal(tree.exists('packages/api/rspack.config.cjs'),false);
      const skipped=await libraryGenerator(tree,{name:'shared',project:'api',skipInstall:true});
      assert.equal(skipped,undefined);
      assert.deepEqual(JSON.parse(tree.read(configPath,'utf8')).compilerOptions.builder,builder);
    `);
  });

  it('isolates concurrent native host lookups from cwd and the caller filesystem APIs', () => {
    runMembers(`
      const trees=[createTreeWithEmptyWorkspace(),createTreeWithEmptyWorkspace()];
      const originalRead=fs.readFileSync;
      const originalCwd=process.cwd();
      for(const [index,tree] of trees.entries()) {
        await applicationGenerator(tree,{name:'owner-'+index,directory:'backend'});
        const config=JSON.parse(tree.read('backend/nest-cli.json','utf8'));
        config.defaultLibraryPrefix='@owner'+index;
        tree.write('backend/nest-cli.json',JSON.stringify(config));
      }
      await Promise.all(trees.map(async(tree,index)=> {
        await subAppGenerator(tree,{name:'worker',project:'owner-'+index});
        await libraryGenerator(tree,{name:'shared',project:'owner-'+index});
        const config=JSON.parse(tree.read('backend/nest-cli.json','utf8'));
        assert.ok(config.projects['owner-'+index]);
        assert.equal(config.projects['native-backend'],undefined);
        assert.ok(JSON.parse(tree.read('backend/tsconfig.json','utf8')).compilerOptions.paths['@owner'+index+'/shared']);
      }));
      assert.equal(fs.readFileSync,originalRead);
      assert.equal(process.cwd(),originalCwd);
    `);
  });

  it('selects a root Nest owner and rejects ambiguity, unsafe paths, and metadata collisions atomically', () => {
    runMembers(`
      const tree=createTreeWithEmptyWorkspace();
      await applicationGenerator(tree,{name:'one',directory:'services/one'});
      await applicationGenerator(tree,{name:'two',directory:'services/two'});
      tree.write('elsewhere/project.json',JSON.stringify({name:'one-taken'}));
      let before=snapshotNxTree(tree);
      for(const options of [{name:'lib'},{name:'lib',project:'missing'},{name:'../bad',project:'one'},{name:'lib',project:'one',path:'../bad'},{name:'taken',project:'one'}]) {
        await assert.rejects(libraryGenerator(tree,options));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
      const root=createTreeWithEmptyWorkspace();
      const app=await runNativeSchematic(new Map(),{schematic:'application',options:{name:'root',directory:'root'}});
      for(const [p,b] of app.after) root.write(p.slice('root/'.length),b);
      await libraryGenerator(root,{name:'shared',project:'root'});
      assert.equal(JSON.parse(root.read('libs/shared/project.json','utf8')).name,'root-shared');
      assert.ok(root.exists('libs/shared/src/shared.module.ts'));
      await subAppGenerator(root,{name:'worker'});
      const config=JSON.parse(root.read('nest-cli.json','utf8'));
      assert.ok(config.projects.root);
      assert.ok(config.projects.shared);
      assert.equal(JSON.parse(root.read('apps/worker/project.json','utf8')).name,'root-worker');
    `);
  });
});
