import {
  coreBuiltInRulePack,
  domainBoundaryRule,
  evaluateRulePack,
  layerBoundaryRule,
  missingDomainRule,
  missingLayerRule,
  ownershipPresenceRule,
  projectNameConventionRule,
  tagConventionRule,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from './index.js';
import { resolveBuiltInGovernanceProfile } from '../presets/registry.js';
import {
  bookingTeamOwnership,
  coreTestWorkspace,
} from './testing/workspace.fixtures.js';

describe('Core built-in policy rules', () => {
  const baseProfile: GovernanceProfile = {
    name: 'test-profile',
    boundaryPolicySource: 'profile',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': [],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {} as GovernanceProfile['metrics'],
  };

  const baseWorkspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [
      {
        id: 'booking-feature',
        name: 'booking-feature',
        root: 'libs/booking/feature',
        type: 'library',
        tags: ['domain:booking', 'layer:feature'],
        domain: 'booking',
        layer: 'feature',
        ownership: {
          team: 'booking-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
      {
        id: 'payments-ui',
        name: 'payments-ui',
        root: 'libs/payments/ui',
        type: 'library',
        tags: ['domain:payments', 'layer:ui'],
        domain: 'payments',
        layer: 'ui',
        ownership: {
          team: 'payments-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
      {
        id: 'shared-data',
        name: 'shared-data',
        root: 'libs/shared/data',
        type: 'library',
        tags: ['domain:shared', 'layer:data-access'],
        domain: 'shared',
        layer: 'data-access',
        ownership: {
          team: 'shared-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
    ],
    dependencies: [
      {
        source: 'booking-feature',
        target: 'payments-ui',
        type: 'static',
      },
    ],
  };

  it('does not report a domain violation for allowed domain dependencies', () => {
    const result = domainBoundaryRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          booking: ['payments'],
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports a domain violation for disallowed domain dependencies', () => {
    const result = domainBoundaryRule.evaluate({
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'domain-boundary',
        project: 'booking-feature',
        severity: 'error',
        category: 'boundary',
        details: {
          targetProject: 'payments-ui',
          sourceDomain: 'booking',
          targetDomain: 'payments',
          dependencyType: 'static',
        },
      }),
    ]);
  });

  it('does not report a domain violation when the migrated rule is explicitly disabled', () => {
    const result = domainBoundaryRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'domain-boundary': {
            enabled: false,
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('keeps missing domain behavior compatibility-safe for migrated boundary checks', () => {
    const result = domainBoundaryRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            domain: undefined,
          },
          ...baseWorkspace.projects.slice(1),
        ],
      },
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('does not report a layer violation for allowed layer dependencies', () => {
    const result = layerBoundaryRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          booking: ['payments'],
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports a layer violation for disallowed layer dependencies', () => {
    const result = layerBoundaryRule.evaluate({
      workspace: {
        ...baseWorkspace,
        dependencies: [
          {
            source: 'shared-data',
            target: 'booking-feature',
            type: 'static',
          },
        ],
      },
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          shared: ['booking'],
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'layer-boundary',
        project: 'shared-data',
        severity: 'warning',
        category: 'boundary',
        details: {
          targetProject: 'booking-feature',
          sourceLayer: 'data-access',
          targetLayer: 'feature',
          order: ['app', 'feature', 'ui', 'data-access', 'util'],
        },
      }),
    ]);
  });

  it('does not report a layer violation when the migrated rule is explicitly disabled', () => {
    const result = layerBoundaryRule.evaluate({
      workspace: {
        ...baseWorkspace,
        dependencies: [
          {
            source: 'shared-data',
            target: 'booking-feature',
            type: 'static',
          },
        ],
      },
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          shared: ['booking'],
        },
        rules: {
          'layer-boundary': {
            enabled: false,
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('keeps missing layer behavior compatibility-safe for migrated boundary checks', () => {
    const result = layerBoundaryRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            layer: undefined,
          },
          ...baseWorkspace.projects.slice(1),
        ],
      },
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          booking: ['payments'],
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports an ownership violation when ownership is missing', () => {
    const result = ownershipPresenceRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            ownership: {
              source: 'none',
            },
          },
        ],
        dependencies: [],
      },
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'ownership-presence',
        project: 'booking-feature',
        severity: 'warning',
        category: 'ownership',
      }),
    ]);
  });

  it('does not report an ownership violation when ownership is present', () => {
    const result = ownershipPresenceRule.evaluate({
      workspace: {
        ...baseWorkspace,
        dependencies: [],
      },
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('does not report an ownership violation when the migrated rule is explicitly disabled', () => {
    const result = ownershipPresenceRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            ownership: {
              source: 'none',
            },
          },
        ],
        dependencies: [],
      },
      profile: {
        ...baseProfile,
        rules: {
          'ownership-presence': {
            enabled: false,
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('treats CODEOWNERS-style ownership as present without mutating ownership source metadata', () => {
    const workspace: GovernanceWorkspace = {
      ...baseWorkspace,
      projects: [
        {
          ...baseWorkspace.projects[0],
          ownership: {
            contacts: ['@booking-team'],
            source: 'codeowners',
          },
        },
      ],
      dependencies: [],
    };

    const result = ownershipPresenceRule.evaluate({
      workspace,
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
    expect(workspace.projects[0].ownership?.source).toBe('codeowners');
  });

  it('registers the migrated rules in the built-in core rule pack', () => {
    expect(coreBuiltInRulePack.rules.map((rule) => rule.id)).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
      'project-name-convention',
      'tag-convention',
      'missing-domain',
      'missing-layer',
    ]);
  });

  it('executes the migrated rules through the built-in core rule pack', async () => {
    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            ownership: {
              source: 'none',
            },
          },
          ...baseWorkspace.projects.slice(1),
        ],
        dependencies: [
          {
            source: 'shared-data',
            target: 'booking-feature',
            type: 'static',
          },
        ],
      },
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          '*': [],
        },
      },
    });

    expect(result.violations.map((violation) => violation.ruleId)).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
    ]);
  });

  it('keeps generic convention and metadata rules inactive for the default compatibility profile', async () => {
    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: {
        ...coreTestWorkspace,
        projects: [
          {
            ...coreTestWorkspace.projects[0],
            name: 'BookingUI',
            domain: undefined,
            layer: undefined,
            tags: ['scope:Booking'],
            ownership: bookingTeamOwnership,
          },
        ],
        dependencies: [],
      },
      profile: resolveBuiltInGovernanceProfile('frontend-layered'),
    });

    expect(
      result.violations.filter((violation) =>
        [
          'project-name-convention',
          'tag-convention',
          'missing-domain',
          'missing-layer',
        ].includes(violation.ruleId)
      )
    ).toEqual([]);
  });
});

