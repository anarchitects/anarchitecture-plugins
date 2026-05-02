import * as childProcess from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Tree } from '@nx/devkit';
import initGenerator, {
  initGenerator as namedInitGenerator,
} from './generator.js';

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
    {},
    { packageManager: 'yarn' as const },
    { packageManager: 'npm' as const },
    { packageManager: 'pnpm' as const },
  ])(
    'runs against an Nx Tree with options %j without mutating workspace config or creating app files',
    async (options) => {
      const spawnSpy = jest.spyOn(childProcess, 'spawn');
      const packageJsonBefore = tree.read('package.json', 'utf-8');
      const nxJsonBefore = tree.read('nx.json', 'utf-8');

      await expect(initGenerator(tree, options)).resolves.toBe(undefined);

      expect(tree.read('package.json', 'utf-8')).toBe(packageJsonBefore);
      expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
      expect(tree.exists('demo-api/src/main.ts')).toBe(false);
      expect(tree.exists('demo-api/nest-cli.json')).toBe(false);
      expect(spawnSpy).not.toHaveBeenCalled();
    }
  );

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

  it('does not mutate package.json or nx.json for schema-only options', async () => {
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
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
