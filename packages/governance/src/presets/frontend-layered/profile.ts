import {
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_LEGACY_PROFILE_NAME,
} from '../../profile/runtime-profile.js';
import type { GovernanceProfileFile } from '../../profile/runtime-profile.js';
import type { GovernanceProfile } from '../../core/index.js';
import type { ResolvedProfileOverrides } from '../../profile/load-profile-overrides.js';
import {
  createBuiltInProfile,
  createBuiltInStarterProfile,
  FRONTEND_LAYERED_PRESET_LAYERS,
} from '../shared/profile-defaults.js';
import {
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  BACKEND_LAYERED_DDD_PRESET_NAME,
  backendLayered3TierProfile,
  backendLayeredDddProfile,
  createBackendLayered3TierStarterProfile,
  createBackendLayeredDddStarterProfile,
} from '../backend-layered/profile.js';
import {
  createLayeredWorkspaceStarterProfile,
  layeredWorkspaceProfile,
} from '../layered-workspace/profile.js';

export const frontendLayeredProfile = createBuiltInProfile(
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  'Layered frontend-oriented governance defaults for Nx workspaces.',
  FRONTEND_LAYERED_PRESET_LAYERS
);

export function createFrontendLayeredStarterProfile() {
  return createBuiltInStarterProfile(FRONTEND_LAYERED_PRESET_LAYERS);
}

export {
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  BACKEND_LAYERED_DDD_PRESET_NAME,
  backendLayered3TierProfile,
  backendLayeredDddProfile,
  createBackendLayered3TierStarterProfile,
  createBackendLayeredDddStarterProfile,
  createLayeredWorkspaceStarterProfile,
  layeredWorkspaceProfile,
};

export const GOVERNANCE_STARTER_PRESET_NAMES = [
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  BACKEND_LAYERED_DDD_PRESET_NAME,
] as const;

export type GovernanceStarterPresetName =
  (typeof GOVERNANCE_STARTER_PRESET_NAMES)[number];

export function isGovernanceStarterPresetName(
  value: string
): value is GovernanceStarterPresetName {
  return (GOVERNANCE_STARTER_PRESET_NAMES as readonly string[]).includes(value);
}

export function resolveGovernanceStarterPresetName(
  selection?: string
): GovernanceStarterPresetName | null {
  if (!selection) {
    return null;
  }

  if (selection === 'layered-workspace') {
    return GOVERNANCE_DEFAULT_PROFILE_NAME;
  }

  return isGovernanceStarterPresetName(selection) ? selection : null;
}

const BUILT_IN_GOVERNANCE_PROFILES: Record<string, GovernanceProfile> = {
  [GOVERNANCE_DEFAULT_PROFILE_NAME]: frontendLayeredProfile,
  [GOVERNANCE_LEGACY_PROFILE_NAME]: layeredWorkspaceProfile,
  [BACKEND_LAYERED_3TIER_PRESET_NAME]: backendLayered3TierProfile,
  [BACKEND_LAYERED_DDD_PRESET_NAME]: backendLayeredDddProfile,
};

const BUILT_IN_GOVERNANCE_STARTER_PROFILE_FACTORIES = {
  [GOVERNANCE_DEFAULT_PROFILE_NAME]: createFrontendLayeredStarterProfile,
  [BACKEND_LAYERED_3TIER_PRESET_NAME]: createBackendLayered3TierStarterProfile,
  [BACKEND_LAYERED_DDD_PRESET_NAME]: createBackendLayeredDddStarterProfile,
} satisfies Record<GovernanceStarterPresetName, () => GovernanceProfileFile>;

export function resolveBuiltInGovernanceProfile(
  profileName: string
): GovernanceProfile {
  return BUILT_IN_GOVERNANCE_PROFILES[profileName] ?? frontendLayeredProfile;
}

export function createBuiltInGovernanceStarterProfile(
  profileName: string
): GovernanceProfileFile {
  const presetName =
    resolveGovernanceStarterPresetName(profileName) ??
    GOVERNANCE_DEFAULT_PROFILE_NAME;

  return BUILT_IN_GOVERNANCE_STARTER_PROFILE_FACTORIES[presetName]();
}

export type { ResolvedProfileOverrides };

export async function loadProfileOverrides(
  workspaceRoot: string,
  profileName: string
): Promise<ResolvedProfileOverrides> {
  const { loadProfileOverrides: loadProfileOverridesImpl } = await import(
    '../../profile/load-profile-overrides.js'
  );

  return loadProfileOverridesImpl(workspaceRoot, profileName);
}
