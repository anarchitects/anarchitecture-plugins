import { join } from 'node:path';

import type { GovernanceProfile, ProfileOverrides } from '../core/index.js';

// Profiles are user-owned runtime governance configuration files. Presets may
// seed these files during init, but executors always resolve runtime behavior
// from the selected profile file.
export const GOVERNANCE_PROFILE_DIRECTORY = 'tools/governance/profiles';
export const GOVERNANCE_DEFAULT_PROFILE_NAME = 'angular-cleanup';

export interface GovernanceProfileFile extends ProfileOverrides {
  boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
}

export function resolveGovernanceProfileRelativePath(
  profileName: string
): string {
  return `${GOVERNANCE_PROFILE_DIRECTORY}/${profileName}.json`;
}

export function resolveGovernanceProfilePath(
  workspaceRoot: string,
  profileName: string
): string {
  return join(
    workspaceRoot,
    GOVERNANCE_PROFILE_DIRECTORY,
    `${profileName}.json`
  );
}
