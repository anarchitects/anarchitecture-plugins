// SPDX-License-Identifier: MIT
import { readJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { satisfies, subset, validRange } from 'semver';
import {
  installedNestPackageResolver,
  type ResolveInstalledNestPackage,
} from './installed-nest-package';
import {
  httpPlatforms,
  httpRuntimeVersions,
  httpRuntimeRange,
  type HttpRuntimeVersion,
  type HttpPlatform,
} from './http-platform';
import type { PackageManifest } from './validate-dependencies';

/** Existing owners are verified, never silently upgraded to the audited runtime. */
export function validateHttpMemberOwner(
  tree: Tree,
  ownerRoot: string,
  resolveInstalled: ResolveInstalledNestPackage = installedNestPackageResolver(
    tree.root
  ),
  platform: HttpPlatform = 'node'
): HttpRuntimeVersion {
  const { packageName: adapterPackage, label } = httpPlatforms[platform];
  const path = posix.join(ownerRoot, 'package.json');
  const manifest = readJson<PackageManifest>(tree, path);
  const sections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const;
  const required = ['@nestjs/common', '@nestjs/core', '@nestjs/testing'];
  const adapters = [
    '@nestjs/platform-express',
    '@nestjs/platform-fastify',
    '@nestjs/platform-node',
  ];
  const fail = (name: string, reason: string): never => {
    throw new Error(
      `${path}: cannot generate ${
        platform === 'express' ? 'an' : 'a'
      } ${label} sub-app: ${name} ${reason}. Select and install a coherent audited common/core/testing/adapter host (${httpRuntimeRange}) and a stable v12 CLI in this owner before retrying; skipInstall does not bypass compatibility checks.`
    );
  };
  let core;
  try {
    core = resolveInstalled(path, '@nestjs/core');
  } catch (error) {
    return fail('@nestjs/core', String(error));
  }
  const runtimeVersion = httpRuntimeVersions.find(
    (version) => version === core?.version
  );
  if (!runtimeVersion)
    return fail(
      '@nestjs/core',
      `resolves ${
        core?.version ?? 'no installed package'
      } instead of ${httpRuntimeRange}`
    );
  for (const name of [...required, ...adapters, '@nestjs/cli']) {
    const declarations = sections.flatMap((section) => {
      const range = manifest[section]?.[name];
      return range === undefined ? [] : [{ section, range }];
    });
    const ranges = declarations.map(({ range }) => range);
    if (required.includes(name) && !ranges.length)
      fail(name, 'has no owner declaration');
    if (
      name !== '@nestjs/cli' &&
      !required.includes(name) &&
      !ranges.length &&
      name !== adapterPackage
    )
      continue;
    const expected = name === '@nestjs/cli' ? '>=12 <13' : runtimeVersion;
    for (const { section, range } of declarations) {
      const supported =
        section === 'peerDependencies' &&
        !['@nestjs/cli', '@nestjs/platform-node'].includes(name)
          ? '>=11 <13'
          : '>=12 <13';
      if (
        typeof range !== 'string' ||
        !validRange(range) ||
        !subset(range, supported) ||
        (name !== '@nestjs/cli' && !satisfies(runtimeVersion, range)) ||
        /\d+\.\d+\.\d+-/.test(range)
      )
        fail(name, `has incompatible declaration ${String(range)}`);
      if (name === '@nestjs/platform-node' && !subset(range, runtimeVersion))
        fail(name, `must select exactly ${runtimeVersion}, found ${range}`);
    }
    if (
      (name === adapterPackage || name === '@nestjs/platform-node') &&
      ranges.length &&
      !manifest.dependencies?.[name]
    )
      fail(name, 'must be declared in owner dependencies');
    let installed;
    try {
      installed = resolveInstalled(path, name);
    } catch (error) {
      return fail(name, String(error));
    }
    if (!installed && name === adapterPackage && !ranges.length) continue;
    if (
      !installed ||
      !satisfies(installed.version, expected) ||
      !ranges.every((range) => satisfies(installed.version, range))
    )
      return fail(
        name,
        `resolves ${
          installed?.version ?? 'no installed package'
        } instead of ${expected}`
      );
    for (const [peer, range] of Object.entries(
      installed.peerDependencies ?? {}
    )) {
      if (!peer.startsWith('@nestjs/')) continue;
      const selected = resolveInstalled(path, peer);
      if (!selected && installed.peerDependenciesMeta?.[peer]?.optional)
        continue;
      if (!selected || !satisfies(selected.version, range))
        fail(
          name,
          `requires ${peer}@${range}, but this owner resolves ${
            selected?.version ?? 'nothing'
          }`
        );
    }
  }
  return runtimeVersion;
}
