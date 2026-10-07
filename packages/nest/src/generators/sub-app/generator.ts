// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestMember } from '../../utils/generate-nest-member';
import type { SubAppGeneratorSchema } from './schema';
export async function subAppGenerator(
  tree: Tree,
  options: SubAppGeneratorSchema
): Promise<void> {
  await generateNestMember(tree, 'sub-app', options);
}
export default subAppGenerator;
