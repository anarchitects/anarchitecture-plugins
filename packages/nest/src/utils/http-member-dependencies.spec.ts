// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { validateHttpMemberOwner } from './http-member-dependencies';
import type { ResolveInstalledNestPackage } from './installed-nest-package';

const host = () => {
  const tree = createTreeWithEmptyWorkspace();
  writeJson(tree, 'services/api/package.json', {
    dependencies: {
      '@nestjs/common': '^12.0.1',
      '@nestjs/core': '12.3.0',
      '@nestjs/platform-express': '12.3.0',
    },
    devDependencies: { '@nestjs/testing': '12.3.0' },
  });
  return tree;
};
const installed: ResolveInstalledNestPackage = (path, name) =>
  name === '@nestjs/platform-node'
    ? undefined
    : {
        version: name === '@nestjs/cli' ? '12.0.0' : '12.3.0',
        path: `${path}/node_modules/${name}/package.json`,
      };

it('checks the selected owner, permits adding a missing adapter and preserves declarations', () => {
  const tree = host();
  const before = tree.listChanges();
  const resolver = jest.fn(installed);
  validateHttpMemberOwner(tree, 'services/api', resolver);
  expect(
    resolver.mock.calls.every(([path]) => path === 'services/api/package.json')
  ).toBe(true);
  expect(tree.listChanges()).toEqual(before);
});

it.each(['11.1.0', '12.1.2', '12.3.1', '13.0.0', '12.3.0-beta.1', undefined])(
  'rejects a stale/unverified selected install %s',
  (version) => {
    const tree = host();
    expect(() =>
      validateHttpMemberOwner(tree, 'services/api', (path, name) =>
        name === '@nestjs/core'
          ? version
            ? { version, path }
            : undefined
          : installed(path, name)
      )
    ).toThrow('services/api/package.json');
  }
);

it.each([
  '^11 || ^12',
  '12.1.2',
  '^13',
  'workspace:*',
  'next',
  '^12.3.0-beta.1',
])('rejects incompatible host declarations %s', (range) => {
  const tree = host();
  writeJson(tree, 'services/api/package.json', {
    dependencies: { '@nestjs/common': range },
  });
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', installed)
  ).toThrow('incompatible declaration');
});

it('does not hide a conflicting section or silently move a dev-only adapter', () => {
  const tree = host();
  const manifest = readJson(tree, 'services/api/package.json');
  manifest.peerDependencies = { '@nestjs/core': '^11' };
  writeJson(tree, 'services/api/package.json', manifest);
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', installed)
  ).toThrow('incompatible declaration');
  delete manifest.peerDependencies;
  manifest.devDependencies['@nestjs/platform-node'] = '12.3.0';
  writeJson(tree, 'services/api/package.json', manifest);
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', installed)
  ).toThrow('owner dependencies');
});

it('rejects malformed nearer evidence and incompatible installed peer requirements', () => {
  const tree = host();
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', () => {
      throw new Error('broken nearer install');
    })
  ).toThrow('broken nearer install');
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', (path, name) => {
      const value = installed(path, name);
      return value && name === '@nestjs/core'
        ? { ...value, peerDependencies: { '@nestjs/common': '^13' } }
        : value;
    })
  ).toThrow('requires @nestjs/common@^13');
});

it('preserves verified bounded library peers while requiring a current installed host', () => {
  const tree = host();
  const manifest = readJson(tree, 'services/api/package.json');
  manifest.peerDependencies = {
    '@nestjs/common': '^11 || ^12',
    '@nestjs/core': '>=11 <13',
  };
  writeJson(tree, 'services/api/package.json', manifest);
  const before = tree.listChanges();
  expect(() =>
    validateHttpMemberOwner(tree, 'services/api', installed)
  ).not.toThrow();
  expect(tree.listChanges()).toEqual(before);
});

it.each(['11.1.0', '13.0.0', '12.0.0-beta.1'])(
  'rejects an unsupported installed CLI %s',
  (version) => {
    expect(() =>
      validateHttpMemberOwner(host(), 'services/api', (path, name) =>
        name === '@nestjs/cli' ? { version, path } : installed(path, name)
      )
    ).toThrow('@nestjs/cli');
  }
);

describe('explicit Express owners', () => {
  it('preserves existing ranges and bounded library peers', () => {
    const tree = host();
    const manifest = readJson(tree, 'services/api/package.json');
    manifest.dependencies['@nestjs/platform-express'] = '^12.0.1';
    manifest.peerDependencies = { '@nestjs/core': '^11 || ^12' };
    writeJson(tree, 'services/api/package.json', manifest);
    const before = tree.listChanges();
    validateHttpMemberOwner(tree, 'services/api', installed, 'express');
    expect(tree.listChanges()).toEqual(before);
  });
  it('permits an absent Express adapter but rejects dev-only declarations', () => {
    const tree = host();
    const manifest = readJson(tree, 'services/api/package.json');
    delete manifest.dependencies['@nestjs/platform-express'];
    writeJson(tree, 'services/api/package.json', manifest);
    const resolver: ResolveInstalledNestPackage = (path, name) =>
      name === '@nestjs/platform-express' ? undefined : installed(path, name);
    expect(() =>
      validateHttpMemberOwner(tree, 'services/api', resolver, 'express')
    ).not.toThrow();
    manifest.devDependencies['@nestjs/platform-express'] = '12.3.0';
    writeJson(tree, 'services/api/package.json', manifest);
    expect(() =>
      validateHttpMemberOwner(tree, 'services/api', installed, 'express')
    ).toThrow('owner dependencies');
  });
  it.each(['node', 'fastify'])(
    'rejects a stale retained %s adapter before mutation',
    (adapter) => {
      const tree = host();
      const manifest = readJson(tree, 'services/api/package.json');
      const name = '@nestjs/platform-' + adapter;
      manifest.dependencies[name] = '12.3.0';
      writeJson(tree, 'services/api/package.json', manifest);
      const before = tree.listChanges();
      expect(() =>
        validateHttpMemberOwner(
          tree,
          'services/api',
          (path, dependency) =>
            dependency === name
              ? { version: '12.1.2', path }
              : installed(path, dependency),
          'express'
        )
      ).toThrow(name);
      expect(tree.listChanges()).toEqual(before);
    }
  );
});
