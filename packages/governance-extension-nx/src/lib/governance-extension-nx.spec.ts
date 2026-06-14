import type {
  GovernanceCapability,
  GovernanceExtensionHost,
  GovernanceExtensionHostContext,
  GovernanceMetricProvider,
  GovernanceSignalProvider,
  GovernanceWorkspace,
  GovernanceWorkspaceEnricher,
} from '@anarchitects/governance-core';

import {
  GOVERNANCE_EXTENSION_NX_ID,
  GOVERNANCE_EXTENSION_NX_NAME,
  GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES,
  GOVERNANCE_EXTENSION_NX_VERSION,
  createGovernanceExtensionNx,
  governanceExtensionNx,
} from './governance-extension-nx.js';

describe('governanceExtensionNx', () => {
  it('exposes stable extension metadata', () => {
    expect(governanceExtensionNx).toMatchObject({
      id: GOVERNANCE_EXTENSION_NX_ID,
      name: GOVERNANCE_EXTENSION_NX_NAME,
      version: GOVERNANCE_EXTENSION_NX_VERSION,
    });
    expect(governanceExtensionNx.optionalCapabilities).toEqual(
      GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES
    );
    expect(governanceExtensionNx.requiredCapabilities).toBeUndefined();
  });

  it('declares Nx capability-aware optional requirements without requiring adapter internals', () => {
    expect(
      governanceExtensionNx.optionalCapabilities?.map(
        (capability) => capability.id
      )
    ).toEqual([
      'nx.project-graph',
      'nx.dependency-graph',
      'nx.project-metadata',
      'nx.project-tags',
      'nx.targets',
      'nx.inferred-targets',
      'nx.governance-profiles',
      'nx.ownership-evidence',
    ]);
  });

  it('creates the extension definition hosts can import', () => {
    expect(createGovernanceExtensionNx()).toBe(governanceExtensionNx);
    expect(typeof createGovernanceExtensionNx().register).toBe('function');
  });

  it('registers canonical Nx enricher, rule, signal, and metric contributions', () => {
    const host = createHost();

    governanceExtensionNx.register(host);

    expect(host.registerEnricher).toHaveBeenCalledTimes(1);
    expect(host.registerRulePack).toHaveBeenCalledTimes(1);
    expect(host.registerSignalProvider).toHaveBeenCalledTimes(1);
    expect(host.registerMetricProvider).toHaveBeenCalledTimes(1);
  });

  it('skips safely when Nx capabilities are absent', () => {
    const host = createHost({ capabilities: [] });

    governanceExtensionNx.register(host);

    expect(host.registerEnricher).not.toHaveBeenCalled();
    expect(host.registerRulePack).not.toHaveBeenCalled();
    expect(host.registerSignalProvider).not.toHaveBeenCalled();
    expect(host.registerMetricProvider).not.toHaveBeenCalled();
  });

  it('enriches canonical Nx nodes and relations only', () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const enricher = firstRegisteredContribution<GovernanceWorkspaceEnricher>(
      host.registerEnricher
    );
    const enriched = enricher.enrichWorkspace({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    }) as unknown as CanonicalWorkspace;

    expect(enriched.nodes).toHaveLength(3);
    expect(enriched.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'apps/store',
          sourceSystem: 'nx',
          tags: ['domain:commerce', 'layer:app', 'scope:public'],
          classification: expect.objectContaining({
            domain: 'commerce',
            layer: 'app',
            scope: 'public',
            tags: ['domain:commerce', 'layer:app', 'scope:public'],
          }),
          ownership: {
            team: '@anarchitects/commerce',
            contacts: ['commerce-team@anarchitects.dev'],
            source: 'project-metadata',
          },
          metadata: expect.objectContaining({
            nx: expect.objectContaining({
              projectType: 'application',
              root: 'apps/store',
              sourceRoot: 'apps/store/src',
              tags: ['domain:commerce', 'layer:app', 'scope:public'],
              targets: ['build', 'test'],
            }),
          }),
        }),
        expect.objectContaining({
          id: 'libs/shared-ui',
          tags: ['domain:shared', 'layer:ui'],
          classification: expect.objectContaining({
            domain: 'shared',
            layer: 'ui',
          }),
        }),
        expect.objectContaining({
          id: 'docs/adr',
          sourceSystem: 'manual',
        }),
      ])
    );

    expect(enriched.relations).toHaveLength(3);
    expect(enriched.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'nx:apps/store->libs/shared-ui:static:',
          kind: 'dependency',
          metadata: expect.objectContaining({
            nx: expect.objectContaining({
              dependencyType: 'static',
            }),
          }),
        }),
        expect.objectContaining({
          id: 'nx:libs/shared-ui->docs/adr:static:docs/adr.md',
          metadata: expect.objectContaining({
            nx: expect.objectContaining({
              sourceFile: 'docs/adr.md',
            }),
          }),
        }),
        expect.objectContaining({
          id: 'manual:docs/adr->apps/store',
        }),
      ])
    );

    expect(enriched).not.toHaveProperty('projects');
    expect(enriched).not.toHaveProperty('dependencies');
  });

  it('does not reclassify non-project Nx subjects into project-like governance nodes', () => {
    const host = createHost({
      inventory: {
        ...baseCanonicalWorkspace(),
        nodes: [
          ...baseCanonicalWorkspace().nodes,
          {
            id: 'infra/env',
            name: 'infra/env',
            kind: 'asset',
            sourceSystem: 'nx',
            metadata: {
              nx: {
                root: 'infra/env',
                tags: ['layer:infrastructure'],
              },
            },
          },
        ],
      },
    });
    governanceExtensionNx.register(host);

    const enricher = firstRegisteredContribution<GovernanceWorkspaceEnricher>(
      host.registerEnricher
    );
    const enriched = enricher.enrichWorkspace({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    }) as unknown as CanonicalWorkspace;

    expect(
      enriched.nodes.find((node) => node.id === 'infra/env')
    ).toMatchObject({
      id: 'infra/env',
      kind: 'asset',
      sourceSystem: 'nx',
      metadata: {
        nx: {
          root: 'infra/env',
          tags: ['layer:infrastructure'],
        },
      },
    });
    expect(
      enriched.nodes.find((node) => node.id === 'infra/env')
    ).not.toHaveProperty('classification');
  });

  it('does not infer project kind for untyped Nx-tagged nodes during enrichment', () => {
    const host = createHost({
      inventory: {
        ...baseCanonicalWorkspace(),
        nodes: [
          ...baseCanonicalWorkspace().nodes,
          {
            id: 'infra/runtime-config',
            name: 'infra/runtime-config',
            sourceSystem: 'nx',
            metadata: {
              nx: {
                root: 'infra/runtime-config',
                tags: ['layer:infrastructure'],
              },
            },
          },
        ],
      },
    });
    governanceExtensionNx.register(host);

    const enricher = firstRegisteredContribution<GovernanceWorkspaceEnricher>(
      host.registerEnricher
    );
    const enriched = enricher.enrichWorkspace({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    }) as unknown as CanonicalWorkspace;
    const node = enriched.nodes.find(
      (candidate) => candidate.id === 'infra/runtime-config'
    );

    expect(node).toBeDefined();
    expect(node).not.toHaveProperty('kind');
    expect(node).toMatchObject({
      id: 'infra/runtime-config',
      sourceSystem: 'nx',
      tags: ['layer:infrastructure'],
      classification: {
        layer: 'infrastructure',
        tags: ['layer:infrastructure'],
      },
      metadata: {
        nx: {
          root: 'infra/runtime-config',
          tags: ['layer:infrastructure'],
        },
      },
    });
  });

  it('emits canonical relation violations without legacy project references', () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const rulePack = firstRegisteredContribution<{
      evaluate(input: {
        workspace: GovernanceWorkspace;
        profile: ReturnType<typeof baseProfile>;
        context: GovernanceExtensionHostContext;
      }): unknown[];
    }>(host.registerRulePack);

    const violations = rulePack.evaluate({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    });

    expect(violations).toEqual([
      expect.objectContaining({
        id: 'nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
        ruleId: 'nx.relation.source-trace',
        reference: {
          relationId: 'nx:apps/store->libs/shared-ui:static:',
          relatedNodeIds: ['apps/store', 'libs/shared-ui'],
        },
        subjectId: 'nx:apps/store->libs/shared-ui:static:',
        recommendation:
          'Preserve source-file details for relation "nx:apps/store->libs/shared-ui:static:" between "apps/store" and "libs/shared-ui".',
      }),
    ]);

    const legacyViolationFields = [
      'project',
      ['project', 'Id'].join(''),
      ['source', 'ProjectId'].join(''),
      ['target', 'ProjectId'].join(''),
      ['related', 'ProjectIds'].join(''),
    ];
    for (const violation of violations) {
      for (const field of legacyViolationFields) {
        expect(violation).not.toHaveProperty(field);
      }
    }
  });

  it('does not emit plugin-owned ownership violations', () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const rulePack = firstRegisteredContribution<{
      evaluate(input: {
        workspace: GovernanceWorkspace;
        profile: ReturnType<typeof baseProfile>;
        context: GovernanceExtensionHostContext;
      }): unknown[];
    }>(host.registerRulePack);

    const violations = rulePack.evaluate({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    }) as Array<Record<string, unknown>>;

    expect(
      violations.some((violation) => violation.ruleId === 'nx.node.ownership')
    ).toBe(false);
  });

  it('emits canonical signals with node and relation references only', async () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const signalProvider =
      firstRegisteredContribution<GovernanceSignalProvider>(
        host.registerSignalProvider
      );
    const signals = (await signalProvider.provideSignals({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
      violations: [
        {
          id: 'nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
          ruleId: 'nx.relation.source-trace',
          severity: 'info',
          category: 'dependency',
          message: 'Missing source trace',
          reference: {
            relationId: 'nx:apps/store->libs/shared-ui:static:',
            relatedNodeIds: ['apps/store', 'libs/shared-ui'],
          },
        },
      ] as unknown as never[],
      signals: [],
    })) as unknown as CanonicalSignal[];

    expect(signals).toEqual([
      {
        id: 'nx:signal:nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
        type: 'structural-dependency',
        severity: 'info',
        category: 'dependency',
        message: 'Missing source trace',
        relationId: 'nx:apps/store->libs/shared-ui:static:',
        relatedNodeIds: ['apps/store', 'libs/shared-ui'],
        relatedRelationIds: ['nx:apps/store->libs/shared-ui:static:'],
        findingIds: [
          'nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
        ],
        metadata: {
          extensionId: 'governance-extension-nx',
          ruleId: 'nx.relation.source-trace',
          priorSignalCount: 0,
        },
        source: 'extension',
        sourceRef: {
          id: 'governance-extension-nx',
          name: 'Nx Governance Extension',
          type: 'governance-extension',
        },
        authority: 'inferred',
        confidence: 0.95,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const legacySignalFields = [
      ['source', 'ProjectId'].join(''),
      ['target', 'ProjectId'].join(''),
      ['related', 'ProjectIds'].join(''),
    ];
    for (const signal of signals) {
      for (const field of legacySignalFields) {
        expect(signal).not.toHaveProperty(field);
      }
    }
  });

  it('computes metrics from canonical Nx nodes and relations only', async () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const metricProvider =
      firstRegisteredContribution<GovernanceMetricProvider>(
        host.registerMetricProvider
      );
    const measurements = await metricProvider.provideMetrics({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
      violations: [],
      measurements: [],
      signals: [],
    });

    expect(measurements).toEqual([
      expect.objectContaining({
        id: 'nx-relation-source-trace-coverage',
        value: 0.5,
        score: 50,
        maxScore: 100,
        unit: 'ratio',
        metadata: {
          relationCount: 2,
          tracedRelationCount: 1,
        },
      }),
    ]);
  });

  it('ignores non-Nx nodes and relations where appropriate', async () => {
    const host = createHost({
      inventory: {
        id: 'workspace',
        name: 'workspace',
        root: '/workspace',
        nodes: [
          {
            id: 'docs/adr',
            name: 'docs/adr',
            kind: 'asset',
            sourceSystem: 'manual',
            metadata: {},
          },
        ],
        relations: [
          {
            id: 'manual:docs/adr->docs/adr',
            sourceNodeId: 'docs/adr',
            targetNodeId: 'docs/adr',
            kind: 'traceability',
            metadata: {},
          },
        ],
      },
    });

    governanceExtensionNx.register(host);

    const metricProvider =
      firstRegisteredContribution<GovernanceMetricProvider>(
        host.registerMetricProvider
      );
    const measurements = await metricProvider.provideMetrics({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
      violations: [],
      measurements: [],
      signals: [],
    });

    expect(measurements).toEqual([]);
  });

  it('produces deterministic outputs for equivalent canonical workspaces', async () => {
    const host = createHost();
    governanceExtensionNx.register(host);

    const enricher = firstRegisteredContribution<GovernanceWorkspaceEnricher>(
      host.registerEnricher
    );
    const signalProvider =
      firstRegisteredContribution<GovernanceSignalProvider>(
        host.registerSignalProvider
      );
    const metricProvider =
      firstRegisteredContribution<GovernanceMetricProvider>(
        host.registerMetricProvider
      );
    const reversedWorkspace = reverseCanonicalWorkspace(host.context.inventory);

    const leftWorkspace = enricher.enrichWorkspace({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
    }) as unknown as CanonicalWorkspace;
    const rightWorkspace = enricher.enrichWorkspace({
      workspace: reversedWorkspace as unknown as GovernanceWorkspace,
      profile: baseProfile(),
      context: host.context,
    }) as unknown as CanonicalWorkspace;

    expect(leftWorkspace).toEqual(rightWorkspace);

    const signals = await signalProvider.provideSignals({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
      violations: [
        {
          id: 'nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
          ruleId: 'nx.relation.source-trace',
          severity: 'info',
          category: 'dependency',
          message: 'Missing source trace',
          reference: {
            relationId: 'nx:apps/store->libs/shared-ui:static:',
            relatedNodeIds: ['apps/store', 'libs/shared-ui'],
          },
        },
      ] as unknown as never[],
      signals: [],
    });
    const reversedSignals = await signalProvider.provideSignals({
      workspace: reversedWorkspace as unknown as GovernanceWorkspace,
      profile: baseProfile(),
      context: host.context,
      violations: [
        {
          id: 'nx:relation:nx:apps/store->libs/shared-ui:static::source-trace',
          ruleId: 'nx.relation.source-trace',
          severity: 'info',
          category: 'dependency',
          message: 'Missing source trace',
          reference: {
            relationId: 'nx:apps/store->libs/shared-ui:static:',
            relatedNodeIds: ['apps/store', 'libs/shared-ui'],
          },
        },
      ] as unknown as never[],
      signals: [],
    });
    const measurements = await metricProvider.provideMetrics({
      workspace: host.context.inventory,
      profile: baseProfile(),
      context: host.context,
      violations: [],
      measurements: [],
      signals,
    });
    const reversedMeasurements = await metricProvider.provideMetrics({
      workspace: reversedWorkspace as unknown as GovernanceWorkspace,
      profile: baseProfile(),
      context: host.context,
      violations: [],
      measurements: [],
      signals: reversedSignals,
    });

    expect(signals).toEqual(reversedSignals);
    expect(measurements).toEqual(reversedMeasurements);
  });

  it('loads from the package public barrel', async () => {
    const loaded = await import('../index.js');

    expect(loaded.governanceExtensionNx).toBe(governanceExtensionNx);
    expect(loaded.default).toBe(governanceExtensionNx);
    expect(loaded.createGovernanceExtensionNx()).toBe(governanceExtensionNx);
  });
});

