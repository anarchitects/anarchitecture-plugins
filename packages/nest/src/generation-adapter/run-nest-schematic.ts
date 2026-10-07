// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import {
  additiveTransform,
  type AdditiveTransform,
} from './additive-transform';
import { loadNestSchematicRuntime } from './nest-schematic-runtime';
import {
  applySnapshot,
  diffSnapshots,
  snapshotNxTree,
  treePath,
  type SchematicChange,
  type TreeSnapshot,
} from './tree-snapshot';

export interface RunNestSchematicOptions {
  schematic: string;
  options: Record<string, unknown>;
  /** Preview changes without even mutating the supplied Nx Tree. */
  dryRun?: boolean;
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
  const { core, schematics, tools, rxjs, host, aliases, version } =
    await loadNestSchematicRuntime();
  const name = aliases.get(options.schematic);
  if (!name)
    throw new Error(
      `Unsupported native Nest generation schematic: ${options.schematic}`
    );
  const before = snapshotNxTree(tree);
  // Existing Nx files are the base filesystem, not schematic create actions.
  // Native format rules inspect actions and must not format unrelated files.
  const hostFiles = new core.virtualFs.SimpleMemoryHost();
  const syncHost = new core.virtualFs.SyncDelegateHost(hostFiles);
  for (const [path, content] of before) {
    syncHost.write(core.normalize(path), Uint8Array.from(content).buffer);
  }
  const input = new schematics.HostTree(hostFiles);
  const registry = new core.schema.CoreSchemaRegistry(
    schematics.formats.standardFormats
  );
  registry.addPostTransform(core.schema.transforms.addUndefinedDefaults);
  host.registerOptionsTransform(tools.validateOptionsWithSchema(registry));
  const deferredTasks: NestSchematicResult['deferredTasks'] = [];
  host.registerContextTransform((context) => {
    context.addTask = (task) => {
      const configuration = task.toConfiguration();
      deferredTasks.push({
        name: configuration.name,
        options: configuration.options,
      });
      return { id: deferredTasks.length };
    };
    return context;
  });
  const engine = new schematics.SchematicEngine(host);
  const schematic = engine
    .createCollection('@nestjs/schematics')
    .createSchematic(name);
  // No workflow, task executors, CLI, install, git, cwd changes, or process exits.
  const output = await rxjs.lastValueFrom(
    schematic.call(structuredClone(options.options), rxjs.of(input), {
      logger: new core.logging.Logger('nest-generation'),
    })
  );
  const after: TreeSnapshot = new Map();
  output.visit((path) => {
    const content = output.read(path);
    if (content !== null)
      after.set(treePath(path.replace(/^\//, '')), Buffer.from(content));
  });
  await options.postTransform?.(additiveTransform(after));
  const changes = options.dryRun
    ? diffSnapshots(before, after)
    : applySnapshot(tree, before, after);
  return { changes, deferredTasks, schematicVersion: version };
}
