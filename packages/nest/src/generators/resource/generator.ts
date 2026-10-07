// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ResourceGeneratorSchema } from './schema';
export async function resourceGenerator(
  tree: Tree,
  options: ResourceGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'resource', options, {
    flat: false,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default resourceGenerator;
