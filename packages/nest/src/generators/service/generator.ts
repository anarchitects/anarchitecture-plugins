// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ServiceGeneratorSchema } from './schema';
export async function serviceGenerator(
  tree: Tree,
  options: ServiceGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'service', options, {
    flat: false,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default serviceGenerator;
