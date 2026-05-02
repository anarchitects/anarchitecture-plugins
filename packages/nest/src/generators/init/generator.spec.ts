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
  NEST_TESTING_PACKAGE,
  ANARCHITECTS_NEST_PLUGIN_PACKAGE,
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

      await expect(
        initGenerator(tree, {
          ...options,
          skipPackageJson: true,
        })
      ).resolves.toBe(undefined);

      const nxJson = readJson(tree, 'nx.json') as {
        plugins?: Array<string | { plugin: string }>;
      };

      expect(nxJson.plugins).toEqual(
        expect.arrayContaining([ANARCHITECTS_NEST_PLUGIN_PACKAGE])
      );
      expect(tree.exists('demo-api/src/main.ts')).toBe(false);
      expect(tree.exists('demo-api/nest-cli.json')).toBe(false);
      expect(spawnSpy).not.toHaveBeenCalled();
    }
  );

  it('adds Nest base runtime and dev dependencies by default', async () => {
    const spawnSpy = jest.spyOn(childProcess, 'spawn');

    await expect(initGenerator(tree, {})).resolves.toBe(undefined);

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin: string }>;
    };

    expect(packageJson.dependencies).toEqual(
      expect.objectContaining(nestRuntimeDependencies)
    );
    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining(nestDevDependencies)
    );
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([ANARCHITECTS_NEST_PLUGIN_PACKAGE])
    );
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

    await expect(
      initGenerator(tree, {
        packageManager: 'yarn',
        skipPackageJson: true,
        skipFormat: true,
        forceVersions: true,
      })
    ).resolves.toBe(undefined);

    expect(tree.read('package.json', 'utf-8')).toBe(packageJsonBefore);
    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin: string }>;
    };
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([ANARCHITECTS_NEST_PLUGIN_PACKAGE])
    );
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('is idempotent when run twice', async () => {
    await initGenerator(tree, {});
    const firstPackageJson = tree.read('package.json', 'utf-8');
    const firstNxJson = tree.read('nx.json', 'utf-8');

    await initGenerator(tree, {});

    expect(tree.read('package.json', 'utf-8')).toBe(firstPackageJson);
    expect(tree.read('nx.json', 'utf-8')).toBe(firstNxJson);
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

  it('preserves existing managed dependency sections and avoids cross-section duplicates', async () => {
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
          [NEST_TESTING_PACKAGE]: '^10.0.0',
        },
        devDependencies: {
          ...(json.devDependencies ?? {}),
          [NEST_COMMON_PACKAGE]: '^10.0.0',
        },
      })
    );

    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.[NEST_COMMON_PACKAGE]).toBe('^10.0.0');
    expect(packageJson.dependencies?.[NEST_COMMON_PACKAGE]).toBeUndefined();
    expect(packageJson.dependencies?.[NEST_TESTING_PACKAGE]).toBe('^10.0.0');
    expect(packageJson.devDependencies?.[NEST_TESTING_PACKAGE]).toBeUndefined();
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

  it('forceVersions updates managed packages without altering unrelated dependencies', async () => {
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
          lodash: '^4.17.0',
        },
        devDependencies: {
          ...(json.devDependencies ?? {}),
          [NEST_CLI_PACKAGE_NAME]: '^10.0.0',
          vitest: '^1.0.0',
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
    expect(packageJson.devDependencies?.[NEST_CLI_PACKAGE_NAME]).toBe(
      nestDevDependencies[NEST_CLI_PACKAGE_NAME]
    );
    expect(packageJson.dependencies?.lodash).toBe('^4.17.0');
    expect(packageJson.devDependencies?.vitest).toBe('^1.0.0');
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

  it('adds a plugins array when nx.json has no plugins field', async () => {
    updateJson(tree, 'nx.json', (json: Record<string, unknown>) => {
      const rest = { ...json };
      delete rest.plugins;
      return {
        ...rest,
        analytics: true,
      };
    });

    await initGenerator(tree, { skipPackageJson: true });

    const nxJson = readJson(tree, 'nx.json') as {
      analytics?: boolean;
      plugins?: Array<string | { plugin: string }>;
    };

    expect(nxJson.analytics).toBe(true);
    expect(nxJson.plugins).toEqual([ANARCHITECTS_NEST_PLUGIN_PACKAGE]);
  });

  it('appends the Nest plugin when unrelated plugins exist', async () => {
    updateJson(tree, 'nx.json', (json: Record<string, unknown>) => ({
      ...json,
      plugins: ['@nx/jest/plugin'],
    }));

    await initGenerator(tree, { skipPackageJson: true });

    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin: string }>;
    };

    expect(nxJson.plugins).toEqual([
      '@nx/jest/plugin',
      ANARCHITECTS_NEST_PLUGIN_PACKAGE,
    ]);
  });

  it('does not duplicate string-form plugin registration', async () => {
    updateJson(tree, 'nx.json', (json: Record<string, unknown>) => ({
      ...json,
      plugins: [ANARCHITECTS_NEST_PLUGIN_PACKAGE],
    }));

    await initGenerator(tree, { skipPackageJson: true });

    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin: string }>;
    };

    expect(nxJson.plugins).toEqual([ANARCHITECTS_NEST_PLUGIN_PACKAGE]);
  });

  it('does not duplicate object-form plugin registration', async () => {
    updateJson(tree, 'nx.json', (json: Record<string, unknown>) => ({
      ...json,
      plugins: [{ plugin: ANARCHITECTS_NEST_PLUGIN_PACKAGE }],
    }));

    await initGenerator(tree, { skipPackageJson: true });

    const nxJson = readJson(tree, 'nx.json') as {
      plugins?: Array<string | { plugin: string }>;
    };

    expect(nxJson.plugins).toEqual([
      { plugin: ANARCHITECTS_NEST_PLUGIN_PACKAGE },
    ]);
  });

  it('preserves existing nx.json fields when registering the plugin', async () => {
    updateJson(tree, 'nx.json', (json: Record<string, unknown>) => ({
      ...json,
      namedInputs: {
        default: ['{projectRoot}/**/*'],
      },
      targetDefaults: {
        build: {
          cache: true,
        },
      },
    }));

    await initGenerator(tree, { skipPackageJson: true });

    const nxJson = readJson(tree, 'nx.json') as {
      namedInputs?: Record<string, unknown>;
      targetDefaults?: Record<string, unknown>;
      plugins?: Array<string | { plugin: string }>;
    };

    expect(nxJson.namedInputs).toEqual({
      default: ['{projectRoot}/**/*'],
    });
    expect(nxJson.targetDefaults).toEqual({
      build: {
        cache: true,
      },
    });
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([ANARCHITECTS_NEST_PLUGIN_PACKAGE])
    );
  });
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
