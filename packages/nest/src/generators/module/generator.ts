// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ModuleGeneratorSchema } from './schema';
export async function moduleGenerator(
  tree: Tree,
  options: ModuleGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'module', options, {
    flat: false,
    language: 'ts',
  });
}
export default moduleGenerator;
