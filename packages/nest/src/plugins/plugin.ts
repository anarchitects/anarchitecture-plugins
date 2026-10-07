// SPDX-License-Identifier: MIT

import { createNodesFromFiles, type CreateNodesV2 } from '@nx/devkit';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  getNestProjectRoot,
  hasProjectManifest,
} from '../utils/project-discovery';

export const name = '@anarchitects/nest/plugin';

export const createNodesV2: CreateNodesV2 = [
  '**/nest-cli.json',
  async (configFiles, options, context) => {
    const projectConfigFiles = configFiles
      .filter((configFile) => {
        const projectRoot = getNestProjectRoot(configFile);
        if (projectRoot === undefined) return false;

        const absoluteRoot = join(context.workspaceRoot, projectRoot);
        return (
          existsSync(absoluteRoot) &&
          hasProjectManifest(
            readdirSync(absoluteRoot, { withFileTypes: true })
              .filter((entry) => entry.isFile())
              .map((entry) => entry.name)
          )
        );
      })
      .sort();

    return createNodesFromFiles(
      (configFile) => {
        const projectRoot = getNestProjectRoot(configFile);
        if (projectRoot === undefined) return {};
        return {
          projects: {
            [projectRoot]: {
              root: projectRoot,
              // Names and explicit configuration are merged by Nx's built-in plugins.
              metadata: { technologies: ['nest'] },
            },
          },
        };
      },
      projectConfigFiles,
      options,
      context
    );
  },
];

export const createNodes = createNodesV2;
