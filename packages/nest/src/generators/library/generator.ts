// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestMember } from '../../utils/generate-nest-member';
import type { LibraryGeneratorSchema } from './schema';
export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestMember(tree, 'library', options);
}
export default libraryGenerator;