interface CanonicalWorkspace {
  id: string;
  name: string;
  root: string;
  nodes: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
}

interface CanonicalSignal extends Record<string, unknown> {
  id: string;
}

function createHost(
  options: {
    capabilities?: GovernanceCapability[];
    inventory?: CanonicalWorkspace;
  } = {}
): GovernanceExtensionHost {
  const capabilities = options.capabilities ?? [
    {
      id: 'capability:nx',
      data: {
        workspaceRoot: '/workspace',
        projects: [
          {
            name: 'apps/store',
            root: 'apps/store',
            type: 'application',
            tags: ['domain:commerce', 'layer:app', 'scope:public'],
            targets: ['build', 'test'],
          },
          {
            name: 'libs/shared-ui',
            root: 'libs/shared-ui',
            type: 'library',
            tags: ['domain:shared', 'layer:ui'],
            targets: ['lint'],
          },
        ],
      },
    },
  ];
  const inventory = options.inventory ?? baseCanonicalWorkspace();
  const context: GovernanceExtensionHostContext = {
    workspaceRoot: '/workspace',
    profileName: 'frontend-layered',
    options: {},
    inventory: inventory as unknown as GovernanceWorkspace,
    capabilities: {
      has: (id) => capabilities.some((capability) => capability.id === id),
      get: <TData = unknown>(id: string) =>
        capabilities.find((capability) => capability.id === id) as
          | GovernanceCapability<TData>
          | undefined,
      list: () => [...capabilities],
    },
  };

  return {
    context,
    registerEnricher: jest.fn(),
    registerRulePack: jest.fn(),
    registerSignalProvider: jest.fn(),
    registerMetricProvider: jest.fn(),
  };
}

