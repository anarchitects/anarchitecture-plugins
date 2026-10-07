// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { PipeGeneratorSchema } from './schema';
export async function pipeGenerator(
  tree: Tree,
  options: PipeGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'pipe', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default pipeGenerator;
