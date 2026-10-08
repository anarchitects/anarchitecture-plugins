// SPDX-License-Identifier: MIT
import { treePath } from '../../generation-adapter/tree-snapshot';
import type { LibraryGeneratorSchema } from './schema';

export type LibraryMode =
  | { kind: 'native'; project: string }
  | { kind: 'nx'; directory: string };

/** Resolve ownership before either generation strategy stages any files. */
export function resolveLibraryMode(
  options: LibraryGeneratorSchema
): LibraryMode {
  const hasProject = options.project !== undefined;
  const hasDirectory = options.directory !== undefined;
  if (hasProject === hasDirectory) {
    throw new Error(
      'Choose exactly one library owner: --project=<nest-owner> for a library inside an existing Nest workspace, or --directory=<workspace-relative-path> for a new independent Nx library/package. These options are mutually exclusive.'
    );
  }
  const selector = hasProject ? 'project' : 'directory';
  const value = options[selector];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `--${selector} must be a non-empty ${
        hasProject ? 'Nx project name' : 'workspace-relative directory'
      }.`
    );
  }
  if (hasProject) return { kind: 'native', project: value };

  const nativeOnly = (['rootDir', 'path', 'prefix'] as const).filter(
    (key) => options[key] !== undefined
  );
  if (nativeOnly.length) {
    throw new Error(
      `${nativeOnly.map((key) => `--${key}`).join(', ')} ${
        nativeOnly.length === 1 ? 'is' : 'are'
      } only supported with --project for a native Nest library. --directory selects the complete destination of an independent Nx library/package.`
    );
  }
  return { kind: 'nx', directory: treePath(value) };
}
