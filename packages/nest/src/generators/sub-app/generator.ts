// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestMember } from '../../utils/generate-nest-member';
import type { SubAppGeneratorSchema } from './schema';
export async function subAppGenerator(
  tree: Tree,
  options: SubAppGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestMember(tree, 'sub-app', options);
}
export default subAppGenerator;
