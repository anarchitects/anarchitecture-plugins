// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  dependencyState,
  installAfterGeneration,
  nativeInstallRequired,
} from './dependency-install';
import type { NativeSchematicName } from '../generation-adapter/nest-schematic-runtime';
import { runNestSchematic } from '../generation-adapter/run-nest-schematic';
import { treePath } from '../generation-adapter/tree-snapshot';
import {
  nativeRelativePath,
  resolveNestGenerationContext,
  nestGenerationDefaults,
  type NativeGenerationDefaults,
} from './resolve-nest-generation-context';

interface ArtifactOptions {
  name: string;
  skipInstall?: boolean;
  project?: string;
  nestProject?: string;
  path?: string;
  sourceRoot?: string;
  spec?: boolean;
  flat?: boolean;
  specFileSuffix?: string;
  language?: string;
  module?: string;
}

/** Shared Nx context adaptation; framework generation remains entirely native. */
export async function generateNestArtifact(
  tree: Tree,
  schematic: NativeSchematicName,
  options: ArtifactOptions,
  defaults: NativeGenerationDefaults
): Promise<GeneratorCallback | undefined> {
  if (typeof options.name !== 'string' || !options.name.trim())
    throw new Error(`A non-empty Nest ${schematic} name is required.`);
  treePath(options.name);
  for (const path of [options.path, options.module])
    if (path !== undefined) nativeRelativePath(path);
  const { ownerRoot, config, member } = resolveNestGenerationContext(
    tree,
    options
  );
  const {
    project: _project,
    nestProject: _nestProject,
    skipInstall,
    ...nativeOptions
  } = options;
  const before = dependencyState(tree, ['', ownerRoot]);
  const result = await runNestSchematic(tree, {
    schematic,
    workingDirectory: ownerRoot,
    options: {
      ...nativeOptions,
      ...nestGenerationDefaults(config, member, options, schematic, defaults),
    },
  });
  return installAfterGeneration(
    tree,
    skipInstall,
    nativeInstallRequired(result),
    before !== dependencyState(tree, ['', ownerRoot])
  );
}
