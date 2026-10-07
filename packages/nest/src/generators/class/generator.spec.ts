// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Real Node exercises native ESM factories and the emitted generator, avoiding
// Jest's CommonJS transform of import(). Host side effects are forbidden.
function runArtifact(assertions: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'nest-artifact-'));
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
      const generators = Object.fromEntries(['class','interface','module','provider','service','controller','decorator','filter','gateway','guard','interceptor','middleware','pipe','resolver'].map(name => [name,local('./dist/generators/'+name+'/generator.js').default]));
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
        console.log('ARTIFACT_OK');
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
    expect(output).toContain('ARTIFACT_OK');
    expect(readdirSync(cwd)).toEqual([]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// Structural, cross-cutting, and transport wrappers share a native-output matrix.
const artifacts = [
  ...[
    'decorator',
    'filter',
    'gateway',
    'guard',
    'interceptor',
    'middleware',
    'pipe',
    'resolver',
  ].map((name) => ({
    name,
    flat: name !== 'resolver',
    spec: name !== 'decorator',
    suffix: '.' + name,
    imports: ['gateway', 'resolver'].includes(name),
  })),
  { name: 'class', flat: true, spec: true, suffix: '', imports: false },
  {
    name: 'interface',
    flat: true,
    spec: false,
    suffix: '.interface',
    imports: false,
  },
  {
    name: 'module',
    flat: false,
    spec: false,
    suffix: '.module',
    imports: true,
  },
  { name: 'provider', flat: true, spec: true, suffix: '', imports: true },
  {
    name: 'service',
    flat: false,
    spec: true,
    suffix: '.service',
    imports: true,
  },
  {
    name: 'controller',
    flat: false,
    spec: true,
    suffix: '.controller',
    imports: true,
  },
];

describe('native Nest artifact generators', () => {
  it.each(artifacts)(
    'keeps $name schema aligned with native supported options',
    ({ name }) => {
      const nativeRoot = dirname(
        require.resolve('@nestjs/schematics/package.json')
      );
      const native = JSON.parse(
        readFileSync(join(nativeRoot, `dist/lib/${name}/schema.json`), 'utf8')
      );
      const wrapper = JSON.parse(
        readFileSync(
          resolve(__dirname, `../../../schemas/${name}.json`),
          'utf8'
        )
      );
      for (const property of ['flat', 'spec', 'specFileSuffix'])
        if (native.properties[property])
          delete native.properties[property].default;
      const { project, nestProject, ...properties } = wrapper.properties;
      if (['service', 'provider', 'gateway', 'resolver'].includes(name)) {
        expect(properties.skipImport.type).toBe('boolean');
        delete properties.skipImport;
      }
      expect(properties).toEqual(native.properties);
      expect(wrapper.required).toEqual(native.required);
      expect(project.type).toBe('string');
      expect(nestProject.type).toBe('string');
    }
  );

  it.each(
    artifacts.flatMap((artifact) =>
      ['esm', 'cjs'].map((mode) => ({ ...artifact, mode }))
    )
  )(
    'matches native $name defaults/options and imports in $mode',
    (artifact) => {
      runArtifact(String.raw`
        const artifact=${JSON.stringify(artifact)};
        const name=artifact.name;
        const variants=[{}, {flat:!artifact.flat,format:true,...(artifact.spec?{spec:false}:{}),...(artifact.imports?{skipImport:true}:{})},
          {name:'deep/Thing.Dto',path:'features',sourceRoot:'custom',flat:true,...(artifact.spec?{specFileSuffix:'check'}:{})}];
        for(const variant of variants) {
          const actual=createTreeWithEmptyWorkspace();
          const expected=createTreeWithEmptyWorkspace();
          for(const target of [actual,expected]) {
            await applicationGenerator(target,{name:'api',directory:'apps/api',type:artifact.mode});
            target.write('apps/api/unrelated.ts','export  const  unchanged=1');
          }
          const beforeModule=actual.read('apps/api/src/app.module.ts');
          const before=snapshotNxTree(actual);
          const options={name:'thing',...variant};
          const original=structuredClone(options);
          await runNestSchematic(expected,{schematic:name,workingDirectory:'apps/api',options:{sourceRoot:'src',...options}});
          await generators[name](actual,{...options,project:'api'});
          assert.deepEqual(options,original);
          assert.deepEqual(snapshotNxTree(actual),snapshotNxTree(expected));
          assert.equal(actual.read('apps/api/unrelated.ts','utf8'),'export  const  unchanged=1');
          const source=variant.sourceRoot??'src';
          if(!variant.name) {
            const root='apps/api/'+source+'/'+((variant.flat??artifact.flat)?'':'thing/');
            assert.ok(actual.exists(root+'thing'+artifact.suffix+'.ts'));
            assert.equal(actual.exists(root+'thing'+artifact.suffix+'.spec.ts'),artifact.spec && variant.spec!==false);
          } else {
            assert.ok(actual.exists('apps/api/custom/features/deep/thing.dto'+artifact.suffix+'.ts'));
            if(artifact.spec) assert.ok(actual.exists('apps/api/custom/features/deep/thing.dto'+artifact.suffix+'.check.ts'));
          }
          if(!artifact.imports || variant.skipImport || variant.sourceRoot) assert.deepEqual(actual.read('apps/api/src/app.module.ts'),beforeModule);
          else assert.notDeepEqual(actual.read('apps/api/src/app.module.ts'),beforeModule);
          for(const [path,bytes] of snapshotNxTree(actual)) {
            if(!path.endsWith('.ts') || before.get(path)?.equals(bytes)) continue;
            for(const match of bytes.toString().matchAll(/from ['"](\.[^'"]+)['"]/g)) {
              assert.equal(match[1].endsWith('.js'),artifact.mode==='esm',path+': '+match[1]);
            }
          }
        }
      `);
    }
  );

  it('respects member selection, nearest modules, spec-map fallback, and per-generator defaults', () => {
    runArtifact(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'services/api'});
      await subAppGenerator(tree,{name:'worker',project:'api'});
      await libraryGenerator(tree,{name:'shared',project:'api'});
      const main=tree.read('services/api/apps/api/src/app.module.ts');
      const config=JSON.parse(tree.read('services/api/nest-cli.json','utf8'));
      config.generateOptions={spec:{service:false,provider:false},flat:false,specFileSuffix:'global'};
      config.projects.worker.generateOptions={spec:{controller:true},flat:true,specFileSuffix:'member'};
      tree.write('services/api/nest-cli.json',JSON.stringify(config));
      await generators.module(tree,{name:'feature',project:'api-worker',flat:false});
      // Member flat=true retains native configuration precedence over false.
      assert.ok(tree.exists('services/api/apps/worker/src/feature.module.ts'));
      await generators.service(tree,{name:'orders',project:'api-worker'});
      assert.ok(tree.exists('services/api/apps/worker/src/orders.service.ts'));
      assert.equal(tree.exists('services/api/apps/worker/src/orders.service.member.ts'),false);
      await generators.controller(tree,{name:'orders',project:'api-worker'});
      assert.ok(tree.exists('services/api/apps/worker/src/orders.controller.member.ts'));
      await generators.provider(tree,{name:'cache',project:'api',nestProject:'shared',spec:true,specFileSuffix:'unit'});
      assert.ok(tree.exists('services/api/libs/shared/src/cache/cache.unit.ts'));
      assert.match(tree.read('services/api/libs/shared/src/shared.module.ts','utf8'),/Cache/);
      assert.deepEqual(tree.read('services/api/apps/api/src/app.module.ts'),main);
      await generators.module(tree,{name:'nested',project:'api-worker',path:'features',flat:false});
      await generators.service(tree,{name:'nested',project:'api-worker',path:'features',spec:false});
      assert.match(tree.read('services/api/apps/worker/src/features/nested.module.ts','utf8'),/NestedService/);
    `);
  });

  it.each(['esm', 'cjs'])(
    'preserves v12 decorators and transport registration in %s members',
    (mode) => {
      runArtifact(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'services/api',type:${JSON.stringify(
        mode
      )}});
      await subAppGenerator(tree,{name:'worker',project:'api'});
      await libraryGenerator(tree,{name:'shared',project:'api'});
      const main=tree.read('services/api/apps/api/src/app.module.ts');
      const config=JSON.parse(tree.read('services/api/nest-cli.json','utf8'));
      config.generateOptions={spec:{gateway:false,guard:false},flat:false,specFileSuffix:'global'};
      config.projects.worker.generateOptions={spec:{resolver:true},flat:true,specFileSuffix:'member'};
      tree.write('services/api/nest-cli.json',JSON.stringify(config));
      for(const name of ['decorator','filter','gateway','guard','interceptor','middleware','pipe','resolver']) {
        await generators[name](tree,{name:'worker-'+name,project:'api-worker'});
        await generators[name](tree,{name:'shared-'+name,project:'api',nestProject:'shared',...(name==='decorator'?{}:{spec:false})});
        assert.ok(tree.exists('services/api/apps/worker/src/worker-'+name+'.'+name+'.ts'));
        assert.ok(tree.exists('services/api/libs/shared/src/shared-'+name+'/shared-'+name+'.'+name+'.ts'));
        assert.equal(tree.exists('services/api/apps/worker/src/worker-'+name+'.'+name+'.member.ts'),!['decorator','gateway','guard'].includes(name));
      }
      const decorator=tree.read('services/api/apps/worker/src/worker-decorator.decorator.ts','utf8');
      assert.match(decorator,/import \{ Reflector \} from '@nestjs\/core'/);
      assert.match(decorator,/Reflector.createDecorator<string\[\]>\(\)/);
      assert.doesNotMatch(decorator,/SetMetadata/);
      const extension=${JSON.stringify(mode)}==='esm'?'.js':'';
      for(const name of ['gateway','resolver']) {
        assert.ok(tree.read('services/api/apps/worker/src/worker.module.ts','utf8').includes('./worker-'+name+'.'+name+extension));
        assert.ok(tree.read('services/api/libs/shared/src/shared.module.ts','utf8').includes('./shared-'+name+'/shared-'+name+'.'+name+extension));
      }
      assert.deepEqual(tree.read('services/api/apps/api/src/app.module.ts'),main);
      await generators.gateway(tree,{name:'explicit',project:'api-worker',spec:true,specFileSuffix:'unit'});
      assert.ok(tree.exists('services/api/apps/worker/src/explicit.gateway.unit.ts'));
      // Failed creation must also discard the staged provider registration.
      tree.write('services/api/apps/worker/src/conflict.resolver.ts','user-owned');
      const before=snapshotNxTree(tree);
      await assert.rejects(generators.resolver(tree,{name:'conflict',project:'api-worker'}));
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
    }
  );

  it('delegates native JavaScript templates for generators that support language', () => {
    runArtifact(String.raw`
      for(const name of Object.keys(generators).filter(name => name !== 'interface')) {
        const actual=createTreeWithEmptyWorkspace();
        const expected=createTreeWithEmptyWorkspace();
        for(const target of [actual,expected]) await applicationGenerator(target,{name:'api',directory:'apps/api',type:'cjs',language:'js'});
        const options={name:'thing',language:'js',sourceRoot:'src',flat:true};
        await runNestSchematic(expected,{schematic:name,workingDirectory:'apps/api',options});
        await generators[name](actual,{...options,project:'api'});
        assert.deepEqual(snapshotNxTree(actual),snapshotNxTree(expected));
      }
    `);
  });

  it('rejects invalid selection, paths, and file conflicts without partial module changes', () => {
    runArtifact(String.raw`
      await applicationGenerator(tree,{name:'api',directory:'apps/api'});
      for(const name of Object.keys(generators)) {
        const before=snapshotNxTree(tree);
        for(const options of [{name:''},{name:'../bad'},{name:'x',path:'/absolute'},{name:'x',sourceRoot:'../outside'},{name:'x',project:'missing'}]) {
          await assert.rejects(generators[name](tree,options));
          assert.deepEqual(snapshotNxTree(tree),before);
        }
      }
      tree.write('apps/api/src/thing/thing.service.ts','user-owned');
      const before=snapshotNxTree(tree);
      await assert.rejects(generators.service(tree,{name:'thing',project:'api'}));
      assert.deepEqual(snapshotNxTree(tree),before);
    `);
  });
});
