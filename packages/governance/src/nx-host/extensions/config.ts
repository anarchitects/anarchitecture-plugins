import { workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

import {
  parseGovernanceExtensionConfig,
  type GovernanceExtensionConfig,
  type GovernanceExtensionConfigInput,
} from '../../extensions/config.js';

interface NxJsonShape {
  governance?: GovernanceExtensionConfigInput;
}

export interface LoadGovernanceExtensionConfigOptions {
  workspaceRoot?: string;
  nxJson?: NxJsonShape;
}

export function loadGovernanceExtensionConfig(
  options: LoadGovernanceExtensionConfigOptions = {}
): GovernanceExtensionConfig {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  return parseGovernanceExtensionConfig(nxJson.governance);
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
