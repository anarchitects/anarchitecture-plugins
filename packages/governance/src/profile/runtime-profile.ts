import { dirname, join, posix } from 'node:path';

import type { ProfileOverrides } from '@anarchitects/governance-core';

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

export type GovernanceBoundaryPolicySource = 'profile' | 'eslint';

export interface GovernanceProfileFile
  extends Omit<ProfileOverrides, 'nodeOverrides'> {
  boundaryPolicySource?: GovernanceBoundaryPolicySource;
  nodeOverrides?: ProfileOverrides['nodeOverrides'];
  eslint?: {
    helperPath?: string;
  };
  runtime?: GovernanceProfileRuntimeConfig;
  composition?: GovernanceLegacyProfileComposition;
}

export interface GovernanceProfileRuntimeConfig {
  renderers?: GovernanceProfileRendererRegistration[];
  settings?: Record<string, unknown>;
}

// Deprecated compatibility shape for legacy runtime profile files. Extension
// activation now belongs under nx.json.governance rather than profile policy.
export interface GovernanceLegacyProfileComposition {
  extensions?: GovernanceProfileExtensionRegistration[];
  renderers?: GovernanceProfileRendererRegistration[];
  settings?: Record<string, unknown>;
  legacyPluginProbing?: boolean;
}

export interface GovernanceProfileExtensionRegistration {
  package: string;
  optional?: boolean;
  options?: Record<string, unknown>;
}

export interface GovernanceProfileRendererRegistration {
  id: GovernanceProfileRendererId;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

export type GovernanceProfileRendererId =
  | 'cli'
  | 'json'
  | 'governance-graph'
  | 'management-report'
  | 'ai-handoff';

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
