import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { secondaryEntryPointGenerator } from './generator';

describe('secondaryEntryPointGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'my-lib', {
      root: 'packages/my-lib',
      sourceRoot: 'packages/my-lib/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          outputs: ['{options.outputPath}'],
          options: {
            outputPath: 'dist/packages/my-lib',
            main: 'packages/my-lib/src/index.ts',
            tsConfig: 'packages/my-lib/tsconfig.lib.json',
            generatePackageJson: true,
          },
        },
      },
    });

    tree.write(
      'packages/my-lib/package.json',
      JSON.stringify(
        {
          name: '@scope/my-lib',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        },
        null,
        2
      )
    );

    tree.write(
      'packages/my-lib/src/index.ts',
      `export const value = 'primary';\n`
    );
  });

  it('should configure additional entry points for the tsc executor', async () => {
    await secondaryEntryPointGenerator(tree, {
      project: 'my-lib',
      name: 'feature',
      skipFormat: true,
    });

    expectSecondaryEntryPointFiles(tree);
    assertAdditionalEntryPointConfigured(tree);
    assertNoPackageJsonMutation(tree);
  });

  it.each(['@nx/js:swc', '@nx/rollup:rollup', '@nx/esbuild:esbuild'])(
    'should configure additional entry points for the %s executor',
    async (executor) => {
      updateBuildExecutor(tree, executor);

      await secondaryEntryPointGenerator(tree, {
        project: 'my-lib',
        name: 'feature',
        skipFormat: true,
      });

      expectSecondaryEntryPointFiles(tree);
      assertAdditionalEntryPointConfigured(tree);
      assertNoPackageJsonMutation(tree);
    }
  );

  it('should update the Vite build entry map when executor is Vite', async () => {
    updateBuildExecutor(tree, '@nx/vite:build', {
      configFile: 'packages/my-lib/vite.config.ts',
    });

    tree.write(
      'packages/my-lib/vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
      },
    },
  },
});
`
    );

    await secondaryEntryPointGenerator(tree, {
      project: 'my-lib',
      name: 'feature',
      skipFormat: true,
    });

    expectSecondaryEntryPointFiles(tree);

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(
      projectConfig.targets?.build?.options?.additionalEntryPoints
    ).toBeUndefined();
    expect(
      projectConfig.targets?.build?.options?.generateExportsField
    ).toBeUndefined();

    const viteConfig = tree
      .read('packages/my-lib/vite.config.ts')
      ?.toString('utf-8');
    expect(viteConfig).toBeDefined();
    expect(viteConfig).toMatch(
      /['"]feature\/index['"]:\s*['"]src\/feature\/index\.ts['"]/
    );

    assertNoPackageJsonMutation(tree);
  });

  it('should normalize path segments', async () => {
    await secondaryEntryPointGenerator(tree, {
      project: 'my-lib',
      name: 'Data/Access',
      skipFormat: true,
    });

    expect(tree.exists('packages/my-lib/src/data/access/index.ts')).toBe(true);
    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(
      projectConfig.targets?.build?.options?.additionalEntryPoints
    ).toContain('packages/my-lib/src/data/access/index.ts');
  });

  it('should support rollup with inferred targets and no explicit build target', async () => {
    // Create a new project with rollup config but no explicit build target
    addProjectConfiguration(tree, 'rollup-lib', {
      root: 'packages/rollup-lib',
      sourceRoot: 'packages/rollup-lib/src',
      projectType: 'library',
      targets: {}, // Empty targets - relies on inference
    });

    tree.write(
      'packages/rollup-lib/package.json',
      JSON.stringify(
        {
          name: '@scope/rollup-lib',
          exports: { '.': { types: './dist/index.d.ts' } },
        },
        null,
        2
      )
    );

    tree.write(
      'packages/rollup-lib/src/index.ts',
      `export const value = 'primary';\n`
    );

    tree.write('packages/rollup-lib/rollup.config.js', 'export default {};');

    await secondaryEntryPointGenerator(tree, {
      project: 'rollup-lib',
      name: 'feature',
      skipFormat: true,
    });

    expect(tree.exists('packages/rollup-lib/src/feature/index.ts')).toBe(true);
    const projectConfig = readProjectConfiguration(tree, 'rollup-lib');
    expect(
      projectConfig.targets?.build?.options?.additionalEntryPoints
    ).toContain('packages/rollup-lib/src/feature/index.ts');
    expect(projectConfig.targets?.build?.options?.generateExportsField).toBe(
      true
    );
  });

  it('should support vite with inferred targets and no explicit build target', async () => {
    // Create a new project with vite config but no explicit build target
    addProjectConfiguration(tree, 'vite-lib', {
      root: 'packages/vite-lib',
      sourceRoot: 'packages/vite-lib/src',
      projectType: 'library',
      targets: {}, // Empty targets - relies on inference
    });

    tree.write(
      'packages/vite-lib/package.json',
      JSON.stringify(
        {
          name: '@scope/vite-lib',
          exports: { '.': { types: './dist/index.d.ts' } },
        },
        null,
        2
      )
    );

    tree.write(
      'packages/vite-lib/src/index.ts',
      `export const value = 'primary';\n`
    );

    tree.write(
      'packages/vite-lib/vite.config.ts',
      `import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
    },
  },
});
`
    );

    await secondaryEntryPointGenerator(tree, {
      project: 'vite-lib',
      name: 'feature',
      skipFormat: true,
    });

    expect(tree.exists('packages/vite-lib/src/feature/index.ts')).toBe(true);

    const viteConfig = tree
      .read('packages/vite-lib/vite.config.ts')
      ?.toString('utf-8');
    expect(viteConfig).toMatch(
      /['"]feature\/index['"]:\s*['"]src\/feature\/index\.ts['"]/
    );
  });
});

function updateBuildExecutor(
  tree: Tree,
  executor: string,
  optionOverrides: Record<string, unknown> = {}
) {
  const projectConfig = readProjectConfiguration(tree, 'my-lib');
  const buildTarget = projectConfig.targets?.build;
  if (!buildTarget) {
    throw new Error('Expected build target to exist for project "my-lib".');
  }

  projectConfig.targets = {
    ...projectConfig.targets,
    build: {
      ...buildTarget,
      executor,
      options: {
        ...(buildTarget.options ?? {}),
        ...optionOverrides,
      },
    },
  };

  updateProjectConfiguration(tree, 'my-lib', projectConfig);
}

function expectSecondaryEntryPointFiles(tree: Tree) {
  expect(tree.exists('packages/my-lib/src/feature/index.ts')).toBe(true);
  expect(tree.exists('packages/my-lib/src/feature/lib/feature.ts')).toBe(true);
}

function assertAdditionalEntryPointConfigured(tree: Tree) {
  const projectConfig = readProjectConfiguration(tree, 'my-lib');
  expect(
    projectConfig.targets?.build?.options?.additionalEntryPoints
  ).toContain('packages/my-lib/src/feature/index.ts');
  expect(projectConfig.targets?.build?.options?.generateExportsField).toBe(
    true
  );
}

function assertNoPackageJsonMutation(tree: Tree) {
  const packageJson = readJson(tree, 'packages/my-lib/package.json');
  expect(packageJson.exports['./feature']).toBeUndefined();
}
