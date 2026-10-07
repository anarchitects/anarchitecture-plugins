// SPDX-License-Identifier: MIT
import { readJson, writeJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { includeNestOwnerFiles } from './include-nest-owner-files';

export const nestMemberLintScript =
  'oxlint --type-aware --ignore-pattern "**/dist/**" --ignore-pattern "**/coverage/**" .';

/** Repair the pinned native default without taking over consumer lint tools. */
export function setupLint(tree: Tree, ownerRoot: string): void {
  const file = posix.join(ownerRoot, 'package.json');
  const manifest = readJson(tree, file);
  if (manifest.scripts?.lint === 'oxlint --type-aware src/ test/') {
    manifest.scripts.lint = nestMemberLintScript;
    writeJson(tree, file, manifest);
  }
  if (manifest.scripts?.lint === nestMemberLintScript)
    includeNestOwnerFiles(tree, ownerRoot);
}
