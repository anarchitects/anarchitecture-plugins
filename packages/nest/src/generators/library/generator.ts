// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestMember } from '../../utils/generate-nest-member';
import type { LibraryGeneratorSchema } from './schema';
import { resolveLibraryMode } from './resolve-library-mode';
import { generateNxNestLibrary } from '../../utils/generate-nx-nest-library';
export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  const mode = resolveLibraryMode(options);
  if (mode.kind === 'nx') {
    return generateNxNestLibrary(tree, options, mode.directory);
  }
  const nativeOptions = { ...options };
  delete nativeOptions.directory;
  return generateNestMember(tree, 'library', nativeOptions);
}
export default libraryGenerator;
