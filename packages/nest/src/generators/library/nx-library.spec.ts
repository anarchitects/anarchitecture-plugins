// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function runLibrary(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nx-nest-library-'));
  try {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const local = createRequire(${JSON.stringify(
        resolve(__dirname, '../../../package.json')
      )});
      const { createTreeWithEmptyWorkspace } = local('@nx/devkit/testing');
      const { getProjects, readJson, writeJson } = local('@nx/devkit');
      const { libraryGenerator } = local('./dist/generators/library/generator');
      const { resolveNestGenerationContext } = local('./dist/utils/resolve-nest-generation-context');
      const { snapshotNxTree } = local('./dist/generation-adapter/tree-snapshot');
      const { runNativeSchematic } = local('./dist/generation-adapter/run-native-schematic');
      const tree = createTreeWithEmptyWorkspace();
      (async () => { ${assertions}; console.log('LIBRARY_OK'); })().catch(error => { console.error(error); process.exitCode=1; });
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
    expect(output).toContain('LIBRARY_OK');
    expect(readdirSync(cwd)).toEqual([]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('Nx-native Nest library container', () => {
  it.each([
    ['users', 'users', 'users'],
    ['UserData', 'user-data', 'user-data'],
    ['@acme/UserData', '@acme/user-data', 'user-data'],
  ])(
    'creates an independent private package for %s with native module output',
    (input, name, moduleName) => {
      runLibrary(`
      const original = snapshotNxTree(tree);
      const install = await libraryGenerator(tree, { name: ${JSON.stringify(
        input
      )}, directory: './libs/users/', format: true });
      assert.equal(typeof install, 'function');
      const root = 'libs/users';
      const manifest = readJson(tree, root+'/package.json');
      assert.equal(manifest.name, ${JSON.stringify(name)});
      assert.equal(manifest.private, true);
      assert.equal(manifest.type, 'module');
      assert.equal(manifest.exports['.'].default, './src/index.ts');
      assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['@nestjs/common','reflect-metadata','rxjs']);
      assert.equal(readJson(tree,'package.json').dependencies?.['@nestjs/common'], undefined);
      assert.deepEqual(readJson(tree,'package.json').workspaces, ['libs/users']);
      const project = getProjects(tree).get(${JSON.stringify(name)});
      assert.equal(project.root, root);
      assert.equal(project.sourceRoot, root+'/src');
      assert.equal(project.projectType, 'library');
      assert.deepEqual(project.metadata.nest, {kind:'nx-library'});
      const context = resolveNestGenerationContext(tree, {project: ${JSON.stringify(
        name
      )}});
      assert.equal(context.kind, 'nx-library');
      assert.equal(context.projectName, ${JSON.stringify(name)});
      assert.equal(context.projectRoot, root);
      assert.equal(context.sourceRoot, root+'/src');
      assert.equal(context.relativeSourceRoot, 'src');
      assert.deepEqual(context.packageJson, manifest);
      assert.equal(context.moduleSystem, 'esm');
      assert.equal(context.language, 'ts');
      const beforeArtifacts = snapshotNxTree(tree);
      const { resourceGenerator } = local('./dist/generators/resource/generator');
      await assert.rejects(resourceGenerator(tree, {name:'orders',project:${JSON.stringify(
        name
      )}}), /not supported yet/);
      assert.deepEqual(snapshotNxTree(tree), beforeArtifacts);
      assert.equal(tree.exists(root+'/nest-cli.json'), false);
      assert.equal(tree.exists('nest-cli.json'), false);
      const native = await runNativeSchematic(new Map([['package.json',tree.read(root+'/package.json')]]),{
        schematic:'module',options:{name:${JSON.stringify(
          moduleName
        )},sourceRoot:'src',flat:true,skipImport:true,language:'ts',format:true}
      });
      assert.deepEqual(tree.read(root+'/src/'+${JSON.stringify(
        moduleName
      )}+'.module.ts'), native.after.get('src/'+${JSON.stringify(
        moduleName
      )}+'.module.ts'));
      assert.equal(tree.read(root+'/src/index.ts','utf8'), 'export * from '+JSON.stringify('./'+${JSON.stringify(
        moduleName
      )}+'.module.js').replaceAll('"',"'")+';\\n');
      assert.deepEqual(readJson(tree,root+'/tsconfig.json').references,[{path:'./tsconfig.lib.json'}]);
      assert.equal(readJson(tree,root+'/tsconfig.json').compilerOptions.experimentalDecorators,true);
      assert.equal(readJson(tree,root+'/tsconfig.lib.json').compilerOptions.rootDir,'../..');
      assert.equal(readJson(tree,root+'/tsconfig.lib.json').compilerOptions.composite,false);
      assert.deepEqual(readJson(tree,'tsconfig.base.json').compilerOptions.paths[${JSON.stringify(
        name
      )}],['./libs/users/src/index.ts']);
      for (const [file, content] of original) if (!['package.json','tsconfig.base.json'].includes(file)) assert.deepEqual(tree.read(file),content,file);
      const before = snapshotNxTree(tree);
      await assert.rejects(libraryGenerator(tree,{name:${JSON.stringify(
        input
      )},directory:'libs/users'}),/already exists/);
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
    }
  );

  it.each(['npm', 'yarn', 'bun', 'pnpm'])(
    'registers %s package membership and respects skipInstall',
    (manager) => {
      runLibrary(`
      writeJson(tree,'package.json',{name:'workspace',packageManager:${JSON.stringify(
        manager + '@1.0.0'
      )},workspaces:['apps/*']});
      if (${JSON.stringify(
        manager
      )} === 'pnpm') tree.write('pnpm-workspace.yaml','# packages\\npackages: ["apps/*"]\\nhoistPattern: []\\n');
      const install = await libraryGenerator(tree,{name:'users',directory:'libs/users',skipInstall:true});
      assert.equal(install,undefined);
      assert.ok(tree.exists('libs/users/src/users.module.ts'));
      if (${JSON.stringify(manager)} === 'pnpm') {
        const yaml=local('yaml').parse(tree.read('pnpm-workspace.yaml','utf8'));
        assert.deepEqual(yaml.packages,['apps/*','libs/users']);
        assert.deepEqual(yaml.hoistPattern,[]);
        assert.deepEqual(readJson(tree,'package.json').workspaces,['apps/*']);
      } else assert.deepEqual(readJson(tree,'package.json').workspaces,['apps/*','libs/users']);
    `);
    }
  );

  it('coexists with native Nest libraries and preserves root compiler policy and covered globs', () => {
    runLibrary(`
      const { applicationGenerator } = local('./dist/generators/application/generator');
      await applicationGenerator(tree,{name:'api',directory:'packages/api',skipInstall:true});
      await libraryGenerator(tree,{name:'internal',project:'api',skipInstall:true});
      writeJson(tree,'package.json',{...readJson(tree,'package.json'),workspaces:['packages/*','libs/*']});
      tree.write('tsconfig.base.json',JSON.stringify({compilerOptions:{module:'preserve',moduleResolution:'bundler',paths:{'@app/contracts':['libs/contracts/src/index.ts']}},angularCompilerOptions:{strictTemplates:true}}));
      const before=snapshotNxTree(tree);
      await libraryGenerator(tree,{name:'users',directory:'libs/users',skipInstall:true});
      for(const [file,content] of before) if(file!=='tsconfig.base.json') assert.deepEqual(tree.read(file),content,file);
      assert.deepEqual(readJson(tree,'tsconfig.base.json'),{compilerOptions:{module:'preserve',moduleResolution:'bundler',paths:{'@app/contracts':['libs/contracts/src/index.ts'],users:['./libs/users/src/index.ts']}},angularCompilerOptions:{strictTemplates:true}});
      assert.equal(readJson(tree,'packages/api/nest-cli.json').projects.users,undefined);
      assert.equal(tree.exists('packages/api/libs/internal/package.json'),false);
    `);
  });

  it('rejects project/package identities, overlapping roots, native ownership, and unsafe options before staging', () => {
    runLibrary(`
      writeJson(tree,'projects/existing/project.json',{name:'taken',root:'projects/existing'});
      writeJson(tree,'projects/existing/package.json',{name:'@acme/existing'});
      writeJson(tree,'hidden/package.json',{name:'hidden-owner'});
      tree.write('occupied/readme.txt','user content');
      tree.write('file-parent','user content');
      const before=snapshotNxTree(tree);
      for (const options of [
        {name:'taken',directory:'libs/new'},
        {name:'@acme/existing',directory:'libs/new'},
        {name:readJson(tree,'package.json').name,directory:'libs/new'},
        {name:'users',directory:'projects/existing'},
        {name:'users',directory:'projects/existing/nested'},
        {name:'users',directory:'projects'},
        {name:'users',directory:'hidden/users'},
        {name:'users',directory:'occupied'},
        {name:'users',directory:'file-parent/users'},
        {name:'users',directory:'../users'},
        {name:'',directory:'libs/users'},
        {name:'@/users',directory:'libs/users'},
        {name:'group/users',directory:'libs/users'},
        {name:'123-users',directory:'libs/users'},
        {name:'@nestjs/common',directory:'libs/users'},
        {name:'reflect-metadata',directory:'libs/users'},
        {name:'rxjs',directory:'libs/users'},
        {name:'users',directory:'libs/users',language:'js'}
      ]) {
        await assert.rejects(libraryGenerator(tree,options));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
      writeJson(tree,'package.json',{...readJson(tree,'package.json'),workspaces:['libs/*','!libs/users']});
      const excluded=snapshotNxTree(tree);
      await assert.rejects(libraryGenerator(tree,{name:'users',directory:'libs/users'}),/excluded/);
      assert.deepEqual(snapshotNxTree(tree),excluded);
    `);
  });
});
