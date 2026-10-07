// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { DecoratorGeneratorSchema } from './schema';
export async function decoratorGenerator(
  tree: Tree,
  options: DecoratorGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'decorator', options, {
    flat: true,
    language: 'ts',
  });
}
export default decoratorGenerator;
