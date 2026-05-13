import {
  coreBuiltInRulePack,
  domainBoundaryRule,
  evaluateRulePack,
  layerBoundaryRule,
  ownershipPresenceRule,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from './index.js';

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

  it('registers the migrated rules in the built-in core rule pack', () => {
    expect(coreBuiltInRulePack.rules.map((rule) => rule.id)).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
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
});
