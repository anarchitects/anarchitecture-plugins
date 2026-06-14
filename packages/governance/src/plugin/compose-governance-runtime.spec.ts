jest.mock('@anarchitects/governance-core', () => {
  const actual = jest.requireActual(
    '@anarchitects/governance-core'
  ) as typeof import('@anarchitects/governance-core');

  return {
    ...actual,
    buildGovernanceWorkspace: jest.fn(),
    buildGovernanceAssessmentArtifacts: jest.fn(),
  };
});

jest.mock('@anarchitects/governance-adapter-nx', () => {
  const actual = jest.requireActual(
    '@anarchitects/governance-adapter-nx'
  ) as typeof import('@anarchitects/governance-adapter-nx');

  return {
    ...actual,
    loadNxGovernanceWorkspaceContext: jest.fn(),
    readWorkspaceGraphSnapshot: jest.fn(),
    summarizeWorkspaceGraph: jest.fn(),
  };
});

jest.mock('../nx-host/extensions/host.js', () => ({
  registerNxGovernanceExtensionsWithDiagnostics: jest.fn(),
}));

import { workspaceRoot } from '@nx/devkit';
import type {
  GovernanceExtensionHostContext,
  GovernanceExtensionRegistrationResult,
  GovernanceAssessmentArtifacts,
  GovernanceProfile,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import {
  buildGovernanceWorkspace,
  buildGovernanceAssessmentArtifacts,
} from '@anarchitects/governance-core';
import {
  loadNxGovernanceWorkspaceContext,
  readWorkspaceGraphSnapshot,
  summarizeWorkspaceGraph,
} from '@anarchitects/governance-adapter-nx';

import { registerNxGovernanceExtensionsWithDiagnostics } from '../nx-host/extensions/host.js';
import {
  composeNxGovernanceRuntime,
  type RuntimeGovernanceNode,
  type RuntimeGovernanceRelation,
  type RuntimeGovernanceExtensionContext,
  type RuntimeGovernanceWorkspace,
  summarizeNxGovernanceWorkspaceGraph,
} from './compose-governance-runtime.js';

type CanonicalAdapterResult = GovernanceWorkspaceAdapterResult & {
  nodes?: RuntimeGovernanceNode[];
  relations?: RuntimeGovernanceRelation[];
};

const mockedBuildGovernanceWorkspace = jest.mocked(buildGovernanceWorkspace);
const mockedBuildGovernanceAssessmentArtifacts = jest.mocked(
  buildGovernanceAssessmentArtifacts
);
const mockedLoadNxGovernanceWorkspaceContext = jest.mocked(
  loadNxGovernanceWorkspaceContext
);
const mockedReadWorkspaceGraphSnapshot = jest.mocked(
  readWorkspaceGraphSnapshot
);
const mockedRegisterNxGovernanceExtensionsWithDiagnostics = jest.mocked(
  registerNxGovernanceExtensionsWithDiagnostics
);
const mockedSummarizeWorkspaceGraph = jest.mocked(summarizeWorkspaceGraph);

describe('composeNxGovernanceRuntime', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('composes canonical workspace inventory, capabilities, host runtime config, and extension registration', async () => {
    let receivedContext: RuntimeGovernanceExtensionContext | undefined;
    const adapterResult = buildAdapterResult();
    const workspace = buildCanonicalWorkspace();
    const extensionRegistration = {
      registry: {
        enrichers: [
          {
            pluginId: 'test-nx-extension',
            contribution: {
              enrichWorkspace() {
                return workspace;
              },
            },
          },
        ],
        rulePacks: [
          {
            pluginId: 'test-nx-extension',
            contribution: {
              evaluate() {
                return [];
              },
            },
          },
        ],
        signalProviders: [
          {
            pluginId: 'test-nx-extension',
            contribution: {
              provideSignals() {
                return [];
              },
            },
          },
        ],
        metricProviders: [
          {
            pluginId: 'test-nx-extension',
            contribution: {
              provideMetrics() {
                return [];
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
    } as unknown as GovernanceExtensionRegistrationResult;
    const artifacts = {
      workspace,
      assessment: {
        workspace,
      },
      signals: [],
      exceptionApplication: {},
      extensionDiagnostics: extensionRegistration.diagnostics,
      diagnostics: adapterResult.diagnostics,
      capabilities: adapterResult.capabilities,
      adapterResult,
    } as unknown as GovernanceAssessmentArtifacts;

    mockedLoadNxGovernanceWorkspaceContext.mockResolvedValue({
      adapterResult,
      snapshot: {
        root: workspaceRoot,
        projects: [],
        dependencies: [],
        codeownersByProject: {},
      },
    });
    mockedBuildGovernanceWorkspace.mockReturnValue(
      workspace as unknown as GovernanceExtensionHostContext['inventory']
    );
    mockedRegisterNxGovernanceExtensionsWithDiagnostics.mockImplementation(
      async (context) => {
        receivedContext =
          context as unknown as RuntimeGovernanceExtensionContext;

        return extensionRegistration;
      }
    );
    mockedBuildGovernanceAssessmentArtifacts.mockResolvedValue(artifacts);

    const result = await composeNxGovernanceRuntime({
      workspaceRoot,
      profileName: 'test-profile',
      options: { reportType: 'health' },
      profile: buildProfile(),
      profileOverrides: {
        nodeOverrides: {},
        runtimeConfig: {
          renderers: [
            {
              id: 'cli',
              enabled: true,
            },
          ],
          settings: {
            severityThreshold: 'warning',
          },
        },
      },
      warnings: ['profile warning'],
      conformanceFindings: [],
      asOf: new Date('2026-06-02T00:00:00.000Z'),
    });

    expect(mockedLoadNxGovernanceWorkspaceContext).toHaveBeenCalledTimes(1);
    expect(
      mockedRegisterNxGovernanceExtensionsWithDiagnostics
    ).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: 'test-profile' }),
      {
        workspaceRoot,
      }
    );
    expect(result.adapterResult).toBe(adapterResult);
    expect(result.workspace).toEqual(workspace);
    expect(result.workspace.nodes).toHaveLength(2);
    expect(result.workspace.relations).toHaveLength(1);
    expect(result.adapterCapabilities).toEqual(adapterResult.capabilities);
    expect(receivedContext?.inventory.nodes).toHaveLength(2);
    expect(receivedContext?.inventory.relations).toHaveLength(1);
    expect('projects' in (receivedContext?.inventory ?? {})).toBe(false);
    expect('dependencies' in (receivedContext?.inventory ?? {})).toBe(false);
    expect(receivedContext?.capabilities.has('capability:nx')).toBe(true);
    expect(receivedContext?.capabilities.get('capability:nx')).toEqual(
      adapterResult.capabilities?.[0]
    );
    expect(receivedContext?.options.runtimeConfig).toEqual({
      renderers: [
        {
          id: 'cli',
          enabled: true,
        },
      ],
      settings: {
        severityThreshold: 'warning',
      },
    });
    expect(mockedBuildGovernanceAssessmentArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ name: 'test-profile' }),
        workspace,
        capabilities: adapterResult.capabilities,
        diagnostics: adapterResult.diagnostics,
        extensionRegistry: extensionRegistration.registry,
        extensionContext: expect.objectContaining({
          inventory: workspace,
        }),
        extensionDiagnostics: extensionRegistration.diagnostics,
      })
    );
    expect(result.extensionRegistration).toEqual(extensionRegistration);
    expect(result.artifacts).toEqual(
      expect.objectContaining({
        diagnostics: adapterResult.diagnostics,
        extensionDiagnostics: extensionRegistration.diagnostics,
      })
    );
    expect(
      result.artifacts.workspace as unknown as RuntimeGovernanceWorkspace
    ).toEqual(workspace);
    expect(
      result.artifacts.assessment
        .workspace as unknown as RuntimeGovernanceWorkspace
    ).toEqual(workspace);
    expect(result.artifacts.diagnostics).toEqual(adapterResult.diagnostics);
    expect(result.artifacts.extensionDiagnostics).toEqual(
      extensionRegistration.diagnostics
    );
    expect(result.artifacts.extensionDiagnostics).toEqual([
      expect.objectContaining({ code: 'governance.extension.loaded' }),
    ]);
  });

  it('summarizes the workspace graph through canonical host adapter output', async () => {
    mockedBuildGovernanceWorkspace.mockReturnValue({
      id: 'workspace',
      name: 'workspace',
      root: workspaceRoot,
      nodes: [
        {
          id: 'app',
          kind: 'project',
          tags: [],
          metadata: {},
        },
        {
          id: 'shared-data',
          kind: 'project',
          tags: [],
          metadata: {},
        },
      ],
      relations: [
        {
          id: 'app->shared-data:dependency:',
          sourceNodeId: 'app',
          targetNodeId: 'shared-data',
          kind: 'dependency',
          metadata: {},
        },
      ],
    });
    mockedLoadNxGovernanceWorkspaceContext.mockResolvedValue({
      adapterResult: {
        workspaceRoot,
        nodes: [
          { id: 'app', kind: 'project' },
          { id: 'shared-data', kind: 'project' },
        ],
        relations: [
          {
            sourceNodeId: 'app',
            targetNodeId: 'shared-data',
            kind: 'dependency',
          },
        ],
      },
      snapshot: {
        root: workspaceRoot,
        projects: [],
        dependencies: [],
        codeownersByProject: {},
      },
    });

    const result = await summarizeNxGovernanceWorkspaceGraph();

    expect(result).toEqual({
      summary: {
        nodeCount: 2,
        relationCount: 1,
        dependencyRelationCount: 1,
      },
      source: 'host-canonical-workspace',
    });
    expect(mockedLoadNxGovernanceWorkspaceContext).toHaveBeenCalledTimes(1);
  });

  it('maps adapter graph-json summaries into canonical node and relation counts', async () => {
    mockedReadWorkspaceGraphSnapshot.mockResolvedValue({
      source: 'nx-graph',
      extractedAt: '2026-06-10T00:00:00.000Z',
      projects: [],
      dependencies: [],
    });
    mockedSummarizeWorkspaceGraph.mockReturnValue({
      projectCount: 3,
      dependencyCount: 5,
    });

    const result = await summarizeNxGovernanceWorkspaceGraph({
      graphJson: 'dist/project-graph.json',
    });

    expect(result).toEqual({
      summary: {
        nodeCount: 3,
        relationCount: 5,
        dependencyRelationCount: 5,
      },
      source: 'adapter-graph-json',
    });
    expect(mockedReadWorkspaceGraphSnapshot).toHaveBeenCalledWith({
      graphJson: 'dist/project-graph.json',
    });
  });
});

