// SPDX-License-Identifier: MIT
import { loadNestSchematicRuntime } from './nest-schematic-runtime';
import { treePath, type TreeSnapshot } from './tree-snapshot';
import type { NestSchematicResult } from './run-nest-schematic';

/** Execute the official engine against an in-memory filesystem. */
export async function runNativeSchematic(
  before: TreeSnapshot,
  options: { schematic: string; options: Record<string, unknown> }
) {
  const { core, schematics, tools, rxjs, host, aliases, version } =
    await loadNestSchematicRuntime();
  const name = aliases.get(options.schematic);
  if (!name)
    throw new Error(
      `Unsupported native Nest generation schematic: ${options.schematic}`
    );
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
  // Materialize native actions through the public sink, entirely in memory.
  // Tree.visit() alone still exposes descendants of scheduled directory deletes;
  // the sink applies them recursively, matching a normal CLI filesystem workflow.
  await rxjs.lastValueFrom(new schematics.HostSink(hostFiles).commit(output));
  const committed = new schematics.HostTree(hostFiles);
  const after: TreeSnapshot = new Map();
  committed.visit((path) => {
    const content = committed.read(path);
    if (content !== null)
      after.set(treePath(path.replace(/^\//, '')), Buffer.from(content));
  });
  return { after, deferredTasks, schematicVersion: version };
}
