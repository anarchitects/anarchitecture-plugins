// SPDX-License-Identifier: MIT
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readBuildOutputs } from './read-build-outputs';

describe('effective Nest build outputs', () => {
  let workspace: string;
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nest-outputs-'));
    write('apps/api/nest-cli.json', {});
  });
  afterEach(() => rmSync(workspace, { recursive: true, force: true }));
  function write(path: string, value: unknown) {
    mkdirSync(dirname(join(workspace, path)), { recursive: true });
    writeFileSync(
      join(workspace, path),
      typeof value === 'string' ? value : JSON.stringify(value)
    );
  }
  const output = () => readBuildOutputs(workspace, 'apps/api');

  it('retains dist for missing configs or configs without outDir', () => {
    expect(output().outputs).toEqual(['{projectRoot}/dist']);
    write('apps/api/tsconfig.json', {});
    expect(output().outputs).toEqual(['{projectRoot}/dist']);
  });
  it('selects tsconfig.build.json before tsconfig.json', () => {
    write('apps/api/tsconfig.json', {
      compilerOptions: { outDir: 'fallback' },
    });
    expect(output().outputs).toEqual(['{projectRoot}/fallback']);
    write('apps/api/tsconfig.build.json', {
      compilerOptions: { outDir: 'build' },
    });
    expect(output().outputs).toEqual(['{projectRoot}/build']);
  });
  it.each(['explicit', 'builder'])(
    'reads a nested %s config relative to the Nest directory',
    (kind) => {
      const compilerOptions =
        kind === 'explicit'
          ? { tsConfigPath: 'configs/custom.json' }
          : {
              builder: {
                type: 'tsc',
                options: { configPath: 'configs/custom.json' },
              },
            };
      write('apps/api/nest-cli.json', { compilerOptions });
      write('apps/api/configs/custom.json', {
        compilerOptions: { outDir: '../custom-dist' },
      });
      write('apps/api/tsconfig.build.json', {
        compilerOptions: { outDir: 'ignored' },
      });
      expect(output()).toEqual({
        outputs: ['{projectRoot}/custom-dist'],
        configInputs: ['{workspaceRoot}/apps/api/configs/custom.json'],
      });
    }
  );
  it('does not silently select a different tsconfig when the explicit one is absent', () => {
    write('apps/api/nest-cli.json', {
      compilerOptions: { tsConfigPath: 'missing.json' },
    });
    write('apps/api/tsconfig.build.json', {
      compilerOptions: { outDir: 'wrong' },
    });
    expect(output().outputs).toEqual(['{projectRoot}/dist']);
  });
  it('resolves a multi-level extends chain from each declaring directory', () => {
    write('config/base.json', { compilerOptions: { outDir: '../dist/api' } });
    write('config/intermediate.json', { extends: './base.json' });
    write('apps/api/tsconfig.build.json', {
      extends: '../../config/intermediate.json',
    });
    expect(output()).toEqual({
      outputs: ['{workspaceRoot}/dist/api'],
      configInputs: [
        '{workspaceRoot}/apps/api/tsconfig.build.json',
        '{workspaceRoot}/config/base.json',
        '{workspaceRoot}/config/intermediate.json',
      ],
    });
    write('config/base.json', {
      compilerOptions: { outDir: '../changed-output' },
    });
    expect(output().outputs).toEqual(['{workspaceRoot}/changed-output']);
    write('apps/api/tsconfig.build.json', {
      extends: '../../config/intermediate.json',
      compilerOptions: { outDir: './override' },
    });
    expect(output().outputs).toEqual(['{projectRoot}/override']);
  });
  it('supports package-based and multiple extends using TypeScript resolution', () => {
    write('node_modules/example-config/package.json', {
      name: 'example-config',
      tsconfig: 'base.json',
    });
    write('node_modules/example-config/base.json', {
      compilerOptions: { strict: true, outDir: '../../package-output' },
    });
    write('apps/api/tsconfig.json', { extends: 'example-config' });
    expect(output().outputs).toEqual(['{workspaceRoot}/package-output']);
    expect(output().usesPackageConfigs).toBe(true);
    write('config/last.json', {
      compilerOptions: { outDir: '../last-output' },
    });
    write('apps/api/tsconfig.json', {
      extends: ['example-config', '../../config/last.json'],
    });
    expect(output().outputs).toEqual(['{workspaceRoot}/last-output']);
  });
  it('handles JSON comments, trailing commas, and solution-style configs', () => {
    write('tsconfig.json', { files: [], references: [{ path: './apps/api' }] });
    write('tsconfig.base.json', {
      compilerOptions: { outDir: './dist/shared' },
    });
    write('apps/api/tsconfig.json', {
      files: [],
      references: [{ path: './tsconfig.app.json' }],
    });
    write(
      'apps/api/tsconfig.app.json',
      '// selected app config\n{ "extends": "../../tsconfig.base.json", "files": [], }'
    );
    write('apps/api/nest-cli.json', {
      compilerOptions: { tsConfigPath: 'tsconfig.app.json' },
    });
    expect(output().outputs).toEqual(['{workspaceRoot}/dist/shared']);
    write('nest-cli.json', {});
    expect(readBuildOutputs(workspace, '.').outputs).toEqual([
      '{projectRoot}/dist',
    ]);
  });
  it('normalizes absolute and external output directories', () => {
    write('apps/api/tsconfig.json', {
      compilerOptions: { outDir: join(workspace, 'absolute') },
    });
    expect(output().outputs).toEqual(['{workspaceRoot}/absolute']);
    write('apps/api/tsconfig.json', {
      compilerOptions: { outDir: '../../dist/apps/api' },
    });
    expect(output().outputs).toEqual(['{workspaceRoot}/dist/apps/api']);
  });

  it('keeps output paths inside a workspace accessed through a symlink', () => {
    const alias = `${workspace}-alias`;
    symlinkSync(workspace, alias, 'junction');
    try {
      write('node_modules/example-config/package.json', {
        name: 'example-config',
        tsconfig: 'base.json',
      });
      write('node_modules/example-config/base.json', {
        compilerOptions: { outDir: '../../dist/api' },
      });
      write('apps/api/tsconfig.json', { extends: 'example-config' });
      expect(readBuildOutputs(alias, 'apps/api').outputs).toEqual([
        '{workspaceRoot}/dist/api',
      ]);
      write('apps/api/tsconfig.json', {
        compilerOptions: { outDir: join(alias, 'absolute') },
      });
      expect(readBuildOutputs(alias, 'apps/api').outputs).toEqual([
        '{workspaceRoot}/absolute',
      ]);
    } finally {
      rmSync(alias);
    }
  });
  it.each([
    '{ invalid',
    { extends: './missing.json' },
    { compilerOptions: { outDir: 12 } },
  ])('reports invalid existing configuration %j', (config) => {
    write('apps/api/tsconfig.json', config);
    expect(output).toThrow('Cannot resolve Nest TypeScript configuration');
  });
  it('rejects invalid Nest JSON', () => {
    write('apps/api/nest-cli.json', '{');
    expect(output).toThrow();
  });
});
