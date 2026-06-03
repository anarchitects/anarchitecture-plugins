import { workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

import {
  parseGovernanceExtensionConfig,
  type GovernanceExtensionConfig,
  type GovernanceExtensionConfigInput,
} from '../../extensions/config.js';
import type { GovernanceProfileComposition } from '../../profile/runtime-profile.js';

interface NxJsonShape {
  governance?: GovernanceExtensionConfigInput;
}

export interface LoadGovernanceExtensionConfigOptions {
  workspaceRoot?: string;
  nxJson?: NxJsonShape;
  profileComposition?: GovernanceProfileComposition;
}

export function loadGovernanceExtensionConfig(
  options: LoadGovernanceExtensionConfigOptions = {}
): GovernanceExtensionConfig {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  const nxConfig = parseGovernanceExtensionConfig(nxJson.governance);

  return mergeProfileAndNxExtensionConfig(options.profileComposition, nxConfig);
}

function mergeProfileAndNxExtensionConfig(
  profileComposition: GovernanceProfileComposition | undefined,
  nxConfig: GovernanceExtensionConfig
): GovernanceExtensionConfig {
  const profileExtensions = profileComposition?.extensions ?? [];
  const extensions = [
    ...profileExtensions,
    ...nxConfig.extensions.filter(
      (nxExtension) =>
        !profileExtensions.some(
          (profileExtension) => profileExtension.package === nxExtension.package
        )
    ),
  ];
  const legacyPluginProbing =
    profileComposition?.legacyPluginProbing ?? nxConfig.legacyPluginProbing;

  return {
    extensions,
    ...(legacyPluginProbing !== undefined ? { legacyPluginProbing } : {}),
  };
}

function readNxJson(workspaceRoot = defaultWorkspaceRoot): NxJsonShape {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');

  try {
    return JSON.parse(fs.readFileSync(nxJsonPath, 'utf8')) as NxJsonShape;
  } catch (error) {
    throw new Error(
      `Unable to read governance extension config from ${nxJsonPath}: ${toErrorMessage(
        error
      )}`
    );
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
