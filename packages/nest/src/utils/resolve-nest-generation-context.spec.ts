// SPDX-License-Identifier: MIT
import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { snapshotNxTree } from '../generation-adapter/tree-snapshot';
import {
  nestGenerationDefaults,
  resolveNestGenerationContext,
} from './resolve-nest-generation-context';

function library(tree: Tree, root = 'libs/users', name = 'users') {
  writeJson(tree, `${root}/project.json`, {
    name,
    projectType: 'library',
    sourceRoot: `${root}/src`,
    metadata: { nest: { kind: 'nx-library' } },
  });
  writeJson(tree, `${root}/package.json`, {
    name: '@acme/users',
    type: 'module',
    dependencies: { '@nestjs/common': '^12.0.1' },
  });
}

function owner(tree: Tree, root = 'apps/api', name = 'api') {
  const prefix = root === '.' ? '' : `${root}/`;
  writeJson(tree, `${prefix}project.json`, { name });
  writeJson(tree, `${prefix}package.json`, { name, type: 'commonjs' });
  writeJson(tree, `${prefix}nest-cli.json`, {
    sourceRoot: 'apps/api/src',
    language: 'js',
    generateOptions: { spec: { service: false }, specFileSuffix: 'unit' },
    projects: {
      shared: {
        root: 'libs/shared',
        sourceRoot: 'libs/shared/src',
        generateOptions: { flat: true },
      },
    },
  });
  writeJson(tree, `${prefix}libs/shared/project.json`, {
    name: `${name}-shared`,
    projectType: 'library',
    sourceRoot: `${prefix}libs/shared/src`,
  });
}