function buildAdapterResult(): CanonicalAdapterResult {
  return {
    workspaceRoot,
    nodes: [
      {
        id: 'app',
        name: 'app',
        kind: 'project',
        sourceSystem: 'nx',
        root: 'apps/app',
        path: 'apps/app',
        tags: ['domain:sales', 'layer:app'],
        classification: {
          domain: 'sales',
          layer: 'app',
          tags: ['domain:sales', 'layer:app'],
        },
        metadata: {
          nx: {
            projectType: 'application',
            root: 'apps/app',
            tags: ['domain:sales', 'layer:app'],
            targets: ['build'],
          },
        },
      },
      {
        id: 'shared-data',
        name: 'shared-data',
        kind: 'project',
        sourceSystem: 'nx',
        root: 'libs/shared-data',
        path: 'libs/shared-data',
        tags: ['domain:data', 'layer:data'],
        classification: {
          domain: 'data',
          layer: 'data',
          tags: ['domain:data', 'layer:data'],
        },
        metadata: {
          nx: {
            projectType: 'library',
            root: 'libs/shared-data',
            tags: ['domain:data', 'layer:data'],
            targets: ['test'],
          },
        },
      },
    ],
    relations: [
      {
        id: 'nx:app->shared-data:static:apps/app/src/main.ts',
        sourceNodeId: 'app',
        targetNodeId: 'shared-data',
        kind: 'dependency',
        metadata: {
          nx: {
            dependencyType: 'static',
            sourceFile: 'apps/app/src/main.ts',
          },
        },
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

function buildCanonicalWorkspace(): RuntimeGovernanceWorkspace {
  const adapterResult = buildAdapterResult();

  return {
    id: 'workspace',
    name: 'workspace',
    root: workspaceRoot,
    nodes: [...(adapterResult.nodes ?? [])] as RuntimeGovernanceNode[],
    relations: [
      ...(adapterResult.relations ?? []),
    ] as RuntimeGovernanceRelation[],
  } as unknown as RuntimeGovernanceWorkspace;
}

function buildProfile(): GovernanceProfile {
  return {
    name: 'test-profile',
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
