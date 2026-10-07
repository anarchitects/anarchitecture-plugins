// SPDX-License-Identifier: MIT
import { readJsonFile } from '@nx/devkit';
import { existsSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import * as ts from 'typescript';
import {
  normalizeBuildOutput,
  selectTsConfigPath,
  workspaceFileInput,
  type NestCliConfig,
} from './build-outputs';

export interface NestBuildOutputs {
  outputs: string[];
  configInputs: string[];
  /** Let Nx hash all external dependencies when installed config packages are read. */
  usesPackageConfigs?: boolean;
}

/** Read configuration only: no CLI execution, compiler emit, or filesystem writes. */
export function readBuildOutputs(
  workspaceRoot: string,
  projectRoot: string,
  nativeProjectName?: string
): NestBuildOutputs {
  // TypeScript resolves package-based extends through real paths. Use the same
  // workspace identity even when the checkout itself is reached via a symlink.
  const realWorkspaceRoot = realpathSync(workspaceRoot);
  const absoluteRoot = resolve(realWorkspaceRoot, projectRoot);
  const nestConfig = readJsonFile<NestCliConfig>(
    join(absoluteRoot, 'nest-cli.json')
  );
  const configPath = resolve(
    absoluteRoot,
    selectTsConfigPath(
      nativeProjectName
        ? {
            ...nestConfig,
            compilerOptions: {
              ...nestConfig.compilerOptions,
              ...nestConfig.projects?.[nativeProjectName]?.compilerOptions,
            },
          }
        : nestConfig,
      existsSync(join(absoluteRoot, 'tsconfig.build.json'))
    )
  );
  const configFiles = new Set<string>();
  let outDir: string | undefined;

  if (existsSync(configPath)) {
    const parsed = ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      {
        ...ts.sys,
        // Only compiler options are needed, so do not scan the project's source tree.
        readDirectory: () => [],
        readFile: (path) => {
          const contents = ts.sys.readFile(path);
          if (contents !== undefined) configFiles.add(resolve(path));
          return contents;
        },
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw configError(configPath, [diagnostic]);
        },
      }
    );
    // Empty files/include lists are expected in solution configs and during setup.
    const errors =
      parsed?.errors.filter(({ code }) => code !== 18002 && code !== 18003) ??
      [];
    if (errors.length) throw configError(configPath, errors);
    outDir = parsed?.options.outDir;
    const lexicalRoot = resolve(workspaceRoot);
    if (outDir === lexicalRoot) outDir = realWorkspaceRoot;
    else if (outDir?.startsWith(`${lexicalRoot}${sep}`)) {
      outDir = join(realWorkspaceRoot, outDir.slice(lexicalRoot.length + 1));
    }
  }

  return {
    outputs: [normalizeBuildOutput(realWorkspaceRoot, projectRoot, outDir)],
    ...([...configFiles].some((path) =>
      path.split(sep).includes('node_modules')
    )
      ? { usesPackageConfigs: true }
      : {}),
    configInputs: [...configFiles]
      .filter(
        (path) =>
          !relative(realWorkspaceRoot, path).split(sep).includes('node_modules')
      )
      .sort()
      .map((path) => workspaceFileInput(realWorkspaceRoot, path)),
  };
}

function configError(
  path: string,
  diagnostics: readonly ts.Diagnostic[]
): Error {
  return new Error(
    `Cannot resolve Nest TypeScript configuration ${path}: ${diagnostics
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      )
      .join('\n')}`
  );
}
