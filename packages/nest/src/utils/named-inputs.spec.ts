// SPDX-License-Identifier: MIT
import type { CreateNodesContext } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readNamedInputs } from './named-inputs';

describe('Nest named inputs', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      workspaceRoot: mkdtempSync(join(tmpdir(), 'nest-inputs-')),
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['default', '!{projectRoot}/**/*.spec.ts'],
        },
      },
    };
    mkdirSync(join(context.workspaceRoot, 'apps/api'), { recursive: true });
  });
  afterEach(() =>
    rmSync(context.workspaceRoot, { recursive: true, force: true })
  );

  function write(filename: string, config: unknown) {
    writeFileSync(
      join(context.workspaceRoot, 'apps/api', filename),
      JSON.stringify(config)
    );
  }

  it('retains workspace named inputs when local manifests are absent', () => {
    expect(readNamedInputs('apps/api', context)).toEqual(
      context.nxJsonConfiguration.namedInputs
    );
  });

  it.each(['package.json', 'project.json'])(
    'reads local named inputs from %s relative to workspaceRoot',
    (filename) => {
      const config = {
        namedInputs: { production: [], local: ['{projectRoot}/local.txt'] },
      };
      write(filename, filename === 'package.json' ? { nx: config } : config);
      expect(readNamedInputs('apps/api', context)).toEqual({
        default: ['{projectRoot}/**/*'],
        production: [],
        local: ['{projectRoot}/local.txt'],
      });
    }
  );

  it('gives project.json precedence over package.json and nx.json without mutating context', () => {
    write('package.json', {
      nx: { namedInputs: { production: ['package'], packageOnly: [] } },
    });
    write('project.json', { namedInputs: { production: ['project'] } });
    const before = structuredClone(context);
    expect(readNamedInputs('apps/api', context)).toEqual({
      default: ['{projectRoot}/**/*'],
      production: ['project'],
      packageOnly: [],
    });
    expect(context).toEqual(before);
  });

  it('ignores package fields outside nx and reports invalid manifest JSON', () => {
    write('package.json', { production: [], namedInputs: { production: [] } });
    expect(readNamedInputs('apps/api', context)).toEqual(
      context.nxJsonConfiguration.namedInputs
    );
    writeFileSync(join(context.workspaceRoot, 'apps/api/project.json'), '{');
    expect(() => readNamedInputs('apps/api', context)).toThrow();
  });
});
