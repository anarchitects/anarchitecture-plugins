import {
  createBuiltInProfile,
  createBuiltInStarterProfile,
  BACKEND_LAYERED_3TIER_PRESET_LAYERS,
  BACKEND_LAYERED_DDD_PRESET_LAYERS,
} from '../shared/profile-defaults.js';

export const BACKEND_LAYERED_3TIER_PRESET_NAME = 'backend-layered-3tier';
export const BACKEND_LAYERED_DDD_PRESET_NAME = 'backend-layered-ddd';

export const backendLayered3TierProfile = createBuiltInProfile(
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  'Three-tier backend governance defaults for Nx workspaces.',
  BACKEND_LAYERED_3TIER_PRESET_LAYERS
);

export const backendLayeredDddProfile = createBuiltInProfile(
  BACKEND_LAYERED_DDD_PRESET_NAME,
  'DDD-oriented backend governance defaults for Nx workspaces.',
  BACKEND_LAYERED_DDD_PRESET_LAYERS
);

export function createBackendLayered3TierStarterProfile() {
  return createBuiltInStarterProfile(BACKEND_LAYERED_3TIER_PRESET_LAYERS);
}

export function createBackendLayeredDddStarterProfile() {
  return createBuiltInStarterProfile(BACKEND_LAYERED_DDD_PRESET_LAYERS);
}
