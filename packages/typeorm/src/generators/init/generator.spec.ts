import { readJson, Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import initGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

describe('initGenerator', () => {
  let tree: Tree;
  let formatSpy: jest.SpyInstance;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }
    tree = createTreeWithEmptyWorkspace();
    formatSpy = jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(async () => undefined);
  });

  afterEach(() => {
    formatSpy.mockRestore();
  });

  it('registers plugin and adds minimal dependencies', async () => {
    const task = await initGenerator(tree, { skipInstall: true });

    expect(typeof task).toBe('function');

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([{ plugin: '@anarchitects/nx-typeorm' }])
    );

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies.typeorm).toBe('^0.3.28');
    expect(packageJson.dependencies['reflect-metadata']).toBe('^0.2.2');
  });

  it('is idempotent for plugin registration', async () => {
    await initGenerator(tree, { skipInstall: true });
    await initGenerator(tree, { skipInstall: true });

    const nxJson = readJson(tree, 'nx.json');
    const entries = (nxJson.plugins ?? []).filter((entry: unknown) =>
      typeof entry === 'string'
        ? entry === '@anarchitects/nx-typeorm'
        : (entry as { plugin?: string }).plugin === '@anarchitects/nx-typeorm'
    );

    expect(entries).toHaveLength(1);
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
