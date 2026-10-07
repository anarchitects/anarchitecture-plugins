// SPDX-License-Identifier: MIT
import { posix } from 'node:path';

/** Nest's sourceRoot and monorepo root fields do not change the Nx project root. */
export function getNestProjectRoot(configFilePath: string): string | undefined {
  const normalizedPath = posix.normalize(configFilePath.replace(/\\/g, '/'));
  return posix.basename(normalizedPath) === 'nest-cli.json'
    ? posix.dirname(normalizedPath)
    : undefined;
}

export function hasProjectManifest(siblingFiles: readonly string[]): boolean {
  return (
    siblingFiles.includes('package.json') ||
    siblingFiles.includes('project.json')
  );
}
