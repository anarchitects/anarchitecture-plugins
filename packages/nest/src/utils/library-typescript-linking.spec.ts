// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { snapshotNxTree } from '../generation-adapter/tree-snapshot';
import { planLibraryTypeScriptLinking } from './library-typescript-linking';

describe('Nx-native library TypeScript linking', () => {
  it.each([{ references: undefined }, { references: [] }])(
    'recognizes an empty solution with references=$references',
    ({ references }) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          module: 'preserve',
          moduleResolution: 'bundler',
        },
        angularCompilerOptions: { strictTemplates: true },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references,
      });
      const base = tree.read('tsconfig.base.json');
      const before = snapshotNxTree(tree);
      const plan = planLibraryTypeScriptLinking(
        tree,
        '@acme/users',
        'libs/users'
      );
      expect(plan.mode).toBe('references');
      expect(snapshotNxTree(tree)).toEqual(before);
      expect(plan.tsconfig.extends).toBe('../../tsconfig.base.json');
      expect(plan.tsconfig.compilerOptions).toMatchObject({
        module: 'NodeNext',
        experimentalDecorators: true,
      });
      expect(plan.tsconfigLib.compilerOptions).toMatchObject({
        rootDir: 'src',
        composite: true,
      });
      expect(plan.tsconfigLib.references).toEqual([]);
      plan.commit();
      expect(readJson(tree, 'tsconfig.json').references).toEqual([
        { path: './libs/users' },
      ]);
      expect(tree.read('tsconfig.base.json')).toEqual(base);
      const after = snapshotNxTree(tree);
      planLibraryTypeScriptLinking(tree, '@acme/users', 'libs/users').commit();
      expect(snapshotNxTree(tree)).toEqual(after);
    }
  );

  it.each([
    'libs/users',
    './libs/users/',
    './libs/users/tsconfig.json',
    './libs/users/tsconfig.lib.json',
  ])(
    'preserves existing references and recognizes %s without duplicates',
    (path) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'tsconfig.json', {
        files: [],
        references: [{ path: './libs/contracts', prepend: false }, { path }],
      });
      const before = snapshotNxTree(tree);
      planLibraryTypeScriptLinking(tree, 'users', 'libs/users').commit();
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it('prefers existing solution references over paths without rewriting either compiler policy', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        paths: { contracts: ['libs/contracts/src/index.ts'] },
      },
    });
    writeJson(tree, 'tsconfig.json', {
      files: [],
      references: [{ path: './libs/contracts' }],
      angularCompilerOptions: { strictTemplates: true },
    });
    const base = tree.read('tsconfig.base.json');
    const plan = planLibraryTypeScriptLinking(tree, 'users', 'libs/users');
    expect(plan.mode).toBe('references');
    plan.commit();
    expect(tree.read('tsconfig.base.json')).toEqual(base);
    expect(readJson(tree, 'tsconfig.json')).toMatchObject({
      references: [{ path: './libs/contracts' }, { path: './libs/users' }],
      angularCompilerOptions: { strictTemplates: true },
    });
  });

  it.each([undefined, '.', './config'])(
    'adds only the legacy alias relative to baseUrl=%s',
    (baseUrl) => {
      const tree = createTreeWithEmptyWorkspace();
      const config = {
        compilerOptions: {
          baseUrl,
          paths: { contracts: ['existing.ts'] },
          module: 'preserve',
          moduleResolution: 'bundler',
          strict: false,
        },
        angularCompilerOptions: { strictTemplates: true },
      };
      writeJson(tree, 'tsconfig.base.json', config);
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        include: ['apps/**/*.ts'],
      });
      const root = tree.read('tsconfig.json');
      const plan = planLibraryTypeScriptLinking(
        tree,
        '@acme/users',
        'libs/users'
      );
      expect(plan.mode).toBe('paths');
      expect(plan.tsconfig.extends).toBe('../../tsconfig.base.json');
      expect(plan.tsconfigLib.compilerOptions).toMatchObject({
        rootDir: '../..',
        composite: false,
      });
      plan.commit();
      expect(readJson(tree, 'tsconfig.base.json')).toEqual({
        ...config,
        compilerOptions: {
          ...config.compilerOptions,
          paths: {
            ...config.compilerOptions.paths,
            '@acme/users': [
              baseUrl === './config'
                ? '../libs/users/src/index.ts'
                : baseUrl === undefined
                ? './libs/users/src/index.ts'
                : 'libs/users/src/index.ts',
            ],
          },
        },
      });
      expect(tree.read('tsconfig.json')).toEqual(root);
      const before = snapshotNxTree(tree);
      planLibraryTypeScriptLinking(tree, '@acme/users', 'libs/users').commit();
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it('rejects alias collisions without staging changes', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { paths: { users: ['existing/index.ts'] } },
    });
    const before = snapshotNxTree(tree);
    expect(() =>
      planLibraryTypeScriptLinking(tree, 'users', 'libs/users')
    ).toThrow('already exists');
    expect(snapshotNxTree(tree)).toEqual(before);
  });

  it.each([{ references: null }, { references: {} }, { references: [{}] }])(
    'rejects malformed solution references: $references',
    ({ references }) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'tsconfig.json', { files: [], references });
      const before = snapshotNxTree(tree);
      expect(() =>
        planLibraryTypeScriptLinking(tree, 'users', 'libs/users')
      ).toThrow('invalid tsconfig.json references');
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );

  it('retains an equivalent predeclared alias byte-for-byte', () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'tsconfig.base.json',
      '{ // consumer comment\n "compilerOptions": { "paths": { "users": ["./libs/users/src/index.ts"] } } }'
    );
    const before = snapshotNxTree(tree);
    planLibraryTypeScriptLinking(tree, 'users', 'libs/users').commit();
    expect(snapshotNxTree(tree)).toEqual(before);
  });

  it.each([null, [], 'invalid'])('rejects malformed paths: %s', (paths) => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', { compilerOptions: { paths } });
    expect(() =>
      planLibraryTypeScriptLinking(tree, 'users', 'libs/users')
    ).toThrow('invalid');
  });

  it.each([false, true])(
    'does not invent root linking for a standalone config (base=%s)',
    (base) => {
      const tree = createTreeWithEmptyWorkspace();
      tree.delete('tsconfig.base.json');
      if (base)
        writeJson(tree, 'tsconfig.base.json', {
          compilerOptions: { module: 'preserve' },
        });
      const before = snapshotNxTree(tree);
      const plan = planLibraryTypeScriptLinking(tree, 'users', 'libs/users');
      expect(plan.mode).toBe('standalone');
      expect(plan.tsconfig.extends).toBeUndefined();
      plan.commit();
      expect(snapshotNxTree(tree)).toEqual(before);
    }
  );
});
