import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Tree } from '@nx/devkit';
import { NEST_SCHEMATICS_PACKAGE_NAME } from '../utils/nest-version.js';
import { runNestSchematic } from './schematic-runner.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;

describe('runNestSchematic', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  it('executes a known Nest schematic and reports file changes', async () => {
    const targetRoot = 'tmp/nest-schematic-runner-exec-app';

    const result = await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(targetRoot),
    });

    expect(result.dryRun).toBe(false);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `${targetRoot}/src/main.ts`,
          type: 'create',
        }),
      ])
    );
  });

  it('makes generated files visible in the Nx Tree', async () => {
    const targetRoot = 'tmp/nest-schematic-runner-tree-app';

    await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(targetRoot),
    });

    expect(tree.exists(`${targetRoot}/package.json`)).toBe(true);
    expect(tree.exists(`${targetRoot}/src/main.ts`)).toBe(true);
  });

  it('reports changes in dry-run mode without mutating the Nx Tree', async () => {
    const targetRoot = 'tmp/nest-schematic-runner-dry-run-app';

    const result = await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(targetRoot),
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(tree.exists(`${targetRoot}/package.json`)).toBe(false);
    expect(tree.exists(`${targetRoot}/src/main.ts`)).toBe(false);
  });

  it('throws a clear error for unknown schematic names', async () => {
    await expect(
      runNestSchematic(tree, {
        schematicName: 'missing-schematic',
        schematicOptions: {},
      })
    ).rejects.toThrow(/unknown Nest schematic "missing-schematic"/i);
  });

  it('does not write generated files to the physical filesystem', async () => {
    const targetRoot = 'tmp/nest-schematic-runner-no-disk-app';
    const generatedPackageJsonPath = join(
      process.cwd(),
      targetRoot,
      'package.json'
    );

    expect(existsSync(generatedPackageJsonPath)).toBe(false);

    await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(targetRoot),
    });

    expect(existsSync(generatedPackageJsonPath)).toBe(false);
  });

  it('uses the collection loader and centralized Nest package constants', () => {
    const source = readFileSync(
      new URL('./schematic-runner.ts', import.meta.url),
      'utf-8'
    );

    expect(source).toContain('loadNestSchematicsCollectionInfo');
    expect(source).toContain('NEST_SCHEMATICS_PACKAGE_NAME');
    expect(source).toContain("../utils/nest-version.js");
    expect(source).toContain("./nest-schematic-loader.js");
    expect(source).not.toContain(`'${NEST_SCHEMATICS_PACKAGE_NAME}'`);
  });
});

function createApplicationOptions(targetRoot: string): Record<string, unknown> {
  return {
    name: 'runner-app',
    directory: targetRoot,
    language: 'ts',
    packageManager: 'yarn',
    spec: false,
    strict: true,
    type: 'esm',
  };
}

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
