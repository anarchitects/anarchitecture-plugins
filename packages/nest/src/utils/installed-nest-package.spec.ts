// SPDX-License-Identifier: MIT
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { installedNestPackageResolver } from './installed-nest-package';

describe('installed Nest package metadata', () => {
  let root: string;
  const name = '@nestjs/core';
  const put = (path: string, content: unknown) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(content));
  };
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'nest-version-')));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reads a hoisted package even when exports hide its manifest, without executing it', () => {
    const path = join(root, 'node_modules', name, 'package.json');
    put(path, { name, version: '12.1.2', exports: { '.': './index.js' } });
    writeFileSync(
      join(dirname(path), 'index.js'),
      'throw new Error("must not execute");'
    );
    expect(
      installedNestPackageResolver(root)('libs/shared/package.json', name)
    ).toMatchObject({ version: '12.1.2', path });
  });

  it.each(['11.1.0', '12.1.2'])(
    'selects nested %s over the root install',
    (version) => {
      put(join(root, 'node_modules', name, 'package.json'), {
        name,
        version: '12.1.2',
      });
      const path = join(root, 'libs/shared/node_modules', name, 'package.json');
      put(path, { name, version });
      expect(
        installedNestPackageResolver(root)('libs/shared/package.json', name)
      ).toMatchObject({ version, path });
    }
  );

  it('follows package-manager symlinks', () => {
    const directory = join(root, '.store/nest-core');
    put(join(directory, 'package.json'), { name, version: '12.1.2' });
    const link = join(root, 'node_modules', name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(directory, link, 'junction');
    expect(
      installedNestPackageResolver(root)('package.json', name)?.version
    ).toBe('12.1.2');
  });

  it.each([
    'missing',
    'malformed',
    'wrong-name',
    'missing-version',
    'broken-link',
  ])(
    'fails on a %s nearest install instead of falling back to the root',
    (kind) => {
      put(join(root, 'node_modules', name, 'package.json'), {
        name,
        version: '12.1.2',
      });
      const directory = join(root, 'libs/shared/node_modules', name);
      mkdirSync(dirname(directory), { recursive: true });
      if (kind === 'broken-link')
        symlinkSync(join(root, 'absent'), directory, 'junction');
      else {
        mkdirSync(directory);
        if (kind === 'malformed')
          writeFileSync(join(directory, 'package.json'), '{');
        if (kind === 'wrong-name')
          put(join(directory, 'package.json'), {
            name: 'other',
            version: '12.1.2',
          });
        if (kind === 'missing-version')
          put(join(directory, 'package.json'), { name });
      }
      expect(() =>
        installedNestPackageResolver(root)('libs/shared/package.json', name)
      ).toThrow('Cannot read installed @nestjs/core');
    }
  );

  it('does not use an installation outside the workspace as host evidence', () => {
    put(join(root, 'node_modules', name, 'package.json'), {
      name,
      version: '12.1.2',
    });
    const workspace = join(root, 'workspace');
    mkdirSync(workspace);
    expect(
      installedNestPackageResolver(workspace)('package.json', name)
    ).toBeUndefined();
  });

  it('resolves a workspace reached through a directory symlink', () => {
    const workspace = join(root, 'workspace');
    put(join(workspace, 'node_modules', name, 'package.json'), {
      name,
      version: '12.1.2',
    });
    const alias = join(root, 'alias');
    symlinkSync(workspace, alias, 'junction');
    expect(
      installedNestPackageResolver(alias)('package.json', name)?.version
    ).toBe('12.1.2');
  });

  it.each([
    { peerDependencies: 'invalid' },
    { peerDependencies: { '@nestjs/common': 12 } },
    { peerDependenciesMeta: { '@nestjs/common': { optional: 'yes' } } },
  ])('rejects malformed installed peer metadata %j', (metadata) => {
    put(join(root, 'node_modules', name, 'package.json'), {
      name,
      version: '12.1.2',
      ...metadata,
    });
    expect(() =>
      installedNestPackageResolver(root)('package.json', name)
    ).toThrow('invalid installed peerDependencies');
  });
});
