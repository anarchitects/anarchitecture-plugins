import { dirname, join, posix } from 'node:path';

import type { GovernanceProfile, ProfileOverrides } from '../core/index.js';

// Profiles are user-owned runtime governance configuration files. Presets may
// seed these files during init, but executors always resolve runtime behavior
// from the selected profile file.
export const GOVERNANCE_PROFILE_DIRECTORY = 'tools/governance/profiles';
export const GOVERNANCE_DEFAULT_PROFILE_NAME = 'frontend-layered';
export const GOVERNANCE_LEGACY_PROFILE_NAME = 'layered-workspace';
export const GOVERNANCE_DEFAULT_ESLINT_CONFIG_PATH = 'eslint.config.mjs';
export const GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH =
  'tools/governance/eslint/dependency-constraints.mjs';
export const GOVERNANCE_SUPPORTED_FLAT_ESLINT_CONFIG_PATHS = [
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.js',
] as const;

export interface GovernanceProfileFile extends ProfileOverrides {
  boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
  eslint?: {
    helperPath?: string;
  };
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

export function resolveGovernanceSelectedProfileRelativePath(options?: {
  profile?: string;
  profilePath?: string;
}): string {
  if (options?.profilePath) {
    return normalizeWorkspaceRelativePath(options.profilePath);
  }

  return resolveGovernanceProfileRelativePath(
    options?.profile ?? GOVERNANCE_DEFAULT_PROFILE_NAME
  );
}

export function resolveGovernanceProfilesDirectoryFromPath(
  profilePath: string
): string {
  return normalizeWorkspaceRelativePath(dirname(profilePath));
}

export function toRelativeModuleSpecifier(
  fromFilePath: string,
  toFilePath: string
): string {
  const fromDir = posix.dirname(normalizeWorkspaceRelativePath(fromFilePath));
  const toPath = normalizeWorkspaceRelativePath(toFilePath);
  const relativePath = posix.relative(fromDir, toPath);

  if (relativePath === '') {
    return './';
  }

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

export function normalizeWorkspaceRelativePath(path: string): string {
  return path.replace(/\\/g, '/');
}
