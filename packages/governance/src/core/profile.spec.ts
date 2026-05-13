import type { GovernanceException } from './exceptions.js';
import {
  normalizeGovernanceProfile,
  type GovernanceProfile,
  type GovernanceProjectOverride,
} from './index.js';
import { resolveBuiltInGovernanceProfile } from '../presets/registry.js';

describe('normalizeGovernanceProfile', () => {
  const baseProfile: GovernanceProfile = {
    name: 'test-profile',
    description: 'Profile normalization test fixture',
    boundaryPolicySource: 'profile',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': ['shared'],
      booking: ['payments'],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 90,
        warningMinScore: 75,
      },
    },
    metrics: {
      'architectural-entropy': 0.4,
      'dependency-complexity': 0.3,
      'domain-integrity': 0.5,
      'ownership-coverage': 0.2,
      'documentation-completeness': 0.1,
      'layer-integrity': 0.6,
    },
  };

  it('maps current-shape profiles to domain-boundary rule config', () => {
    const normalized = normalizeGovernanceProfile(baseProfile);

    expect(normalized.rules['domain-boundary']).toEqual({
      enabled: true,
      severity: 'error',
      options: {
        allowedDependencies: baseProfile.allowedDomainDependencies,
      },
    });
  });

  it('maps current-shape profiles to layer-boundary rule config', () => {
    const normalized = normalizeGovernanceProfile({
      ...baseProfile,
      allowedLayerDependencies: {
        feature: ['ui'],
        app: ['feature', 'ui'],
      },
    });

    expect(normalized.rules['layer-boundary']).toEqual({
      enabled: true,
      severity: 'warning',
      options: {
        allowedDependencies: {
          feature: ['ui'],
          app: ['feature', 'ui'],
        },
        layers: ['app', 'feature', 'ui', 'data-access', 'util'],
        usesExplicitDependencies: true,
      },
    });
  });

  it('maps ownership settings to ownership-presence rule config', () => {
    const normalized = normalizeGovernanceProfile(baseProfile);

    expect(normalized.rules['ownership-presence']).toEqual({
      enabled: true,
      severity: 'warning',
      options: {
        required: true,
        metadataField: 'ownership',
      },
    });
  });

  it('preserves scoring thresholds and metric weights', () => {
    const normalized = normalizeGovernanceProfile(baseProfile);

    expect(normalized.scoring).toEqual({
      statusThresholds: {
        goodMinScore: 90,
        warningMinScore: 75,
      },
      metricWeights: baseProfile.metrics,
    });
  });

  it('preserves exceptions and project overrides from compatibility inputs', () => {
    const exceptions: GovernanceException[] = [
      {
        id: 'policy-exception',
        source: 'policy',
        scope: {
          source: 'policy',
          ruleId: 'domain-boundary',
          projectId: 'booking-feature',
          targetProjectId: 'payments-ui',
        },
        reason: 'Known transition.',
        owner: '@org/architecture',
        review: {
          reviewBy: '2026-07-01',
        },
      },
    ];
    const projectOverrides: Record<string, GovernanceProjectOverride> = {
      'booking-feature': {
        domain: 'booking',
        documentation: true,
      },
    };

    const normalized = normalizeGovernanceProfile(baseProfile, {
      exceptions,
      projectOverrides,
    });

    expect(normalized.exceptions).toEqual(exceptions);
    expect(normalized.projectOverrides).toEqual(projectOverrides);
  });

  it('ignores unknown extra fields without breaking normalization', () => {
    const normalized = normalizeGovernanceProfile({
      ...baseProfile,
      experimentalField: {
        enabled: true,
      },
    } as GovernanceProfile & {
      experimentalField: { enabled: boolean };
    });

    expect(normalized.name).toBe('test-profile');
    expect(normalized.rules['domain-boundary']).toBeDefined();
  });

  it('preserves explicit generic rule configuration for opt-in rules', () => {
    const normalized = normalizeGovernanceProfile({
      ...baseProfile,
      rules: {
        'project-name-convention': {
          enabled: true,
          severity: 'info',
          options: {
            pattern: '^[a-z-]+$',
          },
        },
        'missing-domain': {
          enabled: true,
          options: {
            required: true,
          },
        },
      },
    });

    expect(normalized.rules['project-name-convention']).toEqual({
      enabled: true,
      severity: 'info',
      options: {
        pattern: '^[a-z-]+$',
      },
    });
    expect(normalized.rules['missing-domain']).toEqual({
      enabled: true,
      options: {
        required: true,
      },
    });
  });

  it('normalizes built-in presets without changing default rule activation', () => {
    const presetNames = [
      'frontend-layered',
      'layered-workspace',
      'backend-layered-3tier',
      'backend-layered-ddd',
    ];

    for (const profileName of presetNames) {
      const normalized = normalizeGovernanceProfile(
        resolveBuiltInGovernanceProfile(profileName)
      );

      expect(normalized.rules['domain-boundary']?.enabled).toBe(true);
      expect(normalized.rules['layer-boundary']?.enabled).toBe(true);
      expect(normalized.rules['ownership-presence']?.enabled).toBe(true);
      expect(normalized.compatibility.boundaryPolicySource).toBe(
        resolveBuiltInGovernanceProfile(profileName).boundaryPolicySource
      );
    }
  });

  it('does not activate #245 convention or metadata rules by default', () => {
    const normalized = normalizeGovernanceProfile(baseProfile);

    expect(Object.keys(normalized.rules).sort()).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
    ]);
    expect(normalized.rules['project-name-convention']).toBeUndefined();
    expect(normalized.rules['metadata-presence']).toBeUndefined();
  });

  it('keeps starter presets compatibility-safe by leaving opt-in generic rules disabled', () => {
    const normalized = normalizeGovernanceProfile(
      resolveBuiltInGovernanceProfile('frontend-layered')
    );

    expect(normalized.rules['project-name-convention']).toBeUndefined();
    expect(normalized.rules['tag-convention']).toBeUndefined();
    expect(normalized.rules['missing-domain']).toBeUndefined();
    expect(normalized.rules['missing-layer']).toBeUndefined();
  });
});
