// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { posix } from 'node:path';

export type TreeSnapshot = Map<string, Buffer>;
export interface SchematicChange {
  path: string;
  type: 'create' | 'update' | 'delete';
}

export function treePath(path: string): string {
  const portable = path.replace(/\\/g, '/');
  if (
    portable.startsWith('/') ||
    /^[A-Za-z]:/.test(portable) ||
    portable.split('/').includes('..')
  ) {
    throw new Error(`Expected a workspace-relative path: ${path}`);
  }
  const normalized = posix.normalize(portable);
  if (normalized === '.' || !normalized)
    throw new Error('Expected a file path.');
  if (
    normalized
      .split('/')
      .some((part) => ['node_modules', '.git', '.nx'].includes(part))
  ) {
    throw new Error(`Cannot generate host/runtime state: ${path}`);
  }
  return normalized;
}

export function snapshotNxTree(tree: Tree): TreeSnapshot {
  const snapshot: TreeSnapshot = new Map();
  function visit(directory: string) {
    for (const child of tree.children(directory)) {
      // These are host/runtime state, never schematic input or output.
      if (['node_modules', '.git', '.nx'].includes(child)) continue;
      const path = directory ? `${directory}/${child}` : child;
      if (tree.isFile(path)) {
        const content = tree.read(path);
        if (content !== null) snapshot.set(path, Buffer.from(content));
      } else visit(path);
    }
  }
  visit('');
  return snapshot;
}

export function diffSnapshots(
  before: TreeSnapshot,
  after: TreeSnapshot
): SchematicChange[] {
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .flatMap((path) => {
      const previous = before.get(path);
      const next = after.get(path);
      if (previous !== undefined && next !== undefined && previous.equals(next))
        return [];
      if (previous === undefined && next === undefined) return [];
      return [
        {
          path,
          type:
            previous === undefined
              ? ('create' as const)
              : next === undefined
              ? ('delete' as const)
              : ('update' as const),
        },
      ];
    });
}

export function applySnapshot(
  tree: Tree,
  before: TreeSnapshot,
  after: TreeSnapshot
): SchematicChange[] {
  const changes = diffSnapshots(before, after);
  for (const change of changes) {
    if (change.type === 'delete') tree.delete(change.path);
    else tree.write(change.path, after.get(change.path)!);
  }
  return changes;
}
