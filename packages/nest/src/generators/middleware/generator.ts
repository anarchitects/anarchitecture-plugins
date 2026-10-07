// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { MiddlewareGeneratorSchema } from './schema';
export async function middlewareGenerator(
  tree: Tree,
  options: MiddlewareGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'middleware', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default middlewareGenerator;