describe('Nest generation context', () => {
  it.each(['apps/api', '.'])(
    'distinguishes native owners and members at %s and retains native defaults',
    (root) => {
      const tree = createTreeWithEmptyWorkspace();
      owner(tree, root);
      const before = snapshotNxTree(tree);
      const selectedOwner = resolveNestGenerationContext(tree, {
        project: 'api',
      });
      expect(selectedOwner).toMatchObject({
        kind: 'native-owner',
        ownerRoot: root,
      });
      expect(resolveNestGenerationContext(tree, {})).toEqual(selectedOwner);
      const member = resolveNestGenerationContext(tree, {
        project: 'api-shared',
      });
      expect(member).toMatchObject({
        kind: 'native-member',
        ownerRoot: root,
        nestProject: 'shared',
        member: { root: 'libs/shared', sourceRoot: 'libs/shared/src' },
      });
      expect(
        resolveNestGenerationContext(tree, {
          project: 'api',
          nestProject: 'shared',
        })
      ).toEqual(member);
      expect(
        resolveNestGenerationContext(tree, {
          project: 'api-shared',
          nestProject: 'shared',
        })
      ).toEqual(member);
      if (member.kind !== 'native-member')
        throw new Error('Expected a native member');
      expect(
        nestGenerationDefaults(member.config, member.member, {}, 'service', {
          flat: false,
          spec: true,
          specFileSuffix: 'spec',
          language: 'ts',
        })
      ).toEqual({
        sourceRoot: 'libs/shared/src',
        flat: true,
        spec: false,
        specFileSuffix: 'unit',
        language: 'js',
      });
      expect(() =>
        resolveNestGenerationContext(tree, {
          project: 'api-shared',
          nestProject: 'other',
        })
      ).toThrow('conflicts');
      expect(() =>
        resolveNestGenerationContext(tree, {
          project: 'api',
          nestProject: 'missing',
        })
      ).toThrow('does not exist');
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it.each(['module', 'commonjs', undefined])(
    'resolves an explicitly marked library using its own package type %s',
    (type) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, 'package.json', {
        name: 'workspace',
        type: type === 'module' ? 'commonjs' : 'module',
      });
      const packageJson = {
        ...readJson(tree, 'libs/users/package.json'),
        type,
      };
      writeJson(tree, 'libs/users/package.json', packageJson);
      const before = snapshotNxTree(tree);
      expect(resolveNestGenerationContext(tree, { project: 'users' })).toEqual({
        kind: 'nx-library',
        projectName: 'users',
        projectRoot: 'libs/users',
        sourceRoot: 'libs/users/src',
        relativeSourceRoot: 'src',
        packageJsonPath: 'libs/users/package.json',
        packageJson,
        moduleSystem: type === 'module' ? 'esm' : 'cjs',
        language: 'ts',
      });
      expect(snapshotNxTree(tree)).toEqual(before);
      expect(tree.exists('libs/users/nest-cli.json')).toBe(false);
      expect(tree.exists('nest-cli.json')).toBe(false);
    }
  );

  it.each(['libs/users', './libs/users/source/', 'libs\\users\\source'])(
    'scopes sourceRoot=%s to the selected library',
    (sourceRoot) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, 'libs/users/project.json', {
        ...readJson(tree, 'libs/users/project.json'),
        sourceRoot,
      });
      const context = resolveNestGenerationContext(tree, { project: 'users' });
      expect(context).toMatchObject({
        sourceRoot:
          sourceRoot === 'libs/users' ? 'libs/users' : 'libs/users/source',
        relativeSourceRoot: sourceRoot === 'libs/users' ? '.' : 'source',
      });
    }
  );

  it.each([
    'libs/other/src',
    'libs/users-other/src',
    '../outside',
    'libs/users/../other',
    '/absolute',
    'C:\\outside',
    'libs/users/node_modules/src',
  ])(
    'rejects a source root outside the selected project or runtime state: %s',
    (sourceRoot) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, 'libs/users/project.json', {
        ...readJson(tree, 'libs/users/project.json'),
        sourceRoot,
      });
      const before = snapshotNxTree(tree);
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toThrow();
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it.each(['', 'shared'])(
    'rejects --nestProject=%s for Nx-native libraries',
    (nestProject) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users', nestProject })
      ).toThrow('--nestProject is only valid');
    }
  );

  it.each(['apps/api', '.'])(
    'resolves a mixed workspace independently of native owner at %s',
    (root) => {
      const tree = createTreeWithEmptyWorkspace();
      owner(tree, root);
      library(tree);
      library(tree, 'libs/other', '@acme/other');
      const before = snapshotNxTree(tree);
      expect(
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toMatchObject({
        kind: 'nx-library',
        relativeSourceRoot: 'src',
        moduleSystem: 'esm',
        language: 'ts',
      });
      expect(
        resolveNestGenerationContext(tree, { project: '@acme/other' })
      ).toMatchObject({ kind: 'nx-library', projectRoot: 'libs/other' });
      expect(
        resolveNestGenerationContext(tree, { project: 'api-shared' }).kind
      ).toBe('native-member');
      expect(resolveNestGenerationContext(tree, {}).kind).toBe('native-owner');
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it('does not apply unrelated native path validation or generation defaults to a library', () => {
    const tree = createTreeWithEmptyWorkspace();
    owner(tree, '.');
    library(tree);
    writeJson(tree, 'nest-cli.json', {
      language: 'js',
      sourceRoot: '../external',
      generateOptions: { baseDir: '../external', spec: false },
      projects: {
        external: { root: '../external', sourceRoot: '../external/src' },
      },
    });
    expect(
      resolveNestGenerationContext(tree, { project: 'users' })
    ).toMatchObject({
      kind: 'nx-library',
      relativeSourceRoot: 'src',
      language: 'ts',
    });
  });

  it('retains root owner fallback without a root Nx project registration', () => {
    const tree = createTreeWithEmptyWorkspace();
    owner(tree, '.');
    tree.delete('project.json');
    expect(
      resolveNestGenerationContext(tree, { project: 'api' })
    ).toMatchObject({ kind: 'native-owner', ownerRoot: '.' });
  });

  it('requires explicit selection among multiple owners, or when only libraries exist', () => {
    const tree = createTreeWithEmptyWorkspace();
    library(tree);
    expect(() => resolveNestGenerationContext(tree, {})).toThrow(
      'Select an Nx Nest project'
    );
    owner(tree);
    owner(tree, 'apps/second', 'second');
    expect(() => resolveNestGenerationContext(tree, {})).toThrow(
      'Select an Nx Nest project'
    );
    expect(resolveNestGenerationContext(tree, { project: 'users' }).kind).toBe(
      'nx-library'
    );
    expect(
      resolveNestGenerationContext(tree, { project: 'second' })
    ).toMatchObject({ kind: 'native-owner', ownerRoot: 'apps/second' });
    expect(() =>
      resolveNestGenerationContext(tree, { project: 'missing' })
    ).toThrow('Select an Nx Nest project');
  });

  it.each([undefined, { technologies: ['nest'] }, { nest: { kind: 'other' } }])(
    'does not identify ordinary libraries from dependencies or technology tags: %j',
    (metadata) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, 'libs/users/project.json', {
        ...readJson(tree, 'libs/users/project.json'),
        metadata,
      });
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toThrow('does not belong');
      owner(tree, '.');
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toThrow('not a member');
    }
  );

  it.each(['application', undefined])(
    'rejects a marked project with projectType=%s',
    (projectType) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, 'libs/users/project.json', {
        ...readJson(tree, 'libs/users/project.json'),
        projectType,
      });
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toThrow('must be a library');
    }
  );

  it('requires a declared source root and a local package rather than inheriting the workspace package', () => {
    const tree = createTreeWithEmptyWorkspace();
    library(tree);
    writeJson(tree, 'libs/users/project.json', {
      ...readJson(tree, 'libs/users/project.json'),
      sourceRoot: undefined,
    });
    expect(() =>
      resolveNestGenerationContext(tree, { project: 'users' })
    ).toThrow('sourceRoot');
    library(tree);
    tree.delete('libs/users/package.json');
    expect(() =>
      resolveNestGenerationContext(tree, { project: 'users' })
    ).toThrow('must contain package.json');
  });

  it.each([
    {},
    { name: '' },
    { name: 42 },
    { name: 'users', type: 'esm' },
    null,
  ])('rejects invalid library package metadata: %j', (manifest) => {
    const tree = createTreeWithEmptyWorkspace();
    library(tree);
    tree.write('libs/users/package.json', JSON.stringify(manifest));
    expect(() =>
      resolveNestGenerationContext(tree, { project: 'users' })
    ).toThrow('invalid package name or module type');
  });

  it.each(['nest-cli.json', 'nest.json'])(
    'rejects a library also containing %s',
    (file) => {
      const tree = createTreeWithEmptyWorkspace();
      library(tree);
      writeJson(tree, `libs/users/${file}`, { sourceRoot: 'src' });
      expect(() =>
        resolveNestGenerationContext(tree, { project: 'users' })
      ).toThrow(/conflicting|must not contain/);
    }
  );

  it('rejects conflicting library/member identity even when selected via its Nx name', () => {
    const tree = createTreeWithEmptyWorkspace();
    owner(tree, '.');
    library(tree, 'libs/shared', 'api-shared');
    expect(() =>
      resolveNestGenerationContext(tree, { project: 'api-shared' })
    ).toThrow('conflicting native Nest and nx-library ownership');
  });
});
