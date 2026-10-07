// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { FilterGeneratorSchema } from './schema';
export async function filterGenerator(
  tree: Tree,
  options: FilterGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'filter', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default filterGenerator;
