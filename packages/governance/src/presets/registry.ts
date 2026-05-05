import {
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_LEGACY_PROFILE_NAME,
  type GovernanceProfileFile,
} from '../profile/runtime-profile.js';
import {
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  BACKEND_LAYERED_DDD_PRESET_NAME,
  backendLayered3TierProfile,
  backendLayeredDddProfile,
  createBackendLayered3TierStarterProfile,
  createBackendLayeredDddStarterProfile,
} from './backend-layered/profile.js';
import {
  createFrontendLayeredStarterProfile,
  frontendLayeredProfile,
} from './frontend-layered/profile.js';
import {
  createLayeredWorkspaceStarterProfile,
  layeredWorkspaceProfile,
} from './layered-workspace/profile.js';
import type { GovernanceProfile } from '../core/index.js';

export { BACKEND_LAYERED_3TIER_PRESET_NAME, BACKEND_LAYERED_DDD_PRESET_NAME };

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

  if (selection === GOVERNANCE_LEGACY_PROFILE_NAME) {
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

const BUILT_IN_GOVERNANCE_STARTER_PROFILE_FACTORIES: Record<
  GovernanceStarterPresetName,
  () => GovernanceProfileFile
> = {
  [GOVERNANCE_DEFAULT_PROFILE_NAME]: createFrontendLayeredStarterProfile,
  [BACKEND_LAYERED_3TIER_PRESET_NAME]: createBackendLayered3TierStarterProfile,
  [BACKEND_LAYERED_DDD_PRESET_NAME]: createBackendLayeredDddStarterProfile,
};

export function resolveBuiltInGovernanceProfile(
  profileName: string
): GovernanceProfile {
  return BUILT_IN_GOVERNANCE_PROFILES[profileName] ?? frontendLayeredProfile;
}

export function createBuiltInGovernanceStarterProfile(
  profileName: string
): GovernanceProfileFile {
  if (profileName === GOVERNANCE_LEGACY_PROFILE_NAME) {
    return createLayeredWorkspaceStarterProfile();
  }

  const presetName =
    resolveGovernanceStarterPresetName(profileName) ??
    GOVERNANCE_DEFAULT_PROFILE_NAME;

  return BUILT_IN_GOVERNANCE_STARTER_PROFILE_FACTORIES[presetName]();
}
