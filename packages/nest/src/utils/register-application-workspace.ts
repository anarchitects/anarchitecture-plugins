// SPDX-License-Identifier: MIT
import { readJson, updateJson, type Tree } from '@nx/devkit';
import { minimatch } from 'minimatch';
import { posix } from 'node:path';
import { isMap, isSeq, parseDocument } from 'yaml';

/** Validate before native generation; commit registration only after it succeeds. */
export function planApplicationWorkspaceRegistration(
  tree: Tree,
  root: string,
  nativePackageManager?: string
): () => void {
  const manifest = readJson(tree, 'package.json');
  const declared = manifest.packageManager?.split('@')[0];
  const lockManager = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
  ].find(([file]) => tree.exists(file))?.[1];
  const manager =
    declared ??
    lockManager ??
    (tree.exists('pnpm-workspace.yaml') ? 'pnpm' : undefined) ??
    readJson(tree, 'nx.json').cli?.packageManager ??
    (nativePackageManager === 'undefined' ? undefined : nativePackageManager) ??
    'npm';
  if (!['npm', 'yarn', 'pnpm', 'bun'].includes(manager))
    throw new Error(
      `Cannot register a Nest application for package manager "${manager}".`
    );

  if (manager === 'pnpm') {
    const file = 'pnpm-workspace.yaml';
    const document = parseDocument(tree.read(file, 'utf8') ?? '');
    if (
      document.errors.length ||
      (document.contents !== null && !isMap(document.contents))
    )
      throw new Error(`Cannot register a Nest application: invalid ${file}.`);
    const packages = document.toJS()?.packages;
    if (isCovered(packages, root, file)) return () => undefined;
    const sequence = document.get('packages');
    if (isSeq(sequence)) sequence.add(root);
    else document.set('packages', [...(packages ?? []), root]);
    const content = document.toString();
    return () => tree.write(file, content);
  }

  const workspaces = manifest.workspaces;
  const objectForm = workspaces !== undefined && !Array.isArray(workspaces);
  if (objectForm && (workspaces === null || typeof workspaces !== 'object'))
    throw new Error(
      'Cannot register a Nest application: invalid package.json workspaces.'
    );
  const patterns = objectForm ? workspaces.packages : workspaces;
  if (isCovered(patterns, root, 'package.json workspaces'))
    return () => undefined;
  return () =>
    updateJson(tree, 'package.json', (json) => {
      if (objectForm) json.workspaces.packages = [...(patterns ?? []), root];
      else json.workspaces = [...(patterns ?? []), root];
      return json;
    });
}

function isCovered(patterns: unknown, root: string, source: string): boolean {
  if (patterns === undefined) return false;
  if (
    !Array.isArray(patterns) ||
    patterns.some((pattern) => typeof pattern !== 'string')
  )
    throw new Error(
      `Cannot register a Nest application: ${source} must contain an array of workspace patterns.`
    );
  const matches = (pattern: string) =>
    minimatch(root, posix.normalize(pattern).replace(/\/$/, ''), {
      nonegate: true,
      nocomment: true,
    });
  if (
    patterns.some(
      (pattern) => pattern.startsWith('!') && matches(pattern.slice(1))
    )
  )
    throw new Error(
      `Nest application "${root}" is excluded by ${source}. Choose another directory or update that exclusion explicitly.`
    );
  return patterns.some(
    (pattern) => !pattern.startsWith('!') && matches(pattern)
  );
}
