// SPDX-License-Identifier: MIT
import { getProjects, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { stageTree } from './staged-tree';
import { snapshotNxTree } from './tree-snapshot';

it('exposes pending Nx projects and commits only successful operations', async () => {
  const tree = createTreeWithEmptyWorkspace();
  writeJson(tree, 'api/project.json', { name: 'api', sourceRoot: 'api/src' });
  tree.write('api/src/main.ts', 'original');
  const before = snapshotNxTree(tree);
  const changes = tree.listChanges();
  await expect(
    stageTree(tree, async (staged) => {
      expect(getProjects(staged).get('api')?.root).toBe('api');
      staged.write('api/src/main.ts', 'changed');
      staged.write('api/new.ts', 'new');
      staged.delete('api/project.json');
      expect(
        staged
          .listChanges()
          .some((change) => change.path === 'api/project.json')
      ).toBe(false);
      throw new Error('reject');
    })
  ).rejects.toThrow('reject');
  expect(snapshotNxTree(tree)).toEqual(before);
  expect(tree.listChanges()).toEqual(changes);
  await stageTree(tree, async (staged) => {
    staged.write('api/src/main.ts', 'changed');
    staged.write('api/new.ts', 'new');
  });
  expect(tree.read('api/src/main.ts', 'utf8')).toBe('changed');
  expect(tree.read('api/new.ts', 'utf8')).toBe('new');
});
