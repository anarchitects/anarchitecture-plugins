// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { runNestSchematic } from '../../generation-adapter/run-nest-schematic';
import { treePath } from '../../generation-adapter/tree-snapshot';
import {
  nativeRelativePath,
  resolveNestGenerationContext,
  resourceGenerationDefaults,
} from '../../utils/resolve-nest-generation-context';
import type { ResourceGeneratorSchema } from './schema';

export async function resourceGenerator(
  tree: Tree,
  options: ResourceGeneratorSchema
): Promise<void> {
  if (typeof options.name !== 'string' || !options.name.trim())
    throw new Error('A non-empty Nest resource name is required.');
  treePath(options.name);
  if (options.path !== undefined) nativeRelativePath(options.path);
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
    schematic: 'resource',
    workingDirectory: ownerRoot,
    options: {
      ...nativeOptions,
      ...resourceGenerationDefaults(config, member, options),
    },
  });
}
export default resourceGenerator;
