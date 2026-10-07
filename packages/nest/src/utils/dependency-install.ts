// SPDX-License-Identifier: MIT
import {
  installPackagesTask,
  readJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { posix } from 'node:path';
import type { NestSchematicResult } from '../generation-adapter/run-nest-schematic';

/** Ignore formatting, key order, scripts, and other non-dependency changes. */
export function dependencyState(tree: Tree, roots: string[]): string {
  return JSON.stringify(
    [...new Set(roots.map((root) => posix.join(root, 'package.json')))]
      .sort()
      .map((file) => {
        const manifest = tree.exists(file) ? readJson(tree, file) : {};
        return [
          file,
          ...[
            'dependencies',
            'devDependencies',
            'optionalDependencies',
            'peerDependencies',
          ].map((section) =>
            Object.entries(manifest[section] ?? {}).sort(([a], [b]) =>
              a.localeCompare(b)
            )
          ),
        ];
      })
  );
}

export function nativeInstallRequired(result: NestSchematicResult): boolean {
  return result.deferredTasks.some((task) => task.name === 'node-package');
}

/** One Nx-owned workspace install, after successful Tree commit. Never run native tasks. */
export function installAfterGeneration(
  tree: Tree,
  skipInstall: boolean | undefined,
  ...requirements: boolean[]
): GeneratorCallback | undefined {
  if (skipInstall || !requirements.some(Boolean)) return undefined;
  // Force includes nested owner manifest changes; Nx's default check only
  // watches the root manifest. Nx selects the workspace package manager.
  return () => installPackagesTask(tree, true);
}
