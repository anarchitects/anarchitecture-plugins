// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { posix } from 'node:path';
import {
  dependencyState,
  installAfterGeneration,
  nativeInstallRequired,
} from './dependency-install';
import type { NativeSchematicName } from '../generation-adapter/nest-schematic-runtime';
import { runNestSchematic } from '../generation-adapter/run-nest-schematic';
import { treePath } from '../generation-adapter/tree-snapshot';
import {
  nativeRelativePath,
  resolveNestGenerationContext,
  nestGenerationDefaults,
  type NativeGenerationDefaults,
} from './resolve-nest-generation-context';

interface ArtifactOptions {
  name: string;
  skipInstall?: boolean;
  project?: string;
  nestProject?: string;
  path?: string;
  sourceRoot?: string;
  spec?: boolean;
  flat?: boolean;
  specFileSuffix?: string;
  language?: string;
  module?: string;
}

/** Shared Nx context adaptation; framework generation remains entirely native. */
export async function generateNestArtifact(
  tree: Tree,
  schematic: NativeSchematicName,
  options: ArtifactOptions,
  defaults: NativeGenerationDefaults
): Promise<GeneratorCallback | undefined> {
  if (typeof options.name !== 'string' || !options.name.trim())
    throw new Error(`A non-empty Nest ${schematic} name is required.`);
  treePath(options.name);
  for (const path of [options.path, options.module])
    if (path !== undefined) nativeRelativePath(path);
  const context = resolveNestGenerationContext(tree, options);
  if (context.kind === 'nx-library' && schematic === 'resource')
    throw new Error(
      'Resource generation in Nx-native Nest libraries is not supported yet.'
    );
  const ownerRoot =
    context.kind === 'nx-library' ? context.projectRoot : context.ownerRoot;
  const config =
    context.kind === 'nx-library'
      ? { sourceRoot: context.relativeSourceRoot, language: context.language }
      : context.config;
  const member = context.kind === 'native-member' ? context.member : undefined;
  if (context.kind === 'nx-library') {
    const sourceRoot = posix.join(
      ownerRoot,
      nativeRelativePath(options.sourceRoot ?? context.relativeSourceRoot)
    );
    if (
      sourceRoot !== context.sourceRoot &&
      !sourceRoot.startsWith(`${context.sourceRoot}/`)
    )
      throw new Error(
        '--sourceRoot must stay inside the selected Nx-native library source root.'
      );
    if (options.specFileSuffix && /[/\\]/.test(options.specFileSuffix))
      throw new Error(
        '--specFileSuffix must be a filename suffix, not a path.'
      );
  }
  const {
    project: _project,
    nestProject: _nestProject,
    skipInstall,
    ...nativeOptions
  } = options;
  const before = dependencyState(tree, ['', ownerRoot]);
  const result = await runNestSchematic(tree, {
    schematic,
    workingDirectory: ownerRoot,
    options: {
      ...nativeOptions,
      ...nestGenerationDefaults(config, member, options, schematic, defaults),
    },
  });
  return installAfterGeneration(
    tree,
    skipInstall,
    nativeInstallRequired(result),
    before !== dependencyState(tree, ['', ownerRoot])
  );
}
