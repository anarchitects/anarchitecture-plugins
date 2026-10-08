// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { parse } from 'yaml';
import { planPackageWorkspaceRegistration as plan } from './register-package-workspace';

describe('generated package-manager workspace registration', () => {
  it.each(['npm', 'yarn', 'bun', 'pnpm'])(
    'registers an independent library for %s only after committing the plan',
    (manager) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'package.json', {
        packageManager: `${manager}@1.0.0`,
        workspaces: ['apps/*'],
      });
      if (manager === 'pnpm')
        tree.write(
          'pnpm-workspace.yaml',
          'packages: ["apps/*"]\nhoistPattern: []\n'
        );
      const before = tree.listChanges();
      const commit = plan(tree, 'libs/users');
      expect(tree.listChanges()).toEqual(before);
      // Generation may update unrelated manifest fields before registration.
      const manifest = readJson(tree, 'package.json');
      writeJson(tree, 'package.json', {
        ...manifest,
        description: 'preserve generation changes',
      });
      commit();
      const patterns =
        manager === 'pnpm'
          ? parse(tree.read('pnpm-workspace.yaml', 'utf8') ?? '').packages
          : readJson(tree, 'package.json').workspaces;
      expect(patterns).toEqual(['apps/*', 'libs/users']);
      expect(readJson(tree, 'package.json').description).toBe(
        'preserve generation changes'
      );
      if (manager === 'pnpm')
        expect(
          parse(tree.read('pnpm-workspace.yaml', 'utf8') ?? '').hoistPattern
        ).toEqual([]);
      const after = tree.listChanges();
      plan(tree, 'libs/users')();
      expect(tree.listChanges()).toEqual(after);
    }
  );

  it.each(['array', 'object', 'pnpm'])(
    'preserves exact and glob library coverage and exclusions in %s declarations',
    (representation) => {
      for (const inclusion of ['libs/users', 'libs/*']) {
        const tree = createTreeWithEmptyWorkspace();
        const patterns = [inclusion, '!libs/private'];
        writeJson(tree, 'package.json', {
          packageManager:
            representation === 'pnpm' ? 'pnpm@10.0.0' : 'yarn@4.0.0',
          workspaces:
            representation === 'object'
              ? { packages: patterns, nohoist: ['**/native'] }
              : patterns,
        });
        if (representation === 'pnpm')
          tree.write(
            'pnpm-workspace.yaml',
            `# libraries\npackages: ${JSON.stringify(
              patterns
            )}\nhoistPattern: []\n`
          );
        const before = tree.listChanges();
        plan(tree, 'libs/users')();
        expect(tree.listChanges()).toEqual(before);
        expect(() => plan(tree, 'libs/private')).toThrow(
          'Generated package "libs/private" is excluded'
        );
        expect(tree.listChanges()).toEqual(before);
      }
    }
  );

  it.each([
    {
      declared: 'yarn',
      files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
      cli: 'pnpm',
      hint: 'pnpm',
      expected: 'manifest',
    },
    {
      declared: 'pnpm',
      files: ['yarn.lock'],
      cli: 'yarn',
      hint: 'npm',
      expected: 'yaml',
    },
    {
      files: ['pnpm-lock.yaml', 'yarn.lock'],
      cli: 'yarn',
      hint: 'npm',
      expected: 'yaml',
    },
    {
      files: ['yarn.lock', 'pnpm-workspace.yaml'],
      cli: 'pnpm',
      hint: 'pnpm',
      expected: 'manifest',
    },
    {
      files: ['pnpm-workspace.yaml'],
      cli: 'yarn',
      hint: 'npm',
      expected: 'yaml',
    },
    { files: [], cli: 'pnpm', hint: 'yarn', expected: 'yaml' },
    { files: [], hint: 'pnpm', expected: 'yaml' },
    { files: [], hint: 'undefined', expected: 'manifest' },
    { files: [], expected: 'manifest' },
  ])(
    'preserves manager detection precedence: %j',
    ({ declared, files, cli, hint, expected }) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(
        tree,
        'package.json',
        declared ? { packageManager: `${declared}@1.0.0` } : {}
      );
      writeJson(tree, 'nx.json', cli ? { cli: { packageManager: cli } } : {});
      for (const file of files) tree.write(file, '');
      const beforeManifest = tree.read('package.json');
      const beforeYaml = tree.read('pnpm-workspace.yaml');
      plan(tree, 'libs/users', hint)();
      if (expected === 'yaml') {
        expect(
          parse(tree.read('pnpm-workspace.yaml', 'utf8') ?? '').packages
        ).toEqual(['libs/users']);
        expect(tree.read('package.json')).toEqual(beforeManifest);
      } else {
        expect(readJson(tree, 'package.json').workspaces).toEqual([
          'libs/users',
        ]);
        expect(tree.read('pnpm-workspace.yaml')).toEqual(beforeYaml);
      }
    }
  );

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
