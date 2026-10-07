// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ClassGeneratorSchema } from './schema';
export async function classGenerator(
  tree: Tree,
  options: ClassGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'class', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default classGenerator;
