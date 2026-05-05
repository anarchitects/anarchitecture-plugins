import {
  DEFAULT_HEALTH_STATUS_THRESHOLDS,
  GovernanceProfile,
  Measurement,
} from '../../core/index.js';
import type { GovernanceProfileFile } from '../../profile/runtime-profile.js';

export const FRONTEND_LAYERED_PRESET_LAYERS = [
  'app',
  'feature',
  'ui',
  'data-access',
  'util',
] as const;

export const BACKEND_LAYERED_3TIER_PRESET_LAYERS = [
  'api',
  'service',
  'data-access',
] as const;

export const BACKEND_LAYERED_DDD_PRESET_LAYERS = [
  'api',
  'application',
  'domain',
  'infrastructure',
] as const;

export const BASE_PROFILE_METRICS: Record<Measurement['id'], number> = {
  'architectural-entropy': 0.2,
  'dependency-complexity': 0.2,
  'domain-integrity': 0.2,
  'ownership-coverage': 0.2,
  'documentation-completeness': 0.2,
  'layer-integrity': 0.2,
};

export const BASE_PROFILE_OWNERSHIP: GovernanceProfile['ownership'] = {
  required: true,
  metadataField: 'ownership',
};

export const BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES: Record<
  string,
  string[]
> = {
  '*': ['shared'],
};

export const BASE_HEALTH_THRESHOLDS = DEFAULT_HEALTH_STATUS_THRESHOLDS;

export function createBuiltInProfile(
  name: string,
  description: string,
  layers: readonly string[]
): GovernanceProfile {
  return {
    name,
    description,
    boundaryPolicySource: 'profile',
    layers: [...layers],
    allowedDomainDependencies: BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES,
    ownership: BASE_PROFILE_OWNERSHIP,
    health: {
      statusThresholds: BASE_HEALTH_THRESHOLDS,
    },
    metrics: BASE_PROFILE_METRICS,
  };
}

export function createBuiltInStarterProfile(
  layers: readonly string[]
): GovernanceProfileFile {
  return {
    boundaryPolicySource: 'eslint',
    layers: [...layers],
    allowedDomainDependencies: BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES,
    ownership: BASE_PROFILE_OWNERSHIP,
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {
      architecturalEntropyWeight: 0.2,
      dependencyComplexityWeight: 0.2,
      domainIntegrityWeight: 0.2,
      ownershipCoverageWeight: 0.2,
      documentationCompletenessWeight: 0.2,
      layerIntegrityWeight: 0.2,
    },
    projectOverrides: {},
  };
}
