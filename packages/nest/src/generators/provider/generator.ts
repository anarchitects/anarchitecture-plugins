// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ProviderGeneratorSchema } from './schema';
export async function providerGenerator(
  tree: Tree,
  options: ProviderGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'provider', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default providerGenerator;
