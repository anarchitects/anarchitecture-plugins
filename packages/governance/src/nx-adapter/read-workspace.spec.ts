import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveProjectTagsAndMetadata } from './read-workspace.js';

describe('read-workspace adapter compatibility', () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = join(tmpdir(), `nx-governance-read-workspace-${Date.now()}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('reads tags and metadata from project.json when package nx config is absent', () => {
    const projectRoot = 'libs/orders';
    const absProjectRoot = join(testRoot, projectRoot);
    mkdirSync(absProjectRoot, { recursive: true });

    writeFileSync(
      join(absProjectRoot, 'project.json'),
      JSON.stringify(
        {
          name: 'orders',
          tags: ['domain:orders', 'layer:feature'],
          metadata: {
            ownership: {
              team: '@org/orders',
            },
            documentation: true,
          },
        },
        null,
        2
      )
    );

    const result = resolveProjectTagsAndMetadata(projectRoot, testRoot);

    expect(result.tags).toEqual(['domain:orders', 'layer:feature']);
    expect(result.metadata).toEqual({
      ownership: {
        team: '@org/orders',
      },
      documentation: true,
    });
  });

  it('merges package.json nx, project.json, and graph values deterministically', () => {
    const projectRoot = 'libs/shared';
    const absProjectRoot = join(testRoot, projectRoot);
    mkdirSync(absProjectRoot, { recursive: true });

    writeFileSync(
      join(absProjectRoot, 'package.json'),
      JSON.stringify(
        {
          name: '@test/shared',
          nx: {
            tags: ['domain:shared'],
            metadata: {
              ownership: {
                team: '@org/shared-from-package',
              },
              documentation: true,
            },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      join(absProjectRoot, 'project.json'),
      JSON.stringify(
        {
          name: 'shared',
          tags: ['layer:util'],
          metadata: {
            ownership: {
              team: '@org/shared-from-project-json',
            },
          },
        },
        null,
        2
      )
    );

    const result = resolveProjectTagsAndMetadata(
      projectRoot,
      testRoot,
      ['domain:graph-derived'],
      {
        documentation: false,
        source: 'graph',
      }
    );

    expect(result.tags).toEqual([
      'domain:shared',
      'layer:util',
      'domain:graph-derived',
    ]);
    expect(result.metadata).toEqual({
      ownership: {
        team: '@org/shared-from-project-json',
      },
      documentation: false,
      source: 'graph',
    });
  });
});
