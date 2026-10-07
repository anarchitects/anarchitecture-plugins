// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { parse } from 'yaml';
import { planApplicationWorkspaceRegistration as plan } from './register-application-workspace';

describe('application package-manager workspace registration', () => {
  it.each(['npm', 'yarn', 'bun'])(
    'adds a custom root for %s without changing other manifest fields',
    (manager) => {
      const tree = createTreeWithEmptyWorkspace();
      const original = {
        name: 'workspace',
        private: true,
        packageManager: `${manager}@1.0.0`,
        scripts: { check: 'custom' },
        workspaces: ['libs/*'],
      };
      writeJson(tree, 'package.json', original);
      const before = tree.read('package.json');
      const commit = plan(tree, 'services/team/api', 'pnpm');
      expect(tree.read('package.json')).toEqual(before);
      commit();
      expect(readJson(tree, 'package.json')).toEqual({
        ...original,
        workspaces: ['libs/*', 'services/team/api'],
      });
      expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
      const after = tree.read('package.json');
      plan(tree, 'services/team/api')();
      expect(tree.read('package.json')).toEqual(after);
    }
  );

  it.each([
    ['packages/api'],
    ['packages/*'],
    ['packages/**'],
    ['./packages/*/'],
    ['{apps,packages}/*'],
    ['packages/*', '!packages/legacy'],
  ])('preserves matching declarations byte-for-byte: %j', (...patterns) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('package.json', JSON.stringify({ workspaces: patterns }));
    const before = tree.read('package.json');
    plan(tree, 'packages/api')();
    expect(tree.read('package.json')).toEqual(before);
  });

  it('preserves Yarn object-form declarations and nohoist policy', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      packageManager: 'yarn@1.22.22',
      workspaces: { packages: ['libs/*'], nohoist: ['**/native'] },
    });
    plan(tree, 'apps/api')();
    expect(readJson(tree, 'package.json').workspaces).toEqual({
      packages: ['libs/*', 'apps/api'],
      nohoist: ['**/native'],
    });
  });

  it.each(['pnpm-lock.yaml', 'pnpm-workspace.yaml'])(
    'detects pnpm from the pending Tree: %s',
    (file) => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(file, '');
      const manifest = tree.read('package.json');
      plan(tree, 'services/api', 'yarn')();
      expect(
        parse(tree.read('pnpm-workspace.yaml', 'utf8') ?? '').packages
      ).toEqual(['services/api']);
      expect(tree.read('package.json')).toEqual(manifest);
    }
  );

  it('creates pnpm configuration from a declared manager even without a lockfile', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      packageManager: 'pnpm@10.0.0',
      workspaces: ['legacy/*'],
    });
    plan(tree, 'apps/api')();
    expect(parse(tree.read('pnpm-workspace.yaml', 'utf8') ?? '')).toEqual({
      packages: ['apps/api'],
    });
    expect(readJson(tree, 'package.json').workspaces).toEqual(['legacy/*']);
  });

  it('preserves pnpm settings, comments, exclusions, and covered globs', () => {
    const tree = createTreeWithEmptyWorkspace();
    const initial =
      '# workspace settings\npackages:\n  - "libs/*" # keep libraries\n  - "!**/fixtures/**"\nhoistPattern: []\ncatalog:\n  rxjs: ^7.8.0\n';
    tree.write('pnpm-workspace.yaml', initial);
    plan(tree, 'libs/shared')();
    expect(tree.read('pnpm-workspace.yaml', 'utf8')).toBe(initial);
    plan(tree, 'services/api')();
    const after = tree.read('pnpm-workspace.yaml', 'utf8') ?? '';
    expect(parse(after)).toEqual({
      packages: ['libs/*', '!**/fixtures/**', 'services/api'],
      hoistPattern: [],
      catalog: { rxjs: '^7.8.0' },
    });
    expect(after).toContain('# workspace settings');
    expect(after).toContain('# keep libraries');
    plan(tree, 'services/api')();
    expect(tree.read('pnpm-workspace.yaml', 'utf8')).toBe(after);
  });

  it.each(['npm', 'pnpm'])(
    'rejects excluded destinations without changing %s policy',
    (manager) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'package.json', {
        packageManager: `${manager}@10.0.0`,
        workspaces: ['packages/*', '!packages/api'],
      });
      if (manager === 'pnpm')
        tree.write(
          'pnpm-workspace.yaml',
          'packages: ["packages/*", "!packages/api"]\n'
        );
      const before = tree.listChanges();
      expect(() => plan(tree, 'packages/api')).toThrow(/excluded/);
      expect(tree.listChanges()).toEqual(before);
    }
  );

  it.each(['packages: broken', 'packages: [', '- invalid-root'])(
    'rejects malformed pnpm configuration: %s',
    (source) => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write('pnpm-workspace.yaml', source);
      const before = tree.listChanges();
      expect(() => plan(tree, 'apps/api')).toThrow(/Cannot register/);
      expect(tree.listChanges()).toEqual(before);
    }
  );
});
