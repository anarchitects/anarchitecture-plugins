// SPDX-License-Identifier: MIT
import {
  intersects,
  minVersion,
  satisfies,
  subset,
  valid,
  validRange,
} from 'semver';
import type { ResolveInstalledNestPackage } from './installed-nest-package';

export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

// Nest integrations such as swagger/typeorm have independent version schedules.
const nestPackages = new Set([
  '@nestjs/cli',
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/platform-express',
  '@nestjs/platform-fastify',
  '@nestjs/microservices',
  '@nestjs/websockets',
  '@nestjs/testing',
]);
const sections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const supportedHost = '>=12.0.0 <13';
const supportedPeers = '>=11.0.0 <13';

function stableRange(range: string): boolean {
  return (
    typeof range === 'string' &&
    !!validRange(range) &&
    !!minVersion(range) &&
    !/\d+\.\d+\.\d+-[\da-z]/i.test(range)
  );
}

/** Validate before mutation. Broader peers require installed host evidence. */
export function validateNestDependencies(
  manifests: Record<string, PackageManifest>,
  resolveInstalled?: ResolveInstalledNestPackage
): void {
  const errors: string[] = [];
  const declarations: {
    path: string;
    section: (typeof sections)[number];
    name: string;
    range: string;
  }[] = [];
  let hasBroaderPeers = false;
  let hasCli = false;
  for (const [path, manifest] of Object.entries(manifests).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    for (const section of sections) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        if (!nestPackages.has(name)) continue;
        if (name === '@nestjs/cli' && section !== 'peerDependencies')
          hasCli = true;
        const runtimePeer =
          section === 'peerDependencies' && name !== '@nestjs/cli';
        const supported = runtimePeer ? supportedPeers : supportedHost;
        if (
          !stableRange(range) ||
          !subset(range, supported) ||
          !intersects(range, supportedHost)
        ) {
          errors.push(
            `${path} (${section}): ${name}@${String(range)} ${
              runtimePeer
                ? 'is not a supported library peer range (stable Nest 11/12 with Nest 12 support)'
                : 'is not a stable Nest v12 range'
            }. Use a semver version/range fully within "${supported}"; upgrade older Nest packages together and replace prereleases, tags, or unresolved protocols before retrying.`
          );
        } else {
          declarations.push({ path, section, name, range });
          if (runtimePeer && !subset(range, supportedHost))
            hasBroaderPeers = true;
        }
      }
    }
  }
  if (!hasCli) {
    errors.push(
      'No @nestjs/cli dependency is declared. Add a stable v12 CLI as a devDependency in the workspace or Nest project package.json (for example, yarn add -D @nestjs/cli@^12), install dependencies, and rerun init. A peer-only declaration does not install the CLI for this workspace.'
    );
  }
  // Preserve declaration-only initialization for existing v12-only workspaces.
  // When accepting broader peers, inspect every declared host from its own
  // package directory, not from this plugin's install or the workspace root.
  if (hasBroaderPeers) {
    for (const { path, section, name, range } of declarations) {
      const context = `${path} (${section}): ${name}@${range}`;
      try {
        const installed = resolveInstalled?.(path, name);
        if (!installed) {
          if (section !== 'optionalDependencies' || name === '@nestjs/cli')
            errors.push(
              `${context}: no installed package could be resolved. Install the declared stable Nest 12 host and CLI in this workspace before retrying; library peers alone do not select a host.`
            );
          continue;
        }
        if (
          !valid(installed.version) ||
          !satisfies(installed.version, supportedHost) ||
          !satisfies(installed.version, range)
        ) {
          errors.push(
            `${context}: installed ${installed.version} at ${installed.path} does not satisfy both the declaration and stable Nest v12 (${supportedHost}). Upgrade older Nest packages together and install matching stable versions before retrying.`
          );
          continue;
        }
        // Core/common and framework integrations must also meet one another's
        // published peer requirements; a shared major alone is insufficient.
        for (const [peer, peerRange] of Object.entries(
          installed.peerDependencies ?? {}
        )) {
          if (!nestPackages.has(peer)) continue;
          const selectedPeer = resolveInstalled?.(path, peer);
          if (!selectedPeer && installed.peerDependenciesMeta?.[peer]?.optional)
            continue;
          if (
            !selectedPeer ||
            !valid(selectedPeer.version) ||
            !satisfies(selectedPeer.version, supportedHost) ||
            typeof peerRange !== 'string' ||
            !validRange(peerRange) ||
            !satisfies(selectedPeer.version, peerRange)
          ) {
            errors.push(
              `${context}: installed ${installed.version} at ${
                installed.path
              } requires ${peer}@${String(
                peerRange
              )}, but this package resolves ${
                selectedPeer
                  ? `${selectedPeer.version} at ${selectedPeer.path}`
                  : 'no installed package'
              }. Install a compatible stable Nest 12 host before retrying.`
            );
          }
        }
      } catch (error) {
        errors.push(
          `${context}: ${String(
            error
          )}. Repair the workspace install before retrying.`
        );
      }
    }
  }
  if (errors.length)
    throw new Error(
      `Cannot initialize @anarchitects/nest:\n${errors.join('\n')}`
    );
}
