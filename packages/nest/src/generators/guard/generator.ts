// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { GuardGeneratorSchema } from './schema';
export async function guardGenerator(
  tree: Tree,
  options: GuardGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'guard', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default guardGenerator;
