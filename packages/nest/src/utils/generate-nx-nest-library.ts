// SPDX-License-Identifier: MIT
import {
  getProjects,
  names,
  readJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { posix } from 'node:path';
import { additiveTransform } from '../generation-adapter/additive-transform';
import { runIsolatedSchematic } from '../generation-adapter/run-isolated-schematic';
import {
  applySnapshot,
  snapshotNxTree,
  treePath,
  type TreeSnapshot,
} from '../generation-adapter/tree-snapshot';
import type { LibraryGeneratorSchema } from '../generators/library/schema';
import { installAfterGeneration } from './dependency-install';
import { planPackageWorkspaceRegistration } from './register-package-workspace';

const libraryDependencies = {
  '@nestjs/common': '^12.0.1',
  'reflect-metadata': '^0.2.2',
  rxjs: '^7.8.1',
};

function libraryIdentity(name: string) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('A non-empty Nx-native Nest library name is required.');
  }
  const parts = name.trim().split('/');
  if (parts.length > 2 || (parts.length === 2 && !parts[0].startsWith('@'))) {
    throw new Error(
      'Use a library package name such as users or @acme/users; select its location with --directory.'
    );
  }
  const moduleName = names(parts[parts.length - 1]).fileName;
  const scope =
    parts.length === 2 ? names(parts[0].slice(1)).fileName : undefined;
  if (
    !/^[a-z][a-z0-9-]*$/.test(moduleName) ||
    (scope !== undefined && !/^[a-z0-9][a-z0-9._-]*$/.test(scope))
  ) {
    throw new Error(
      'Use a library name that normalizes to a letter followed by letters, digits, or hyphens, optionally prefixed with an npm scope.'
    );
  }
  return { name: scope ? `@${scope}/${moduleName}` : moduleName, moduleName };
}

function assertAvailable(tree: Tree, name: string, root: string): void {
  const projects = getProjects(tree);
  if (readJson(tree, 'package.json').name === name) {
    throw new Error(`Package "${name}" already exists at the workspace root.`);
  }
  for (const [projectName, project] of projects) {
    const manifest = posix.join(project.root, 'package.json');
    if (
      projectName === name ||
      (tree.exists(manifest) && readJson(tree, manifest).name === name)
    ) {
      throw new Error(
        `Nx project or package "${name}" already exists at "${project.root}".`
      );
    }
    const existingRoot = posix.normalize(project.root).replace(/\/$/, '');
    if (
      existingRoot !== '.' &&
      (root === existingRoot ||
        root.startsWith(`${existingRoot}/`) ||
        existingRoot.startsWith(`${root}/`))
    ) {
      throw new Error(
        `Directory "${root}" overlaps Nx project "${projectName}" at "${project.root}". Choose an independent library directory.`
      );
    }
  }
  if (tree.isFile(root) || tree.children(root).length) {
    throw new Error(
      `Directory "${root}" already contains files. Choose an empty directory for the new library.`
    );
  }
  // Also protect package roots that aren't currently included in Nx discovery.
  for (
    let parent = posix.dirname(root);
    parent !== '.';
    parent = posix.dirname(parent)
  ) {
    if (
      tree.isFile(parent) ||
      ['package.json', 'project.json', 'nest-cli.json', 'nest.json'].some(
        (file) => tree.exists(`${parent}/${file}`)
      )
    ) {
      throw new Error(
        `Directory "${root}" is inside an existing project/package at "${parent}". Choose an independent library directory.`
      );
    }
  }
}

/** Create only the independent container; workspace TypeScript linking is separate. */
export async function generateNxNestLibrary(
  tree: Tree,
  options: LibraryGeneratorSchema,
  directory: string
): Promise<GeneratorCallback | undefined> {
  if (!tree.exists('nx.json') || !tree.exists('package.json')) {
    throw new Error(
      'Generate the Nx-native Nest library inside an existing Nx workspace.'
    );
  }
  const { name, moduleName } = libraryIdentity(options.name);
  if (Object.hasOwn(libraryDependencies, name)) {
    throw new Error(
      `Package name "${name}" conflicts with a required Nest runtime dependency.`
    );
  }
  const root = treePath(directory).replace(/\/$/, '');
  if (options.language !== undefined && options.language !== 'ts') {
    throw new Error(
      'Nx-native Nest libraries currently support --language=ts.'
    );
  }
  assertAvailable(tree, name, root);
  const registerWorkspace = planPackageWorkspaceRegistration(tree, root);
  const before = snapshotNxTree(tree);
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  // Source-only package entrypoints follow the Nx 23.2 library convention.
  // The package owns its framework dependencies; root compiler/tooling policy
  // and other projects' Nest CLI configuration are not generation inputs.
  const initial: TreeSnapshot = new Map([
    [
      'package.json',
      Buffer.from(
        json({
          name,
          version: '0.0.0',
          private: true,
          type: 'module',
          main: './src/index.ts',
          types: './src/index.ts',
          exports: {
            '.': {
              types: './src/index.ts',
              import: './src/index.ts',
              default: './src/index.ts',
            },
            './package.json': './package.json',
          },
          dependencies: libraryDependencies,
        })
      ),
    ],
  ]);
  const result = await runIsolatedSchematic(initial, {
    schematic: 'module',
    options: {
      name: moduleName,
      sourceRoot: 'src',
      flat: true,
      skipImport: true,
      language: 'ts',
      format: options.format,
    },
  });
  const guard = additiveTransform(result.after);
  guard.addJsonProperties('project.json', {
    name,
    projectType: 'library',
    sourceRoot: `${root}/src`,
    metadata: { nest: { kind: 'nx-library' } },
  });
  guard.createFile(
    'src/index.ts',
    `export * from './${moduleName}.module.js';\n`
  );
  guard.createFile(
    'tsconfig.json',
    json({
      compilerOptions: {
        target: 'ES2023',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        skipLibCheck: true,
      },
      files: [],
      include: [],
      references: [{ path: './tsconfig.lib.json' }],
    })
  );
  guard.createFile(
    'tsconfig.lib.json',
    json({
      extends: './tsconfig.json',
      compilerOptions: {
        rootDir: 'src',
        outDir: 'dist',
        composite: true,
        declaration: true,
        tsBuildInfoFile: 'dist/tsconfig.lib.tsbuildinfo',
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    })
  );
  const after = new Map(before);
  for (const [file, content] of result.after)
    after.set(`${root}/${treePath(file)}`, Buffer.from(content));
  applySnapshot(tree, before, after);
  registerWorkspace();
  // A new package always needs its dependencies installed and workspace link created.
  return installAfterGeneration(tree, options.skipInstall, true);
}
