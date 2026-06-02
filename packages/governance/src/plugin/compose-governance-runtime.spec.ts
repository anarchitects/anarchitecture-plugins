jest.mock('@anarchitects/governance-adapter-nx', () => {
  const actual = jest.requireActual(
    '@anarchitects/governance-adapter-nx'
  ) as typeof import('@anarchitects/governance-adapter-nx');

  return {
    ...actual,
    loadNxGovernanceWorkspaceContext: jest.fn(),
  };
});

jest.mock('../nx-host/extensions/host.js', () => ({
  registerNxGovernanceExtensionsWithDiagnostics: jest.fn(),
}));

import { workspaceRoot } from '@nx/devkit';
import type {
  GovernanceExtensionHostContext,
  GovernanceProfile,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import { loadNxGovernanceWorkspaceContext } from '@anarchitects/governance-adapter-nx';

import { registerNxGovernanceExtensionsWithDiagnostics } from '../nx-host/extensions/host.js';
import { composeNxGovernanceRuntime } from './compose-governance-runtime.js';

const mockedLoadNxGovernanceWorkspaceContext = jest.mocked(
  loadNxGovernanceWorkspaceContext
);
const mockedRegisterNxGovernanceExtensionsWithDiagnostics = jest.mocked(
  registerNxGovernanceExtensionsWithDiagnostics
);

describe('composeNxGovernanceRuntime', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('composes the Nx adapter, extension registry, capabilities, diagnostics, and Core artifact generation', async () => {
    let receivedContext: GovernanceExtensionHostContext | undefined;
    const adapterResult = buildAdapterResult();

    mockedLoadNxGovernanceWorkspaceContext.mockResolvedValue({
      adapterResult,
      snapshot: {
        root: workspaceRoot,
        projects: [],
        dependencies: [],
        codeownersByProject: {},
      },
    });
    mockedRegisterNxGovernanceExtensionsWithDiagnostics.mockImplementation(
      async (context) => {
        receivedContext = context;

        return {
          registry: {
            enrichers: [
              {
                pluginId: 'test-nx-extension',
                contribution: {
                  enrichWorkspace({ workspace }) {
                    return {
                      ...workspace,
                      projects: workspace.projects.map((project) => ({
                        ...project,
                        metadata: {
                          ...project.metadata,
                          extensionTouched: true,
                        },
                      })),
                    };
                  },
                },
              },
            ],
            rulePacks: [
              {
                pluginId: 'test-nx-extension',
                contribution: {
                  evaluate({ workspace }) {
                    return [
                      {
                        id: 'extension-domain-boundary',
                        ruleId: 'domain-boundary',
                        project: workspace.projects[0]?.id ?? 'unknown',
                        severity: 'warning',
                        category: 'boundary',
                        message: 'Extension boundary violation',
                      },
                    ];
                  },
                },
              },
            ],
            signalProviders: [
              {
                pluginId: 'test-nx-extension',
                contribution: {
                  provideSignals({ workspace, violations }) {
                    return [
                      {
                        id: 'extension-signal',
                        type: 'extension-warning',
                        sourceProjectId: workspace.projects[0]?.id,
                        relatedProjectIds: workspace.projects[0]
                          ? [workspace.projects[0].id]
                          : [],
                        severity: 'warning',
                        category: 'boundary',
                        message: `Extension saw ${violations.length} violations.`,
                        source: 'extension',
                        createdAt: '2026-06-02T00:00:00.000Z',
                      },
                    ];
                  },
                },
              },
            ],
            metricProviders: [
              {
                pluginId: 'test-nx-extension',
                contribution: {
                  provideMetrics() {
                    return [
                      {
                        id: 'extension-coverage',
                        name: 'Extension Coverage',
                        family: 'architecture',
                        value: 1,
                        score: 90,
                        maxScore: 100,
                        unit: 'ratio',
                      },
                    ];
                  },
                },
              },
            ],
          },
          diagnostics: [
            {
              code: 'governance.extension.loaded',
              severity: 'notice',
              message: 'Loaded test extension.',
              extensionId: 'test-nx-extension',
            },
          ],
        };
      }
    );

    const result = await composeNxGovernanceRuntime({
      workspaceRoot,
      profileName: 'test-profile',
      options: { reportType: 'health' },
      profile: buildProfile(),
      profileOverrides: { projectOverrides: {} },
      warnings: ['profile warning'],
      conformanceFindings: [],
      asOf: new Date('2026-06-02T00:00:00.000Z'),
    });

    expect(mockedLoadNxGovernanceWorkspaceContext).toHaveBeenCalledTimes(1);
    expect(
      mockedRegisterNxGovernanceExtensionsWithDiagnostics
    ).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: 'test-profile' })
    );
    expect(result.adapterResult).toBe(adapterResult);
    expect(result.workspace.projects).toHaveLength(2);
    expect(result.adapterCapabilities).toEqual(adapterResult.capabilities);
    expect(receivedContext?.inventory.projects).toHaveLength(2);
    expect(receivedContext?.capabilities.has('capability:nx')).toBe(true);
    expect(receivedContext?.capabilities.get('capability:nx')).toEqual(
      adapterResult.capabilities?.[0]
    );
    expect(result.artifacts.workspace.projects[0]?.metadata).toEqual(
      expect.objectContaining({ extensionTouched: true })
    );
    expect(result.artifacts.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'domain-boundary',
          sourcePluginId: 'test-nx-extension',
        }),
      ])
    );
    expect(result.artifacts.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'extension-signal',
          sourcePluginId: 'test-nx-extension',
        }),
      ])
    );
    expect(result.artifacts.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'extension-coverage',
          sourcePluginId: 'test-nx-extension',
        }),
      ])
    );
    expect(result.artifacts.recommendations.length).toBeGreaterThan(0);
    expect(result.artifacts.diagnostics).toEqual(adapterResult.diagnostics);
    expect(result.artifacts.extensionDiagnostics).toEqual([
      expect.objectContaining({ code: 'governance.extension.loaded' }),
    ]);
  });
});

