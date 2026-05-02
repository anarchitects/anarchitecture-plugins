import * as childProcess from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readJson, updateJson, type Tree } from '@nx/devkit';
import initGenerator, {
  initGenerator as namedInitGenerator,
} from './generator.js';
import {
  nestDevDependencies,
  nestRuntimeDependencies,
} from '../../utils/nest-dependencies.js';
import {
  NEST_CLI_PACKAGE_NAME,
  NEST_COMMON_PACKAGE,
  NEST_CORE_PACKAGE,
} from '../../utils/nest-version.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;
const schemaPath = new URL('./schema.json', import.meta.url);
const schemaTypesPath = new URL('./schema.d.ts', import.meta.url);

describe('initGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('can be imported through the default and named exports', () => {
    expect(initGenerator).toBeDefined();
    expect(namedInitGenerator).toBe(initGenerator);
  });

  it.each([
    { packageManager: 'yarn' as const },
    { packageManager: 'npm' as const },
    { packageManager: 'pnpm' as const },
  ])(
    'accepts packageManager option %j without executing external commands',
    async (options) => {
      const spawnSpy = jest.spyOn(childProcess, 'spawn');
      const nxJsonBefore = tree.read('nx.json', 'utf-8');

      await expect(
        initGenerator(tree, {
          ...options,
          skipPackageJson: true,
        })
      ).resolves.toBe(undefined);

      expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
      expect(tree.exists('demo-api/src/main.ts')).toBe(false);
      expect(tree.exists('demo-api/nest-cli.json')).toBe(false);
      expect(spawnSpy).not.toHaveBeenCalled();
    }
  );

  it('adds Nest base runtime and dev dependencies by default', async () => {
    const spawnSpy = jest.spyOn(childProcess, 'spawn');
    const nxJsonBefore = tree.read('nx.json', 'utf-8');

    await expect(initGenerator(tree, {})).resolves.toBe(undefined);

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toEqual(
      expect.objectContaining(nestRuntimeDependencies)
    );
    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining(nestDevDependencies)
    );
    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
    expect(tree.exists('demo-api/src/main.ts')).toBe(false);
    expect(tree.exists('demo-api/nest-cli.json')).toBe(false);
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('documents explicit defaults in schema.json', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
      properties: Record<string, { default?: unknown; enum?: string[] }>;
    };

    expect(schema.properties.packageManager).toEqual(
      expect.objectContaining({
        default: 'yarn',
        enum: ['yarn', 'npm', 'pnpm'],
      })
    );
    expect(schema.properties.skipPackageJson).toEqual(
      expect.objectContaining({ default: false })
    );
    expect(schema.properties.skipFormat).toEqual(
      expect.objectContaining({ default: false })
    );
    expect(schema.properties.forceVersions).toEqual(
      expect.objectContaining({ default: false })
    );
  });

  it('keeps schema.d.ts option names aligned with schema.json', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as {
      properties: Record<string, unknown>;
    };
    const schemaTypes = readFileSync(schemaTypesPath, 'utf-8');
    const optionNames = Object.keys(schema.properties);

    expect(optionNames).toEqual([
      'packageManager',
      'skipPackageJson',
      'skipFormat',
      'forceVersions',
    ]);
    for (const optionName of optionNames) {
      expect(schemaTypes).toContain(`${optionName}?`);
    }
  });

  it('does not wire in schematics or CLI behavior', () => {
    const source = readFileSync(
      new URL('./generator.ts', import.meta.url),
      'utf-8'
    );

    expect(source).not.toContain('runNestSchematic');
    expect(source).not.toContain('runNestCliFallback');
    expect(source).not.toContain('@nestjs/schematics');
    expect(source).not.toContain('@nestjs/cli');
  });

  it('does not mutate package.json when skipPackageJson is true', async () => {
    const spawnSpy = jest.spyOn(childProcess, 'spawn');
    const packageJsonBefore = tree.read('package.json', 'utf-8');
    const nxJsonBefore = tree.read('nx.json', 'utf-8');

    await expect(
      initGenerator(tree, {
        packageManager: 'yarn',
        skipPackageJson: true,
        skipFormat: true,
        forceVersions: true,
      })
    ).resolves.toBe(undefined);

    expect(tree.read('package.json', 'utf-8')).toBe(packageJsonBefore);
    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('is idempotent when run twice', async () => {
    await initGenerator(tree, {});
    const firstPackageJson = tree.read('package.json', 'utf-8');

    await initGenerator(tree, {});

    expect(tree.read('package.json', 'utf-8')).toBe(firstPackageJson);
  });

  it('preserves existing dependency versions by default', async () => {
    updateJson(
      tree,
      'package.json',
      (json: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }) => ({
        ...json,
        dependencies: {
          ...(json.dependencies ?? {}),
          [NEST_COMMON_PACKAGE]: '^10.0.0',
        },
        devDependencies: {
          ...(json.devDependencies ?? {}),
          [NEST_CLI_PACKAGE_NAME]: '^10.0.0',
        },
      })
    );

    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.[NEST_COMMON_PACKAGE]).toBe('^10.0.0');
    expect(packageJson.devDependencies?.[NEST_CLI_PACKAGE_NAME]).toBe(
      '^10.0.0'
    );
  });

  it('overwrites existing managed dependency versions when forceVersions is true', async () => {
    updateJson(
      tree,
      'package.json',
      (json: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }) => ({
        ...json,
        dependencies: {
          ...(json.dependencies ?? {}),
          [NEST_COMMON_PACKAGE]: '^10.0.0',
          [NEST_CORE_PACKAGE]: '^10.0.0',
        },
        devDependencies: {
          ...(json.devDependencies ?? {}),
          [NEST_CLI_PACKAGE_NAME]: '^10.0.0',
        },
      })
    );

    await initGenerator(tree, { forceVersions: true });

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.[NEST_COMMON_PACKAGE]).toBe(
      nestRuntimeDependencies[NEST_COMMON_PACKAGE]
    );
    expect(packageJson.dependencies?.[NEST_CORE_PACKAGE]).toBe(
      nestRuntimeDependencies[NEST_CORE_PACKAGE]
    );
    expect(packageJson.devDependencies?.[NEST_CLI_PACKAGE_NAME]).toBe(
      nestDevDependencies[NEST_CLI_PACKAGE_NAME]
    );
  });

  it('does not add optional add-on dependencies', async () => {
    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencyKeys = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];

    expect(dependencyKeys).not.toEqual(
      expect.arrayContaining(['@nestjs/platform-fastify', 'zod', '@swc/core'])
    );
  });
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
