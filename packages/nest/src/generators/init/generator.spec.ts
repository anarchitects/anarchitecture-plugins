import * as childProcess from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Tree } from '@nx/devkit';
import initGenerator, {
  initGenerator as namedInitGenerator,
} from './generator.js';

let createTreeWithEmptyWorkspace: (() => Tree) | undefined;

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

  it('runs against an Nx Tree without mutating workspace config or creating app files', async () => {
    const spawnSpy = jest.spyOn(childProcess, 'spawn');
    const packageJsonBefore = tree.read('package.json', 'utf-8');
    const nxJsonBefore = tree.read('nx.json', 'utf-8');

    await expect(initGenerator(tree, { skipFormat: true })).resolves.toBe(
      undefined
    );

    expect(tree.read('package.json', 'utf-8')).toBe(packageJsonBefore);
    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
    expect(tree.exists('demo-api/src/main.ts')).toBe(false);
    expect(tree.exists('demo-api/nest-cli.json')).toBe(false);
    expect(spawnSpy).not.toHaveBeenCalled();
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
});

beforeAll(async () => {
  const testing = await import('@nx/devkit/testing');
  createTreeWithEmptyWorkspace =
    testing.createTreeWithEmptyWorkspace as () => Tree;
});
