// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { ControllerGeneratorSchema } from './schema';
export async function controllerGenerator(
  tree: Tree,
  options: ControllerGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'controller', options, {
    flat: false,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default controllerGenerator;
