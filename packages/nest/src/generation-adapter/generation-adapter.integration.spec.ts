import * as childProcess from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '@nx/devkit';
import {
  assertRequiredNestSchematicsAvailable,
  createFileIfMissing,
  loadNestSchematicsCollectionInfo,
  runNestCliFallback,
  runNestSchematic,
  updateJsonConfig,
} from './index.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;

describe('generation adapter integration', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    jest.restoreAllMocks();
    tree = createTreeWithEmptyWorkspace();
  });

  it('loads the Nest schematics collection and discovers the required schematics', () => {
    const info = loadNestSchematicsCollectionInfo();

    expect(info.collectionPath).toBeTruthy();
    expect(info.availableSchematics).toEqual(
      expect.arrayContaining(['application', 'library', 'resource'])
    );
    expect(() =>
      assertRequiredNestSchematicsAvailable(info.availableSchematics)
    ).not.toThrow();
  });

  it('runs the application schematic into an Nx Tree without writing to disk', async () => {
    const projectRoot = 'demo-api';

    assertGeneratedFilesAbsentOnDisk(projectRoot);

    const result = await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(projectRoot),
    });

    expect(result.dryRun).toBe(false);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `${projectRoot}/src/main.ts`,
          type: 'create',
        }),
        expect.objectContaining({
          path: `${projectRoot}/src/app.module.ts`,
          type: 'create',
        }),
        expect.objectContaining({
          path: `${projectRoot}/nest-cli.json`,
          type: 'create',
        }),
      ])
    );

    expect(tree.exists(`${projectRoot}/src/main.ts`)).toBe(true);
    expect(tree.exists(`${projectRoot}/src/app.module.ts`)).toBe(true);
    expect(tree.exists(`${projectRoot}/nest-cli.json`)).toBe(true);
    assertGeneratedFilesAbsentOnDisk(projectRoot);
  });

  it('reports application schematic changes in dry-run mode without mutating the Nx Tree', async () => {
    const projectRoot = 'demo-api';

    assertGeneratedFilesAbsentOnDisk(projectRoot);

    const result = await runNestSchematic(tree, {
      schematicName: 'application',
      schematicOptions: createApplicationOptions(projectRoot),
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `${projectRoot}/src/main.ts`,
          type: 'create',
        }),
      ])
    );

    expect(tree.exists(`${projectRoot}/src/main.ts`)).toBe(false);
    expect(tree.exists(`${projectRoot}/src/app.module.ts`)).toBe(false);
    expect(tree.exists(`${projectRoot}/nest-cli.json`)).toBe(false);
    assertGeneratedFilesAbsentOnDisk(projectRoot);
  });

  it('applies additive guard helpers safely in adapter context', () => {
    const filePath = 'demo-api/src/custom.ts';
    const configPath = 'demo-api/nest-cli.json';

    createFileIfMissing(tree, {
      path: filePath,
      content: 'export const value = 1;\n',
    });

    expect(tree.read(filePath, 'utf-8')).toBe('export const value = 1;\n');

    expect(() =>
      createFileIfMissing(tree, {
        path: filePath,
        content: 'export const value = 2;\n',
      })
    ).toThrow(/refusing to overwrite existing file/i);

    createFileIfMissing(tree, {
      path: filePath,
      content: 'export const value = 2;\n',
      allowOverwrite: true,
      justification: 'Integration coverage for additive updates.',
    });

    expect(tree.read(filePath, 'utf-8')).toBe('export const value = 2;\n');

    updateJsonConfig(tree, configPath, (value) => {
      value.root = 'demo-api';
      value.monorepo = true;
    });
    const initialConfig = tree.read(configPath, 'utf-8');

    updateJsonConfig(tree, configPath, (value) => {
      value.root = 'demo-api';
      value.monorepo = true;
    });

    expect(tree.read(configPath, 'utf-8')).toBe(initialConfig);
    expect(initialConfig).toBe(
      '{\n  "root": "demo-api",\n  "monorepo": true\n}\n'
    );
  });

  it('builds a dry-run CLI fallback plan without executing a process or writing files', async () => {
    const projectRoot = 'demo-api';
    const spawnSpy = jest.spyOn(childProcess, 'spawn');

    assertGeneratedFilesAbsentOnDisk(projectRoot);

    const plan = await runNestCliFallback({
      command: 'new',
      args: [projectRoot],
      cwd: '/tmp/nx-nest-cli-fallback',
      dryRun: true,
    });

    expect(plan.executed).toBe(false);
    expect(plan.dryRun).toBe(true);
    expect(plan.args).toEqual(
      expect.arrayContaining([
        'new',
        projectRoot,
        '--dry-run',
        '--skip-install',
        '--skip-git',
      ])
    );
    expect(spawnSpy).not.toHaveBeenCalled();
    assertGeneratedFilesAbsentOnDisk(projectRoot);
  });
});

function createApplicationOptions(projectRoot: string): Record<string, unknown> {
  return {
    name: 'demo-api',
    directory: projectRoot,
    language: 'ts',
    packageManager: 'yarn',
    spec: false,
    strict: true,
    type: 'esm',
  };
}

function assertGeneratedFilesAbsentOnDisk(projectRoot: string): void {
  expect(existsSync(join(process.cwd(), projectRoot, 'package.json'))).toBe(
    false
  );
  expect(existsSync(join(process.cwd(), projectRoot, 'src', 'main.ts'))).toBe(
    false
  );
}

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
