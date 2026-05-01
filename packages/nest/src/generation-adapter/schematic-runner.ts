import { logging, schema } from '@angular-devkit/core';
import {
  formats,
  HostTree,
  SchematicEngine,
  type Tree as AngularTree,
} from '@angular-devkit/schematics';
import createJiti from 'jiti';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Tree } from '@nx/devkit';
import { lastValueFrom, of } from 'rxjs';
import { NEST_SCHEMATICS_PACKAGE_NAME } from '../utils/nest-version.js';
import { loadNestSchematicsCollectionInfo } from './nest-schematic-loader.js';

const require = createRequire(import.meta.url);
const jiti = createJiti(fileURLToPath(import.meta.url));
const {
  NodeModulesTestEngineHost,
}: {
  NodeModulesTestEngineHost: new (paths?: string[]) => {
    registerCollection(name: string, path: string): void;
    registerOptionsTransform(
      transform: (...args: readonly unknown[]) => unknown
    ): void;
  };
} = require('@angular-devkit/schematics/tools/node-modules-test-engine-host.js');
const {
  validateOptionsWithSchema,
}: {
  validateOptionsWithSchema: (
    registry: schema.CoreSchemaRegistry
  ) => (...args: readonly unknown[]) => unknown;
} = require('@angular-devkit/schematics/tools/schema-option-transform.js');

export interface RunNestSchematicOptions {
  schematicName: string;
  schematicOptions: Record<string, unknown>;
  dryRun?: boolean;
}

export interface NestSchematicFileChange {
  path: string;
  type: 'create' | 'update' | 'delete';
}

export interface RunNestSchematicResult {
  changes: readonly NestSchematicFileChange[];
  dryRun: boolean;
}

interface TreeSnapshot {
  readonly files: ReadonlyMap<string, Buffer>;
}

export async function runNestSchematic(
  tree: Tree,
  options: RunNestSchematicOptions
): Promise<RunNestSchematicResult> {
  const { collectionPath, availableSchematics } =
    loadNestSchematicsCollectionInfo();

  if (!availableSchematics.includes(options.schematicName)) {
    throw new Error(
      `Unknown Nest schematic "${options.schematicName}". ` +
        `Available schematics: ${availableSchematics.join(', ')}.`
    );
  }

  const runner = new SchematicTestRunner(
    NEST_SCHEMATICS_PACKAGE_NAME,
    collectionPath
  );
  const inputTree = createAngularTreeFromNxTree(tree);
  const beforeSnapshot = captureTreeSnapshot(inputTree);

  let outputTree: AngularTree;
  try {
    // Run the real Nest schematic fully in memory, then bridge the result back
    // into the Nx Tree so tests and dry-runs never touch the physical filesystem.
    outputTree = await runner.runSchematic(
      options.schematicName,
      options.schematicOptions,
      inputTree
    );
  } catch (error) {
    throw new Error(
      `Failed to execute Nest schematic "${options.schematicName}" from "${collectionPath}": ${
        (error as Error).message
      }`,
      { cause: error }
    );
  }

  const afterSnapshot = captureTreeSnapshot(outputTree);
  const changes = diffSnapshots(beforeSnapshot, afterSnapshot);

  if (!options.dryRun) {
    applySnapshotChangesToNxTree(tree, changes, afterSnapshot);
  }

  return {
    changes,
    dryRun: options.dryRun ?? false,
  };
}

class SchematicTestRunner {
  private readonly engineHost: EsmAwareNodeModulesTestEngineHost;
  private readonly engine: SchematicEngine<object, object>;
  private readonly collectionName: string;

  constructor(collectionName: string, collectionPath: string) {
    this.collectionName = collectionName;
    this.engineHost = new EsmAwareNodeModulesTestEngineHost([collectionPath]);
    this.engineHost.registerCollection(collectionName, collectionPath);

    const registry = new schema.CoreSchemaRegistry(formats.standardFormats);
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    this.engineHost.registerOptionsTransform(
      validateOptionsWithSchema(registry)
    );

    this.engine = new SchematicEngine<object, object>(
      this.engineHost as never
    );
  }

