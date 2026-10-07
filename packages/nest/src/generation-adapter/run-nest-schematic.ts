// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import {
  additiveTransform,
  type AdditiveTransform,
} from './additive-transform';
import { runNativeSchematic } from './run-native-schematic';
import { runIsolatedSchematic } from './run-isolated-schematic';
import {
  applySnapshot,
  diffSnapshots,
  snapshotNxTree,
  treePath,
  type SchematicChange,
} from './tree-snapshot';

export interface RunNestSchematicOptions {
  schematic: string;
  options: Record<string, unknown>;
  /** Preview changes without even mutating the supplied Nx Tree. */
  dryRun?: boolean;
  /** Present this workspace-relative directory as the native Tree root. */
  workingDirectory?: string;
  /** Isolate native cwd-based reads and satisfy them from the scoped Tree. */
  isolateHostReads?: boolean;
  postTransform?: (transform: AdditiveTransform) => void | Promise<void>;
}

export interface NestSchematicResult {
  changes: SchematicChange[];
  /** Report only. The adapter never executes schematic tasks. */
  deferredTasks: { name: string; options?: unknown }[];
  schematicVersion: string;
}

/** Stage all work in memory and commit only after schematic + guard succeed. */
export async function runNestSchematic(
  tree: Tree,
  options: RunNestSchematicOptions
): Promise<NestSchematicResult> {
  const before = snapshotNxTree(tree);
  const directory =
    options.workingDirectory && options.workingDirectory !== '.'
      ? treePath(options.workingDirectory)
      : '';
  const prefix = directory ? directory + '/' : '';
  const scoped = new Map(
    [...before]
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, content]) => [path.slice(prefix.length), content])
  );
  const result = options.isolateHostReads
    ? await runIsolatedSchematic(scoped, options)
    : await runNativeSchematic(scoped, options);
  const after = new Map(
    [...before].filter(([path]) => !path.startsWith(prefix))
  );
  for (const [path, content] of result.after)
    after.set(prefix + treePath(path), Buffer.from(content));
  await options.postTransform?.(additiveTransform(after));
  const changes = options.dryRun
    ? diffSnapshots(before, after)
    : applySnapshot(tree, before, after);
  return {
    changes,
    deferredTasks: result.deferredTasks,
    schematicVersion: result.schematicVersion,
  };
}
