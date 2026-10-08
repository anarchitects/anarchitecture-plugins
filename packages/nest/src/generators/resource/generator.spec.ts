// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Real Node exercises native ESM factories and the emitted generator, avoiding
// Jest's CommonJS transform of import(). Host side effects are forbidden.
function runResource(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nest-resource-'));
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
      const { resourceGenerator } = local('./dist/generators/resource/generator.js');
      const { subAppGenerator } = local('./dist/generators/sub-app/generator.js');
      const { libraryGenerator } = local('./dist/generators/library/generator.js');
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
        console.log('RESOURCE_OK');
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
    expect(output).toContain('RESOURCE_OK');
    expect(readdirSync(cwd)).toEqual([]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const transports = [
  'rest',
  'graphql-code-first',
  'graphql-schema-first',
  'microservice',
  'ws',
];

describe('native Nest resource generator', () => {
  it('preserves the native schema, deferring config-sensitive defaults until project selection', () => {
    const nativeRoot = dirname(
      require.resolve('@nestjs/schematics/package.json')
    );
    const native = JSON.parse(
      readFileSync(join(nativeRoot, 'dist/lib/resource/schema.json'), 'utf8')
    );
    const wrapper = JSON.parse(
      readFileSync(resolve(__dirname, '../../../schemas/resource.json'), 'utf8')
    );
    for (const name of ['spec', 'flat', 'specFileSuffix'])
      delete native.properties[name].default;
    const { project, nestProject, skipInstall, ...properties } =
      wrapper.properties;
    expect(properties).toEqual(native.properties);
    expect(skipInstall.type).toBe('boolean');
    expect(wrapper.required).toEqual(native.required);
    expect(project.type).toBe('string');
    expect(nestProject.type).toBe('string');
  });

  it.each(
    transports.flatMap((type) => ['esm', 'cjs'].map((mode) => ({ type, mode })))
  )(
    'matches native $type output and CRUD on/off in $mode',
    ({ type, mode }) => {
      runResource(String.raw`
        const type=${JSON.stringify(type)};
        const mode=${JSON.stringify(mode)};
        for (const crud of [true,false]) {
          const actual=createTreeWithEmptyWorkspace();
          const expected=createTreeWithEmptyWorkspace();
          for(const target of [actual,expected]) await applicationGenerator(target,{name:'api',directory:'apps/api',type:mode});
          const options={name:'users',type,crud};
          const native=await runNestSchematic(expected,{schematic:'resource',workingDirectory:'apps/api',options:{...options,sourceRoot:'src'}});
          const original=structuredClone(options);
          const callback=await resourceGenerator(actual,{...options,project:'api'});
          assert.equal(typeof callback,type==='graphql-code-first'?'undefined':'function');
          assert.deepEqual(options,original);
          assert.deepEqual(snapshotNxTree(actual),snapshotNxTree(expected));
          const root='apps/api/src/users/';
          const controller=type.startsWith('graphql')?'resolver':type==='ws'?'gateway':'controller';
          assert.ok(actual.exists(root+'users.'+controller+'.ts'));
          assert.ok(actual.exists(root+'users.'+controller+'.spec.ts'));
          assert.equal(actual.exists(root+'dto/create-user.'+(type.startsWith('graphql')?'input':'dto')+'.ts'),crud);
          assert.equal(actual.exists(root+'users.graphql'),type==='graphql-schema-first'&&crud);
          assert.match(actual.read('apps/api/src/app.module.ts','utf8'),/UsersModule/);
          const extension=mode==='esm'?'.js':'';
          assert.ok(actual.read('apps/api/src/app.module.ts','utf8').includes('./users/users.module'+extension));
          for(const [path,bytes] of snapshotNxTree(actual)) {
            if(path.startsWith(root) && path.endsWith('.ts')) {
              const text=bytes.toString();
              assert.doesNotMatch(text,/\b(zod|valibot|arktype)\b/i);
              for(const match of text.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
                assert.equal(match[1].endsWith('.js'),mode==='esm',path+': '+match[1]);
              }
            }
          }
          const manifest=JSON.parse(actual.read('apps/api/package.json','utf8'));
          if(type==='graphql-code-first') assert.equal(manifest.dependencies['@nestjs/mapped-types'],undefined);
          else {
            assert.equal(manifest.dependencies['@nestjs/mapped-types'],'*');
            assert.ok(native.deferredTasks.some(task=>task.name==='node-package'));
          }
        }
      `);
    }
  );

  it('installs only newly introduced resource dependencies and honors skipInstall', () => {
    runResource(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'apps/api'});
      assert.equal(await resourceGenerator(tree,{name:'users',project:'api',type:'rest',crud:true,skipInstall:true}),undefined);
      assert.equal(JSON.parse(tree.read('apps/api/package.json','utf8')).dependencies['@nestjs/mapped-types'],'*');
      assert.equal(await resourceGenerator(tree,{name:'posts',project:'api',type:'rest',crud:true}),undefined);
    `);
  });

  it('imports into the selected native app/library and preserves sibling modules', () => {
    runResource(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'services/api'});
      await subAppGenerator(tree,{name:'worker',project:'api'});
      await libraryGenerator(tree,{name:'shared',project:'api'});
      const beforeDefault=tree.read('services/api/apps/api/src/app.module.ts');
      await resourceGenerator(tree,{name:'users',project:'api-worker',crud:false});
      assert.match(tree.read('services/api/apps/worker/src/worker.module.ts','utf8'),/UsersModule/);
      assert.deepEqual(tree.read('services/api/apps/api/src/app.module.ts'),beforeDefault);
      const beforeWorker=tree.read('services/api/apps/worker/src/worker.module.ts');
      await resourceGenerator(tree,{name:'events',project:'api',nestProject:'shared',type:'ws',crud:false,spec:false});
      assert.match(tree.read('services/api/libs/shared/src/shared.module.ts','utf8'),/EventsModule/);
      assert.deepEqual(tree.read('services/api/apps/worker/src/worker.module.ts'),beforeWorker);
      assert.deepEqual(tree.read('services/api/apps/api/src/app.module.ts'),beforeDefault);
    `);
  });

  it('honors config defaults, explicit options, paths, skipImport, formatting, and Swagger detection', () => {
    runResource(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'apps/api'});
      const config=JSON.parse(tree.read('apps/api/nest-cli.json','utf8'));
      config.generateOptions={spec:{resource:false},flat:true,specFileSuffix:'test',baseDir:'features'};
      tree.write('apps/api/nest-cli.json',JSON.stringify(config));
      const manifest=JSON.parse(tree.read('apps/api/package.json','utf8'));
      manifest.dependencies['@nestjs/swagger']='^12.0.0';
      tree.write('apps/api/package.json',JSON.stringify(manifest));
      tree.write('outside.ts','export   const   unchanged=1');
      const beforeModule=tree.read('apps/api/src/app.module.ts');
      await resourceGenerator(tree,{name:'users',path:'admin',project:'api',skipImport:true,format:true});
      assert.ok(tree.exists('apps/api/src/features/admin/users.controller.ts'));
      assert.equal(tree.exists('apps/api/src/features/admin/users.controller.test.ts'),false);
      assert.match(tree.read('apps/api/src/features/admin/dto/update-user.dto.ts','utf8'),/@nestjs\/swagger/);
      assert.deepEqual(tree.read('apps/api/src/app.module.ts'),beforeModule);
      assert.equal(tree.read('outside.ts','utf8'),'export   const   unchanged=1');
      assert.equal(JSON.parse(tree.read('apps/api/package.json','utf8')).dependencies['@nestjs/mapped-types'],undefined);
      await resourceGenerator(tree,{name:'orders',project:'api',sourceRoot:'custom',spec:true,specFileSuffix:'unit',skipImport:true});
      assert.ok(tree.exists('apps/api/custom/orders.controller.unit.ts'));
    `);
  });

  it('supports root owners and rejects invalid selection, native errors, and unsafe paths without changes', () => {
    runResource(String.raw`
      const native=createTreeWithEmptyWorkspace();
      await applicationGenerator(native,{name:'root',directory:'root'});
      for(const [path,bytes] of snapshotNxTree(native)) if(path.startsWith('root/')) tree.write(path.slice(5),bytes);
      await resourceGenerator(tree,{name:'users',crud:false});
      assert.ok(tree.exists('src/users/users.controller.ts'));
      const before=snapshotNxTree(tree);
      for(const options of [{name:'x',project:'missing'},{name:'x',nestProject:'missing'},{name:'../escape'},
        {name:'x',path:'/absolute'},{name:'x',sourceRoot:'../outside'}, {name:'x',type:'invalid'}, {name:'x',language:'js'}]) {
        await assert.rejects(resourceGenerator(tree,options));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
      const other=createTreeWithEmptyWorkspace();
      await applicationGenerator(other,{name:'one',directory:'apps/one'});
      await applicationGenerator(other,{name:'two',directory:'apps/two'});
      await assert.rejects(resourceGenerator(other,{name:'users'}),/unambiguous/);
      other.write('apps/one/src/users/users.service.ts','user-owned');
      const beforeConflict=snapshotNxTree(other);
      await assert.rejects(resourceGenerator(other,{name:'users',project:'one'}));
      assert.deepEqual(snapshotNxTree(other),beforeConflict);
    `);
  });

  it('applies member defaults and native per-schematic fallback with explicit spec overrides', () => {
    runResource(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'apps/api'});
      await subAppGenerator(tree,{name:'worker',project:'api'});
      const config=JSON.parse(tree.read('apps/api/nest-cli.json','utf8'));
      config.generateOptions={spec:{resource:false},flat:false,specFileSuffix:'global'};
      config.projects.worker.generateOptions={spec:{controller:true},flat:true,specFileSuffix:'member'};
      tree.write('apps/api/nest-cli.json',JSON.stringify(config));
      await resourceGenerator(tree,{name:'users',project:'api-worker',flat:false,crud:false});
      assert.ok(tree.exists('apps/api/apps/worker/src/users.controller.ts'));
      assert.equal(tree.exists('apps/api/apps/worker/src/users.controller.member.ts'),false);
      await resourceGenerator(tree,{name:'orders',project:'api-worker',spec:true,crud:false});
      assert.ok(tree.exists('apps/api/apps/worker/src/orders.controller.member.ts'));
      await resourceGenerator(tree,{name:'events',project:'api-worker',spec:true,specFileSuffix:'explicit',crud:false});
      assert.ok(tree.exists('apps/api/apps/worker/src/events.controller.explicit.ts'));
      const before=snapshotNxTree(tree);
      await assert.rejects(resourceGenerator(tree,{name:'x',project:'api-worker',nestProject:'api'}),/conflicts/);
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
  });
});

describe('Nx-native library resources', () => {
  it.each(
    transports.flatMap((type) => ['esm', 'cjs'].map((mode) => ({ type, mode })))
  )(
    'matches native $type library output, dependencies, CRUD and options in $mode',
    ({ type, mode }) => {
      runResource(String.raw`
        const type=${JSON.stringify(type)};
        const mode=${JSON.stringify(mode)};
        await libraryGenerator(tree,{name:'domain',directory:'libs/domain',skipInstall:true});
        const manifest=JSON.parse(tree.read('libs/domain/package.json','utf8'));
        manifest.type=mode==='esm'?'module':'commonjs';
        tree.write('libs/domain/package.json',JSON.stringify(manifest));
        tree.write('libs/outer.module.ts',"import { Module } from '@nestjs/common'; @Module({}) export class OuterModule {}\n");
        const baseline=snapshotNxTree(tree);
        for(const variant of [
          {crud:true}, {crud:false},
          {crud:true,flat:true,spec:false,skipImport:true,path:'features',format:true},
          {crud:true,sourceRoot:'src/custom',spec:true,specFileSuffix:'unit'}
        ]) {
          const actual=createTreeWithEmptyWorkspace();
          const expected=createTreeWithEmptyWorkspace();
          for(const target of [actual,expected]) for(const [path,bytes] of baseline) target.write(path,bytes);
          const options={name:'users',type,...variant};
          const original=structuredClone(options);
          const native=await runNestSchematic(expected,{schematic:'resource',workingDirectory:'libs/domain',options:{...options,sourceRoot:options.sourceRoot??'src'}});
          const callback=await resourceGenerator(actual,{...options,project:'domain'});
          assert.equal(typeof callback,type==='graphql-code-first'?'undefined':'function');
          assert.deepEqual(options,original);
          assert.deepEqual(snapshotNxTree(actual),snapshotNxTree(expected));
          assert.deepEqual(actual.read('package.json'),baseline.get('package.json'));
          assert.deepEqual(actual.read('libs/outer.module.ts'),baseline.get('libs/outer.module.ts'));
          const root='libs/domain/'+(options.sourceRoot??'src')+'/'+(options.path?options.path+'/':'')+(options.flat?'':'users/');
          const transport=type.startsWith('graphql')?'resolver':type==='ws'?'gateway':'controller';
          assert.ok(actual.exists(root+'users.'+transport+'.ts'));
          assert.equal(actual.exists(root+'users.'+transport+'.'+(options.specFileSuffix??'spec')+'.ts'),options.spec!==false);
          assert.equal(actual.exists(root+'dto/create-user.'+(type.startsWith('graphql')?'input':'dto')+'.ts'),options.crud);
          const module=actual.read('libs/domain/src/domain.module.ts','utf8');
          if(options.skipImport) assert.equal(module,baseline.get('libs/domain/src/domain.module.ts').toString());
          else assert.match(module,/UsersModule/);
          const afterManifest=JSON.parse(actual.read('libs/domain/package.json','utf8'));
          if(type==='graphql-code-first') assert.equal(afterManifest.dependencies['@nestjs/mapped-types'],undefined);
          else {
            assert.equal(afterManifest.dependencies['@nestjs/mapped-types'],'*');
            assert.ok(native.deferredTasks.some(task=>task.name==='node-package'));
          }
          for(const [path,bytes] of snapshotNxTree(actual)) if(path.startsWith(root)&&path.endsWith('.ts')) {
            for(const match of bytes.toString().matchAll(/from ['"](\.[^'"]+)['"]/g))
              assert.equal(match[1].endsWith('.js'),mode==='esm',path+': '+match[1]);
          }
        }
      `);
    }
  );

  it('uses only library-local Swagger and mapped-types declarations and honors skipInstall', () => {
    runResource(String.raw`
      await libraryGenerator(tree,{name:'domain',directory:'libs/domain',skipInstall:true});
      const root=JSON.parse(tree.read('package.json','utf8'));
      root.dependencies={...root.dependencies,'@nestjs/swagger':'^12.0.0','@nestjs/mapped-types':'*'};
      tree.write('package.json',JSON.stringify(root));
      const before=tree.read('package.json');
      assert.equal(await resourceGenerator(tree,{name:'users',project:'domain',crud:true,skipInstall:true}),undefined);
      assert.match(tree.read('libs/domain/src/users/dto/update-user.dto.ts','utf8'),/@nestjs\/mapped-types/);
      assert.equal(JSON.parse(tree.read('libs/domain/package.json','utf8')).dependencies['@nestjs/mapped-types'],'*');
      assert.equal(await resourceGenerator(tree,{name:'posts',project:'domain',crud:true}),undefined);
      assert.deepEqual(tree.read('package.json'),before);
      const local=JSON.parse(tree.read('libs/domain/package.json','utf8'));
      delete local.dependencies['@nestjs/mapped-types'];
      local.dependencies['@nestjs/swagger']='^12.0.0';
      tree.write('libs/domain/package.json',JSON.stringify(local));
      assert.equal(await resourceGenerator(tree,{name:'events',project:'domain',crud:true}),undefined);
      assert.match(tree.read('libs/domain/src/events/dto/update-event.dto.ts','utf8'),/@nestjs\/swagger/);
      assert.equal(JSON.parse(tree.read('libs/domain/package.json','utf8')).dependencies['@nestjs/mapped-types'],undefined);
    `);
  });

  it('discards staged library dependencies and module registration when native generation fails', () => {
    runResource(String.raw`
      await libraryGenerator(tree,{name:'domain',directory:'libs/domain',skipInstall:true});
      tree.write('libs/domain/src/users/users.service.ts','user-owned');
      const before=snapshotNxTree(tree);
      for(const options of [{name:'users',type:'rest',crud:true},{name:'x',type:'invalid'},{name:'x',language:'js'},{name:'x',sourceRoot:'../other'}]) {
        await assert.rejects(resourceGenerator(tree,{...options,project:'domain'}));
        assert.deepEqual(snapshotNxTree(tree),before);
      }
    `);
  });
});

it.each(
  ['esm', 'cjs'].flatMap((mode) =>
    [false, true].map((format) => ({ mode, format }))
  )
)(
  'aliases same-name resource imports in a $mode library with format=$format',
  ({ mode, format }) => {
    runResource(String.raw`
    await libraryGenerator(tree,{name:'users',directory:'libs/users',skipInstall:true});
    const manifest=JSON.parse(tree.read('libs/users/package.json','utf8'));
    manifest.type=${JSON.stringify(mode)}==='esm'?'module':'commonjs';
    tree.write('libs/users/package.json',JSON.stringify(manifest));
    await resourceGenerator(tree,{name:'users',project:'users',type:'rest',crud:true,skipInstall:true,format:${JSON.stringify(
      format
    )}});
    const module=tree.read('libs/users/src/users.module.ts','utf8');
    assert.match(module,/import \{ UsersModule as UsersResourceModule \}/);
    assert.match(module,/imports: \[UsersResourceModule\]/);
    assert.match(module,/export class UsersModule/);
    assert.match(tree.read('libs/users/src/users/users.module.ts','utf8'),/export class UsersModule/);
    const other=createTreeWithEmptyWorkspace();
    await libraryGenerator(other,{name:'users',directory:'libs/users',skipInstall:true});
    other.write('libs/users/src/users.module.ts',"import { Module } from '@nestjs/common';\nconst SHARED_IMPORTS=[];\n@Module({imports:SHARED_IMPORTS}) export class UsersModule {}\n");
    const before=snapshotNxTree(other);
    await assert.rejects(resourceGenerator(other,{name:'users',project:'users',crud:true}),/Cannot safely alias/);
    assert.deepEqual(snapshotNxTree(other),before);
  `);
  }
);
