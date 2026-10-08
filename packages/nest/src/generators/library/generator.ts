// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestMember } from '../../utils/generate-nest-member';
import type { LibraryGeneratorSchema } from './schema';
import { resolveLibraryMode } from './resolve-library-mode';
export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  const mode = resolveLibraryMode(options);
  if (mode.kind === 'nx') {
    throw new Error(
      'Nx-native library generation with --directory is not available yet. Native Nest libraries use --project=<nest-owner>.'
    );
  }
  const { directory: _directory, ...nativeOptions } = options;
  return generateNestMember(tree, 'library', nativeOptions);
}
export default libraryGenerator;
