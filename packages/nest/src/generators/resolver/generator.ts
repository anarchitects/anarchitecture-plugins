// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ResolverGeneratorSchema } from './schema';
export async function resolverGenerator(
  tree: Tree,
  options: ResolverGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'resolver', options, {
    flat: false,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default resolverGenerator;