function buildAdapterResult(): GovernanceWorkspaceAdapterResult {
  return {
    workspaceRoot,
    projects: [
      {
        id: 'app',
        name: 'app',
        root: 'apps/app',
        type: 'application',
        domain: 'sales',
        layer: 'app',
        tags: ['domain:sales', 'layer:app'],
        metadata: { documentation: true },
      },
      {
        id: 'shared-data',
        name: 'shared-data',
        root: 'libs/shared-data',
        type: 'library',
        domain: 'data',
        layer: 'data',
        tags: ['domain:data', 'layer:data'],
        metadata: { documentation: true },
      },
    ],
    dependencies: [
      {
        sourceProjectId: 'app',
        targetProjectId: 'shared-data',
        type: 'static',
        sourceFile: 'apps/app/src/main.ts',
      },
    ],
    capabilities: [
      {
        id: 'capability:nx',
        data: {
          nodes: ['app', 'shared-data'],
          relations: ['app-to-shared-data'],
        },
      },
    ],
    diagnostics: [
      {
        code: 'adapter.observation',
        message: 'Adapter diagnostic.',
        source: '@anarchitects/governance-adapter-nx',
      },
    ],
  };
}

function buildProfile(): GovernanceProfile {
  return {
    name: 'test-profile',
    boundaryPolicySource: 'profile',
    layers: ['app', 'data'],
    allowedLayerDependencies: {
      app: ['app', 'data'],
      data: ['data'],
    },
    allowedDomainDependencies: {
      sales: ['sales'],
      data: ['data'],
    },
    ownership: {
      required: false,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 80,
        warningMinScore: 60,
      },
    },
    metrics: {},
  };
}
