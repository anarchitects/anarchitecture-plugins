// SPDX-License-Identifier: MIT
import { minVersion, subset, validRange } from 'semver';

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

/** Validate declarations, without resolving installed packages or changing manifests. */
export function validateNestDependencies(
  manifests: Record<string, PackageManifest>
): void {
  const errors: string[] = [];
  let hasCli = false;
  for (const [path, manifest] of Object.entries(manifests).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    for (const section of sections) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        if (!nestPackages.has(name)) continue;
        if (name === '@nestjs/cli' && section !== 'peerDependencies')
          hasCli = true;
        const supported = '>=12.0.0 <13';
        if (
          typeof range !== 'string' ||
          !validRange(range) ||
          !minVersion(range) ||
          /\d+\.\d+\.\d+-[\da-z]/i.test(range) ||
          !subset(range, supported)
        ) {
          errors.push(
            `${path} (${section}): ${name}@${String(
              range
            )} is not a stable Nest v12 range. Use a semver version/range fully within "${supported}"; upgrade older Nest packages together and replace prereleases, tags, or unresolved protocols before retrying.`
          );
        }
      }
    }
  }
  if (!hasCli) {
    errors.push(
      'No @nestjs/cli dependency is declared. Add a stable v12 CLI as a devDependency in the workspace or Nest project package.json (for example, yarn add -D @nestjs/cli@^12), install dependencies, and rerun init. A peer-only declaration does not install the CLI for this workspace.'
    );
  }
  if (errors.length)
    throw new Error(
      `Cannot initialize @anarchitects/nest:\n${errors.join('\n')}`
    );
}
