// SPDX-License-Identifier: MIT
import {
  readJsonFile,
  type CreateNodesContext,
  type ProjectConfiguration,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Read project named inputs relative to the workspace, independent of process.cwd(). */
export function readNamedInputs(
  projectRoot: string,
  context: CreateNodesContext
): NonNullable<ProjectConfiguration['namedInputs']> {
  const packagePath = join(context.workspaceRoot, projectRoot, 'package.json');
  const projectPath = join(context.workspaceRoot, projectRoot, 'project.json');
  const packageConfig = existsSync(packagePath)
    ? readJsonFile<{ nx?: Pick<ProjectConfiguration, 'namedInputs'> }>(
        packagePath
      )
    : undefined;
  const projectConfig = existsSync(projectPath)
    ? readJsonFile<Pick<ProjectConfiguration, 'namedInputs'>>(projectPath)
    : undefined;

  return {
    ...context.nxJsonConfiguration.namedInputs,
    ...packageConfig?.nx?.namedInputs,
    ...projectConfig?.namedInputs,
  };
}
