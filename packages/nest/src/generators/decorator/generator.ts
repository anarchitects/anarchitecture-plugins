// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { DecoratorGeneratorSchema } from './schema';
export async function decoratorGenerator(
  tree: Tree,
  options: DecoratorGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'decorator', options, {
    flat: true,
    language: 'ts',
  });
}
export default decoratorGenerator;
