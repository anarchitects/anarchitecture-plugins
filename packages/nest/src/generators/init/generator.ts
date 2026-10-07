// SPDX-License-Identifier: MIT
import {
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { registerNestPlugin } from '../../utils/plugin-registration';
import {
  validateNestDependencies,
  type PackageManifest,
} from '../../utils/validate-dependencies';
import type { InitGeneratorSchema } from './schema';

/** Validate first so a rejected workspace receives no partial configuration edits. */
export function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {}
): void {
  const nxJson = readNxJson(tree) ?? {};
  const plugins = registerNestPlugin(nxJson.plugins, options);
  if (!tree.exists('package.json')) {
    throw new Error(
      'Nest init requires a workspace package.json. Add it and declare a stable @nestjs/cli v12 dependency before retrying.'
    );
  }
  const manifests: Record<string, PackageManifest> = {};
  visitNotIgnoredFiles(tree, '.', (path) => {
    if (path === 'package.json' || path.endsWith('/package.json')) {
      manifests[path] = readJson<PackageManifest>(tree, path);
    }
  });
  validateNestDependencies(manifests);
  if (JSON.stringify(plugins) !== JSON.stringify(nxJson.plugins)) {
    if (tree.exists('nx.json')) updateNxJson(tree, { ...nxJson, plugins });
    else writeJson(tree, 'nx.json', { ...nxJson, plugins });
  }
}

export default initGenerator;
