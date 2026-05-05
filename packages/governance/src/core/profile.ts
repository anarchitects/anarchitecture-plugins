import { GovernanceException } from './exceptions.js';
import { HealthStatusThresholds, Measurement } from './models.js';

export const DEFAULT_HEALTH_STATUS_THRESHOLDS: HealthStatusThresholds = {
  goodMinScore: 85,
  warningMinScore: 70,
};

export type AllowedLayerDependencies = Record<string, string[]>;

export interface GovernanceProfile {
  name: string;
  description?: string;
  boundaryPolicySource: 'profile' | 'eslint';
  layers: string[];
  allowedLayerDependencies?: AllowedLayerDependencies;
  allowedDomainDependencies: Record<string, string[]>;
  ownership: {
    required: boolean;
    metadataField: string;
  };
  health: {
    statusThresholds: HealthStatusThresholds;
  };
  metrics: Record<Measurement['id'], number>;
}

export interface ProfileOverrides {
  boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
  layers?: string[];
  allowedLayerDependencies?: AllowedLayerDependencies;
  allowedDomainDependencies?: Record<string, string[]>;
  ownership?: Partial<GovernanceProfile['ownership']>;
  health?: {
    statusThresholds?: Partial<HealthStatusThresholds>;
  };
  metrics?: Partial<Record<string, number>>;
  exceptions?: GovernanceException[];
  projectOverrides: Record<
    string,
    {
      domain?: string;
      layer?: string;
      ownershipTeam?: string;
      documentation?: boolean;
    }
  >;
}

export function deriveAllowedLayerDependenciesFromLayerOrder(
  layers: string[]
): AllowedLayerDependencies {
  return Object.fromEntries(
    layers.map((sourceLayer, index) => [sourceLayer, layers.slice(index)])
  );
}