  async runSchematic(
    schematicName: string,
    schematicOptions: Record<string, unknown>,
    tree: AngularTree
  ): Promise<AngularTree> {
    const collection = this.engine.createCollection(this.collectionName);
    const schematic = collection.createSchematic(schematicName, true);

    return await lastValueFrom(
      schematic.call(schematicOptions, of(tree), {
        logger: new logging.Logger('nest-schematic-runner'),
      })
    );
  }
}

class EsmAwareNodeModulesTestEngineHost extends NodeModulesTestEngineHost {
  constructor(paths?: string[]) {
    super(paths);
  }

  protected _resolveReferenceString(
    refString: string,
    parentPath: string
  ): { ref: unknown; path: string } | null {
    try {
      const [modulePath, exportName] = refString.split('#', 2);
      const moduleRequest =
        modulePath[0] === '.' ? resolve(parentPath, modulePath) : modulePath;
      const resolvedModule = require.resolve(moduleRequest);
      const moduleExports = jiti(resolvedModule) as Record<string, unknown>;
      const ref = moduleExports[exportName || 'default'];

      if (!ref) {
        return null;
      }

      return {
        ref,
        path: resolvedModule,
      };
    } catch {
      return null;
    }
  }
}

function createAngularTreeFromNxTree(tree: Tree): HostTree {
  const angularTree = new HostTree();

  visitNxTree(tree, '', (path) => {
    const content = tree.read(path);
    if (content) {
      angularTree.create(toAngularTreePath(path), content);
    }
  });

  return angularTree;
}

function captureTreeSnapshot(tree: {
  visit(visitor: (path: string) => void): void;
  read(path: string): Buffer | null;
}): TreeSnapshot {
  const files = new Map<string, Buffer>();

  tree.visit((path) => {
    const content = tree.read(path);
    if (content) {
      files.set(normalizeTreePath(path), Buffer.from(content));
    }
  });

  return { files };
}

function diffSnapshots(
  before: TreeSnapshot,
  after: TreeSnapshot
): NestSchematicFileChange[] {
  const allPaths = new Set([...before.files.keys(), ...after.files.keys()]);
  const changes: NestSchematicFileChange[] = [];

  for (const path of Array.from(allPaths).sort()) {
    const beforeContent = before.files.get(path);
    const afterContent = after.files.get(path);

    if (!beforeContent && afterContent) {
      changes.push({ path, type: 'create' });
      continue;
    }

    if (beforeContent && !afterContent) {
      changes.push({ path, type: 'delete' });
      continue;
    }

    if (
      beforeContent &&
      afterContent &&
      !beforeContent.equals(afterContent)
    ) {
      changes.push({ path, type: 'update' });
    }
  }

  return changes;
}

function applySnapshotChangesToNxTree(
  tree: Tree,
  changes: readonly NestSchematicFileChange[],
  snapshot: TreeSnapshot
): void {
  for (const change of changes) {
    if (change.type === 'delete') {
      if (tree.exists(change.path)) {
        tree.delete(change.path);
      }
      continue;
    }

    const content = snapshot.files.get(change.path);
    if (!content) {
      throw new Error(
        `Unable to apply "${change.type}" change for "${change.path}" because no generated content was captured.`
      );
    }

    tree.write(change.path, content);
  }
}

function toAngularTreePath(path: string): string {
  return `/${normalizeTreePath(path)}`;
}

function normalizeTreePath(path: string): string {
  return normalizePath(path).replace(/^\/+/, '');
}

function visitNxTree(
  tree: Tree,
  dirPath: string,
  visitor: (path: string) => void
): void {
  for (const child of tree.children(dirPath)) {
    const childPath = dirPath ? `${dirPath}/${child}` : child;

    if (tree.isFile(childPath)) {
      visitor(childPath);
      continue;
    }

    visitNxTree(tree, childPath, visitor);
  }
}
