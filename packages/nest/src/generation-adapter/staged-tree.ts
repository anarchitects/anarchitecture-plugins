// SPDX-License-Identifier: MIT
import type { FileChange, Tree } from '@nx/devkit';
import {
  applySnapshot,
  diffSnapshots,
  snapshotNxTree,
  treePath,
} from './tree-snapshot';

/** Isolate member generation and its tooling helpers until all steps succeed. */
export async function stageTree<T>(
  tree: Tree,
  operation: (staged: Tree) => Promise<T>
): Promise<T> {
  const before = snapshotNxTree(tree);
  const files = new Map(before);
  const pending = new Map(
    tree.listChanges().map((change) => [change.path, change])
  );
  const key = (path: string) => treePath(path.replace(/^\//, ''));
  const staged: Tree = {
    root: tree.root,
    read: ((path: string, encoding?: BufferEncoding) => {
      const value = files.get(key(path));
      return value
        ? encoding
          ? value.toString(encoding)
          : Buffer.from(value)
        : null;
    }) as Tree['read'],
    write(path, content, options) {
      if (options?.mode !== undefined)
        throw new Error('Member staging does not change file permissions.');
      files.set(key(path), Buffer.from(content));
    },
    exists: (path) =>
      files.has(key(path)) ||
      [...files.keys()].some((file) => file.startsWith(key(path) + '/')),
    isFile: (path) => files.has(key(path)),
    children(path) {
      const prefix = ['', '.', '/'].includes(path)
        ? ''
        : key(path).replace(/\/$/, '') + '/';
      return [
        ...new Set(
          [...files.keys()]
            .filter((file) => file.startsWith(prefix))
            .map((file) => file.slice(prefix.length).split('/')[0])
        ),
      ];
    },
    delete(path) {
      const name = key(path);
      for (const file of files.keys())
        if (file === name || file.startsWith(name + '/')) files.delete(file);
    },
    rename() {
      throw new Error('Member staging uses snapshot moves, not Tree.rename.');
    },
    changePermissions() {
      throw new Error('Member staging does not change file permissions.');
    },
    listChanges() {
      const changes = new Map(pending);
      for (const change of diffSnapshots(before, files)) {
        const previous = pending.get(change.path);
        if (change.type === 'delete' && previous?.type === 'CREATE')
          changes.delete(change.path);
        else
          changes.set(change.path, {
            path: change.path,
            type:
              change.type === 'delete'
                ? 'DELETE'
                : previous?.type === 'CREATE'
                ? 'CREATE'
                : (change.type.toUpperCase() as FileChange['type']),
            content: files.get(change.path) ?? null,
          });
      }
      return [...changes.values()];
    },
  };
  const result = await operation(staged);
  applySnapshot(tree, before, files);
  return result;
}