describe('Generic core convention and metadata rules', () => {
  const baseProfile: GovernanceProfile = {
    name: 'generic-rules-profile',
    boundaryPolicySource: 'profile',
    layers: ['app', 'feature', 'ui'],
    allowedDomainDependencies: {
      '*': ['shared'],
    },
    ownership: {
      required: false,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {} as GovernanceProfile['metrics'],
  };

  const baseWorkspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [
      {
        id: 'booking-ui',
        name: 'booking-ui',
        root: 'libs/booking/ui',
        type: 'library',
        tags: ['scope:booking', 'layer:ui'],
        domain: 'booking',
        layer: 'ui',
        ownership: {
          team: 'booking-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
    ],
    dependencies: [],
  };

  it('keeps project-name-convention inert without explicit configuration', () => {
    const result = projectNameConventionRule.evaluate({
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('accepts project-name-convention matches when configured', () => {
    const result = projectNameConventionRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'project-name-convention': {
            enabled: true,
            options: {
              pattern: '^[a-z-]+$',
            },
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports project-name-convention mismatches when configured', () => {
    const result = projectNameConventionRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            name: 'BookingUI',
          },
        ],
      },
      profile: {
        ...baseProfile,
        rules: {
          'project-name-convention': {
            enabled: true,
            options: {
              pattern: '^[a-z-]+$',
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'project-name-convention',
        project: 'BookingUI',
        category: 'convention',
      }),
    ]);
  });

  it('keeps tag-convention inert without explicit options', () => {
    const result = tagConventionRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'tag-convention': {
            enabled: true,
            options: {},
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports missing required tag prefixes', () => {
    const result = tagConventionRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'tag-convention': {
            enabled: true,
            options: {
              requiredPrefixes: ['domain'],
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'tag-convention',
        project: 'booking-ui',
        category: 'metadata',
      }),
    ]);
  });

  it('reports disallowed tag prefixes', () => {
    const result = tagConventionRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'tag-convention': {
            enabled: true,
            options: {
              allowedPrefixes: ['domain', 'type'],
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'tag-convention',
        project: 'booking-ui',
        details: expect.objectContaining({
          tag: 'scope:booking',
          prefix: 'scope',
        }),
      }),
      expect.objectContaining({
        ruleId: 'tag-convention',
        project: 'booking-ui',
        details: expect.objectContaining({
          tag: 'layer:ui',
          prefix: 'layer',
        }),
      }),
    ]);
  });

  it('reports tag value pattern mismatches', () => {
    const result = tagConventionRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            tags: ['scope:Booking'],
          },
        ],
      },
      profile: {
        ...baseProfile,
        rules: {
          'tag-convention': {
            enabled: true,
            options: {
              valuePattern: '^[a-z-]+$',
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'tag-convention',
        project: 'booking-ui',
        details: expect.objectContaining({
          tag: 'scope:Booking',
          value: 'Booking',
        }),
      }),
    ]);
  });

  it('keeps missing-domain inert when not required', () => {
    const result = missingDomainRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            domain: undefined,
          },
        ],
      },
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports missing-domain when required and missing', () => {
    const result = missingDomainRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            domain: undefined,
          },
        ],
      },
      profile: {
        ...baseProfile,
        rules: {
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'missing-domain',
        project: 'booking-ui',
      }),
    ]);
  });

  it('does not report missing-domain when required and present', () => {
    const result = missingDomainRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('keeps missing-layer inert when not required', () => {
    const result = missingLayerRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            layer: undefined,
          },
        ],
      },
      profile: baseProfile,
    });

    expect(result.violations ?? []).toEqual([]);
  });

  it('reports missing-layer when required and missing', () => {
    const result = missingLayerRule.evaluate({
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            layer: undefined,
          },
        ],
      },
      profile: {
        ...baseProfile,
        rules: {
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'missing-layer',
        project: 'booking-ui',
      }),
    ]);
  });

  it('does not report missing-layer when required and present', () => {
    const result = missingLayerRule.evaluate({
      workspace: baseWorkspace,
      profile: {
        ...baseProfile,
        rules: {
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations ?? []).toEqual([]);
  });
});
