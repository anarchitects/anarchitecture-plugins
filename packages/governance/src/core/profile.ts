import { HealthStatusThresholds } from './models.js';

export const DEFAULT_HEALTH_STATUS_THRESHOLDS: HealthStatusThresholds = {
  goodMinScore: 85,
  warningMinScore: 70,
};

export interface GovernanceProfile {
  name: string;
  description?: string;
  boundaryPolicySource: 'profile' | 'eslint';
  layers: string[];
  allowedDomainDependencies: Record<string, string[]>;
  ownership: {
    required: boolean;
    metadataField: string;
  };
  health: {
    statusThresholds: HealthStatusThresholds;
  };
  metrics: {
    architecturalEntropyWeight: number;
    dependencyComplexityWeight: number;
    domainIntegrityWeight: number;
    ownershipCoverageWeight: number;
    documentationCompletenessWeight: number;
    layerIntegrityWeight: number;
  };
}

export interface ProfileOverrides {
  boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
  layers?: string[];
  allowedDomainDependencies?: Record<string, string[]>;
  ownership?: Partial<GovernanceProfile['ownership']>;
  health?: {
    statusThresholds?: Partial<HealthStatusThresholds>;
  };
  metrics?: Partial<GovernanceProfile['metrics']>;
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
