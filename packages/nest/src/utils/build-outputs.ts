// SPDX-License-Identifier: MIT
import { isAbsolute, relative, resolve, sep } from 'node:path';

export interface NestCliConfig {
  projects?: Record<string, NestCliConfig>;
  compilerOptions?: {
    tsConfigPath?: string;
    builder?: string | { type?: string; options?: { configPath?: string } };
  };
}

/** Matches Nest's selection for `nest build` without an application argument. */
export function selectTsConfigPath(
  config: NestCliConfig,
  hasBuildConfig: boolean
): string {
  const { tsConfigPath, builder } = config.compilerOptions ?? {};
  if (tsConfigPath) return tsConfigPath;
  const builderConfigPath =
    typeof builder === 'object' && builder?.type === 'tsc'
      ? builder.options?.configPath
      : undefined;
  return (
    builderConfigPath ??
    (hasBuildConfig ? 'tsconfig.build.json' : 'tsconfig.json')
  );
}

export function workspaceFileInput(
  workspaceRoot: string,
  filePath: string
): string {
  return `{workspaceRoot}/${relative(workspaceRoot, filePath)
    .split(sep)
    .join('/')}`;
}

/** TypeScript resolves an inherited outDir against the config that defines it. */
export function normalizeBuildOutput(
  workspaceRoot: string,
  projectRoot: string,
  outDir?: string
): string {
  if (!outDir) return '{projectRoot}/dist';
  const absoluteProjectRoot = resolve(workspaceRoot, projectRoot);
  const absoluteOutput = resolve(absoluteProjectRoot, outDir);
  const fromProject = relative(absoluteProjectRoot, absoluteOutput);
  if (fromProject === '') return '{projectRoot}';
  if (
    !isAbsolute(fromProject) &&
    fromProject !== '..' &&
    !fromProject.startsWith(`..${sep}`)
  ) {
    return `{projectRoot}/${fromProject.split(sep).join('/')}`;
  }
  if (absoluteOutput === resolve(workspaceRoot)) return '{workspaceRoot}';
  return workspaceFileInput(workspaceRoot, absoluteOutput);
}
