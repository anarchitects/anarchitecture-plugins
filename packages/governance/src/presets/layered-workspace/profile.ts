import { GOVERNANCE_LEGACY_PROFILE_NAME } from '../../profile/runtime-profile.js';
import {
  createBuiltInProfile,
  createBuiltInStarterProfile,
  FRONTEND_LAYERED_PRESET_LAYERS,
} from '../shared/profile-defaults.js';

export const layeredWorkspaceProfile = createBuiltInProfile(
  GOVERNANCE_LEGACY_PROFILE_NAME,
  'Legacy compatibility alias for the frontend-layered governance defaults.',
  FRONTEND_LAYERED_PRESET_LAYERS
);

export function createLayeredWorkspaceStarterProfile() {
  return createBuiltInStarterProfile(FRONTEND_LAYERED_PRESET_LAYERS);
}
