import { GovernanceException } from './exceptions.js';
import { HealthStatusThresholds, Measurement, Violation } from './models.js';

export const DEFAULT_HEALTH_STATUS_THRESHOLDS: HealthStatusThresholds = {
  goodMinScore: 85,
  warningMinScore: 70,
};

export type AllowedLayerDependencies = Record<string, string[]>;

export interface GovernanceProjectOverride {
  domain?: string;
  layer?: string;
  ownershipTeam?: string;
  documentation?: boolean;
}

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

export interface GovernanceRuleConfig<TOptions = unknown> {
  enabled?: boolean;
  severity?: Violation['severity'];
  options?: TOptions;
}

export interface GovernanceDomainBoundaryRuleOptions {
  allowedDependencies: Record<string, string[]>;
}

export interface GovernanceLayerBoundaryRuleOptions {
  allowedDependencies: AllowedLayerDependencies;
  layers: string[];
  usesExplicitDependencies: boolean;
}

export interface GovernanceOwnershipPresenceRuleOptions {
  required: boolean;
  metadataField: string;
}

export interface GovernanceScoringProfile {
  statusThresholds: HealthStatusThresholds;
  metricWeights: Record<Measurement['id'], number>;
}

export interface GovernanceProfileCompatibility {
  boundaryPolicySource: GovernanceProfile['boundaryPolicySource'];
}

export interface NormalizedGovernanceProfile {
  name: string;
  description?: string;
  rules: Record<string, GovernanceRuleConfig>;
  scoring: GovernanceScoringProfile;
  exceptions: GovernanceException[];
  projectOverrides: Record<string, GovernanceProjectOverride>;
  compatibility: GovernanceProfileCompatibility;
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
  projectOverrides: Record<string, GovernanceProjectOverride>;
}

export function deriveAllowedLayerDependenciesFromLayerOrder(
  layers: string[]
): AllowedLayerDependencies {
  return Object.fromEntries(
    layers.map((sourceLayer, index) => [sourceLayer, layers.slice(index)])
  );
}

export function normalizeGovernanceProfile(
  profile: GovernanceProfile,
  options: Partial<
    Pick<ProfileOverrides, 'exceptions' | 'projectOverrides'>
  > = {}
): NormalizedGovernanceProfile {
  const allowedLayerDependencies =
    profile.allowedLayerDependencies ??
    deriveAllowedLayerDependenciesFromLayerOrder(profile.layers);

  return {
    name: profile.name,
    description: profile.description,
    rules: {
      'domain-boundary': {
        enabled: true,
        severity: 'error',
        options: {
          allowedDependencies: profile.allowedDomainDependencies,
        } satisfies GovernanceDomainBoundaryRuleOptions,
      },
      'layer-boundary': {
        enabled: true,
        severity: 'warning',
        options: {
          allowedDependencies: allowedLayerDependencies,
          layers: [...profile.layers],
          usesExplicitDependencies:
            profile.allowedLayerDependencies !== undefined,
        } satisfies GovernanceLayerBoundaryRuleOptions,
      },
      'ownership-presence': {
        enabled: true,
        severity: 'warning',
        options: {
          required: profile.ownership.required,
          metadataField: profile.ownership.metadataField,
        } satisfies GovernanceOwnershipPresenceRuleOptions,
      },
    },
    scoring: {
      statusThresholds: profile.health.statusThresholds,
      metricWeights: profile.metrics,
    },
    exceptions: options.exceptions ?? [],
    projectOverrides: options.projectOverrides ?? {},
    compatibility: {
      boundaryPolicySource: profile.boundaryPolicySource,
    },
  };
}
