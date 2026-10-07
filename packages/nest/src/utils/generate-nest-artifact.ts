// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
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
): Promise<void> {
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
    ...nativeOptions
  } = options;
  await runNestSchematic(tree, {
    schematic,
    workingDirectory: ownerRoot,
    options: {
      ...nativeOptions,
      ...nestGenerationDefaults(config, member, options, schematic, defaults),
    },
  });
}
