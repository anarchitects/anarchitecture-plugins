import { readJson, Tree } from '@nx/devkit';

import addExtensionGenerator from './generator.js';

let createTreeWithEmptyWorkspace:
  | typeof import('nx/src/devkit-testing-exports')['createTreeWithEmptyWorkspace']
  | undefined;

describe('addExtensionGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  it('creates governance.extensions in a minimal nx.json', async () => {
    tree.write('nx.json', '{}\n');

    await addExtensionGenerator(tree, {
      package: '@anarchitects/governance-extension-angular',
      skipFormat: true,
    });

    expect(readJson(tree, 'nx.json')).toEqual({
      governance: {
        extensions: [
          {
            package: '@anarchitects/governance-extension-angular',
            optional: true,
          },
        ],
      },
    });
  });

  it('appends extensions while preserving existing entries', async () => {
    tree.write(
      'nx.json',
      `${JSON.stringify(
        {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-typescript',
                optional: false,
              },
            ],
          },
        },
        null,
        2
      )}\n`
    );

    await addExtensionGenerator(tree, {
      package: '@anarchitects/governance-extension-angular',
      optional: true,
      skipFormat: true,
    });

    expect(
      readJson(tree, 'nx.json').governance.extensions.map(
        (entry: { package: string }) => entry.package
      )
    ).toEqual([
      '@anarchitects/governance-extension-typescript',
      '@anarchitects/governance-extension-angular',
    ]);
  });

  it('does not duplicate an existing package entry', async () => {
    tree.write(
      'nx.json',
      `${JSON.stringify(
        {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
                optional: false,
              },
            ],
          },
        },
        null,
        2
      )}\n`
    );

    await addExtensionGenerator(tree, {
      package: '@anarchitects/governance-extension-angular',
      skipFormat: true,
    });

    expect(readJson(tree, 'nx.json').governance.extensions).toEqual([
      {
        package: '@anarchitects/governance-extension-angular',
        optional: false,
      },
    ]);
  });

  it('updates the optional flag only when explicitly passed', async () => {
    tree.write(
      'nx.json',
      `${JSON.stringify(
        {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
                optional: true,
              },
            ],
          },
        },
        null,
        2
      )}\n`
    );

    await addExtensionGenerator(tree, {
      package: '@anarchitects/governance-extension-angular',
      optional: false,
      skipFormat: true,
    });

    expect(readJson(tree, 'nx.json').governance.extensions).toEqual([
      {
        package: '@anarchitects/governance-extension-angular',
        optional: false,
      },
    ]);
  });

  it('rejects an empty package name', async () => {
    await expect(
      addExtensionGenerator(tree, {
        package: '   ',
        skipFormat: true,
      })
    ).rejects.toThrow(
      'Governance extension package must be a non-empty string.'
    );
  });

  it('preserves unrelated nx.json fields', async () => {
    tree.write(
      'nx.json',
      `${JSON.stringify(
        {
          plugins: ['@nx/jest/plugin'],
          targetDefaults: {
            build: {
              dependsOn: ['^build'],
            },
          },
          governance: {
            mode: 'legacy',
          },
        },
        null,
        2
      )}\n`
    );

    await addExtensionGenerator(tree, {
      package: '@anarchitects/governance-extension-angular',
      skipFormat: true,
    });

    expect(readJson(tree, 'nx.json')).toEqual({
      plugins: ['@nx/jest/plugin'],
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
        },
      },
      governance: {
        mode: 'legacy',
        extensions: [
          {
            package: '@anarchitects/governance-extension-angular',
            optional: true,
          },
        ],
      },
    });
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import(
    'nx/src/devkit-testing-exports'
  ));
});
