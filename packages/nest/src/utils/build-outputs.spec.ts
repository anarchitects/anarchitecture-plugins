// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { normalizeBuildOutput, selectTsConfigPath } from './build-outputs';

describe('Nest tsconfig selection', () => {
  it('prefers explicit tsConfigPath over a tsc builder configuration', () => {
    expect(
      selectTsConfigPath(
        {
          compilerOptions: {
            tsConfigPath: 'custom.json',
            builder: { type: 'tsc', options: { configPath: 'builder.json' } },
          },
        },
        true
      )
    ).toBe('custom.json');
  });
  it('uses a tsc builder configPath', () => {
    expect(
      selectTsConfigPath(
        {
          compilerOptions: {
            builder: { type: 'tsc', options: { configPath: 'builder.json' } },
          },
        },
        true
      )
    ).toBe('builder.json');
  });
  it.each(['swc', 'rspack', 'webpack'])(
    'ignores %s builder configPath',
    (type) => {
      expect(
        selectTsConfigPath(
          {
            compilerOptions: {
              builder: { type, options: { configPath: 'not-typescript.json' } },
            },
          },
          true
        )
      ).toBe('tsconfig.build.json');
    }
  );
  it.each([true, false])(
    'uses the conventional fallback with build config present=%s',
    (exists) => {
      expect(selectTsConfigPath({}, exists)).toBe(
        exists ? 'tsconfig.build.json' : 'tsconfig.json'
      );
      expect(
        selectTsConfigPath({ compilerOptions: { builder: 'tsc' } }, exists)
      ).toBe(exists ? 'tsconfig.build.json' : 'tsconfig.json');
    }
  );
});

describe('Nx output paths', () => {
  const workspace = resolve('test-workspace');
  it.each([
    [undefined, '{projectRoot}/dist'],
    ['build', '{projectRoot}/build'],
    ['..cache', '{projectRoot}/..cache'],
    ['.', '{projectRoot}'],
    ['../api-sibling/dist', '{workspaceRoot}/apps/api-sibling/dist'],
    ['../../dist/apps/api', '{workspaceRoot}/dist/apps/api'],
    ['../..', '{workspaceRoot}'],
    ['../../../external-output', '{workspaceRoot}/../external-output'],
    [resolve(workspace, 'absolute-output'), '{workspaceRoot}/absolute-output'],
  ])('normalizes %s to %s', (outDir, expected) => {
    expect(normalizeBuildOutput(workspace, 'apps/api', outDir)).toBe(expected);
  });
  it('uses project-relative output for a root project', () => {
    expect(
      normalizeBuildOutput(workspace, '.', resolve(workspace, 'build'))
    ).toBe('{projectRoot}/build');
  });
});
