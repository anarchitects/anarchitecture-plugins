// SPDX-License-Identifier: MIT
import { readJson, writeJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { includeNestOwnerFiles } from './include-nest-owner-files';

export const nestMemberLintScript =
  'oxlint --type-aware --ignore-pattern "**/dist/**" --ignore-pattern "**/coverage/**" .';

/** Repair the pinned native default without taking over consumer lint tools. */
export function setupLint(
  tree: Tree,
  ownerRoot: string,
  nativeMember?: { schematic: 'library' | 'sub-app'; rootDir?: string }
): void {
  const file = posix.join(ownerRoot, 'package.json');
  const manifest = readJson(tree, file);
  if (
    [
      'oxlint --type-aware src/ test/',
      'oxlint --type-aware apps/ libs/',
      ...(nativeMember
        ? [
            nativeMember.schematic === 'library'
              ? `oxlint --type-aware src/ test/ ${
                  nativeMember.rootDir ?? 'libs'
                }/`
              : `oxlint --type-aware ${nativeMember.rootDir ?? 'apps'}/ libs/`,
          ]
        : []),
    ].includes(manifest.scripts?.lint)
  ) {
    manifest.scripts.lint = nestMemberLintScript;
    writeJson(tree, file, manifest);
  }
  if (manifest.scripts?.lint === nestMemberLintScript)
    includeNestOwnerFiles(tree, ownerRoot);
}
