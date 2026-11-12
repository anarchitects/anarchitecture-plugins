// SPDX-License-Identifier: MIT
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';

export interface InstalledNestPackage {
  path: string;
  version: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

export type ResolveInstalledNestPackage = (
  manifestPath: string,
  name: string
) => InstalledNestPackage | undefined;

/** Read metadata in Node's lookup order without loading framework code.
 * Only workspace installs count; exports may hide package.json. A broken
 * nearest install must not fall through to a healthy hoisted package.
 */
export function installedNestPackageResolver(
  workspaceRoot: string
): ResolveInstalledNestPackage {
  return (manifestPath, name) => {
    const root = realpathSync(workspaceRoot);
    const from = createRequire(resolve(root, manifestPath));
    for (const modules of from.resolve.paths(name) ?? []) {
      const withinWorkspace = relative(root, modules);
      if (
        isAbsolute(withinWorkspace) ||
        withinWorkspace === '..' ||
        withinWorkspace.startsWith('../') ||
        withinWorkspace.startsWith('..\\')
      )
        continue;
      const directory = join(modules, name);
      try {
        lstatSync(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      const path = join(directory, 'package.json');
      try {
        const manifest = JSON.parse(readFileSync(path, 'utf8'));
        if (manifest?.name !== name || typeof manifest.version !== 'string')
          throw new Error('expected matching package name and version');
        if (
          manifest.peerDependencies !== undefined &&
          (!manifest.peerDependencies ||
            typeof manifest.peerDependencies !== 'object' ||
            Array.isArray(manifest.peerDependencies) ||
            Object.values(manifest.peerDependencies).some(
              (value) => typeof value !== 'string'
            ))
        )
          throw new Error('invalid installed peerDependencies');
        if (
          manifest.peerDependenciesMeta !== undefined &&
          (!manifest.peerDependenciesMeta ||
            typeof manifest.peerDependenciesMeta !== 'object' ||
            Array.isArray(manifest.peerDependenciesMeta) ||
            Object.values(manifest.peerDependenciesMeta).some(
              (value) =>
                !value ||
                typeof value !== 'object' ||
                Array.isArray(value) ||
                ('optional' in value && typeof value.optional !== 'boolean')
            ))
        )
          throw new Error('invalid installed peerDependenciesMeta');
        return {
          path,
          version: manifest.version,
          peerDependencies: manifest.peerDependencies,
          peerDependenciesMeta: manifest.peerDependenciesMeta,
        };
      } catch (error) {
        throw new Error(
          `Cannot read installed ${name} at ${path}: ${String(error)}`
        );
      }
    }
    return undefined;
  };
}
