// SPDX-License-Identifier: MIT
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  applySnapshot,
  diffSnapshots,
  snapshotNxTree,
  treePath,
} from './tree-snapshot';

describe('schematic Tree bridge', () => {
  it('preserves binary and empty files and bridges create/update/delete/rename', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('binary', Buffer.from([0, 255, 42]));
    tree.write('empty', Buffer.alloc(0));
    tree.write('old.ts', 'original');
    tree.write('changed.ts', 'before');
    const before = snapshotNxTree(tree);
    const after = new Map(before);
    after.delete('old.ts');
    after.set('renamed.ts', before.get('old.ts')!);
    after.set('changed.ts', Buffer.from('after'));
    after.set('new.ts', Buffer.alloc(0));
    expect(diffSnapshots(before, after)).toEqual([
      { path: 'changed.ts', type: 'update' },
      { path: 'new.ts', type: 'create' },
      { path: 'old.ts', type: 'delete' },
      { path: 'renamed.ts', type: 'create' },
    ]);
    applySnapshot(tree, before, after);
    expect(snapshotNxTree(tree)).toEqual(after);
    expect(tree.read('binary')).toEqual(Buffer.from([0, 255, 42]));
    expect(tree.read('empty')).toEqual(Buffer.alloc(0));
  });

  it('includes pending Nx changes and omits runtime state', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('nested/.config', 'keep');
    tree.write('node_modules/example/index.js', 'ignore');
    tree.write('.git/config', 'ignore');
    tree.write('nested/.nx/cache', 'ignore');
    const snapshot = snapshotNxTree(tree);
    expect(snapshot.get('nested/.config')?.toString()).toBe('keep');
    expect(
      [...snapshot.keys()].some(
        (path) =>
          path.includes('ignore') ||
          path.includes('node_modules') ||
          path.includes('.git/') ||
          path.includes('.nx/')
      )
    ).toBe(false);
  });

  it.each([
    '../outside',
    'nested/../../outside',
    '/absolute',
    'C:\\outside',
    '.git/config',
    'a/node_modules/file',
    '.nx/cache',
  ])('rejects unsafe output %s', (path) => {
    expect(() => treePath(path)).toThrow();
  });
});
