// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import {
  additiveTransform,
  type AdditiveTransform,
} from './additive-transform';
import { runNativeSchematic } from './run-native-schematic';
import { runIsolatedSchematic } from './run-isolated-schematic';
import { aliasResourceModuleImports } from './alias-resource-module-imports';
import { transformNodeApplication } from './node-application';
import {
  applySnapshot,
  diffSnapshots,
  snapshotNxTree,
  treePath,
  type SchematicChange,
} from './tree-snapshot';

export interface RunNestSchematicOptions {
  /** Bounded overlay for independent HTTP applications, not a general rewrite hook. */
  httpPlatform?: 'node';
  schematic: string;
  options: Record<string, unknown>;
  /** Preview changes without even mutating the supplied Nx Tree. */
  dryRun?: boolean;
  /** Present this workspace-relative directory as the native Tree root. */
  workingDirectory?: string;
  /** Isolate native cwd-based reads and satisfy them from the scoped Tree. */
  isolateHostReads?: boolean;
  /** Alias colliding resource imports when registering into an Nx library module. */
  aliasResourceImports?: boolean;
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
  if (
    options.httpPlatform !== undefined &&
    (options.httpPlatform !== 'node' ||
      options.schematic !== 'application' ||
      options.workingDirectory ||
      options.isolateHostReads)
  ) {
    throw new Error(
      'The Node HTTP overlay requires an independent application.'
    );
  }
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
    : await runNativeSchematic(
        options.httpPlatform ? new Map() : scoped,
        options
      );
  if (options.httpPlatform) {
    transformNodeApplication(
      result.after,
      treePath(String(options.options.directory)),
      result.schematicVersion
    );
    // Compare final overlay bytes, never native templates, on a repeat invocation.
    for (const [path, content] of result.after) {
      const previous = before.get(path);
      if (previous && !previous.equals(content))
        throw new Error(
          `Cannot generate Node application: conflicting file ${path}. Choose an empty destination; existing applications are not migrated.`
        );
    }
    for (const [path, content] of before)
      if (!result.after.has(path)) result.after.set(path, content);
  }
  if (options.schematic === 'resource' && options.aliasResourceImports)
    aliasResourceModuleImports(scoped, result.after);
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
