// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { InterfaceGeneratorSchema } from './schema';
export async function interfaceGenerator(
  tree: Tree,
  options: InterfaceGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'interface', options, { flat: true });
}
export default interfaceGenerator;