function baseCanonicalWorkspace(): CanonicalWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '/workspace',
    nodes: [
      {
        id: 'apps/store',
        name: 'apps/store',
        kind: 'project',
        sourceSystem: 'nx',
        ownership: {
          team: '@anarchitects/commerce',
          contacts: ['commerce-team@anarchitects.dev'],
          source: 'project-metadata',
        },
        metadata: {
          nx: {
            projectType: 'application',
            root: 'apps/store',
            sourceRoot: 'apps/store/src',
            tags: ['domain:commerce', 'layer:app', 'scope:public'],
            targets: ['build', 'test'],
            projectMetadata: {
              ownership: {
                team: '@anarchitects/commerce',
                contacts: ['commerce-team@anarchitects.dev'],
              },
            },
          },
        },
      },
      {
        id: 'libs/shared-ui',
        name: 'libs/shared-ui',
        kind: 'project',
        sourceSystem: 'nx',
        metadata: {
          nx: {
            projectType: 'library',
            root: 'libs/shared-ui',
            tags: ['domain:shared', 'layer:ui'],
            targets: ['lint'],
          },
        },
      },
      {
        id: 'docs/adr',
        name: 'docs/adr',
        kind: 'asset',
        sourceSystem: 'manual',
        metadata: {},
      },
    ],
    relations: [
      {
        id: 'nx:apps/store->libs/shared-ui:static:',
        sourceNodeId: 'apps/store',
        targetNodeId: 'libs/shared-ui',
        kind: 'dependency',
        metadata: {
          nx: {
            dependencyType: 'static',
          },
        },
      },
      {
        id: 'nx:libs/shared-ui->docs/adr:static:docs/adr.md',
        sourceNodeId: 'libs/shared-ui',
        targetNodeId: 'docs/adr',
        kind: 'dependency',
        metadata: {
          nx: {
            dependencyType: 'static',
            sourceFile: 'docs/adr.md',
          },
        },
      },
      {
        id: 'manual:docs/adr->apps/store',
        sourceNodeId: 'docs/adr',
        targetNodeId: 'apps/store',
        kind: 'traceability',
        metadata: {},
      },
    ],
  };
}

function reverseCanonicalWorkspace(
  workspace: GovernanceWorkspace
): CanonicalWorkspace {
  const canonical = workspace as unknown as CanonicalWorkspace;

  return {
    ...canonical,
    nodes: [...canonical.nodes].reverse(),
    relations: [...canonical.relations].reverse(),
  };
}

function baseProfile() {
  return {
    name: 'frontend-layered',
    layers: [],
    allowedDomainDependencies: {},
    ownership: {
      required: false,
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {},
  };
}

function firstRegisteredContribution<TContribution>(
  register: unknown
): TContribution {
  return (register as jest.Mock).mock.calls[0][0] as TContribution;
}
