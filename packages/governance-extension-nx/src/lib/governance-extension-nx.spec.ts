import type {
  GovernanceCapability,
  GovernanceExtensionHost,
  GovernanceExtensionHostContext,
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

  it('does not duplicate generic rules, signals, or metrics during extension registration', () => {
    const host = createHost();

    governanceExtensionNx.register(host);

    expect(host.registerEnricher).not.toHaveBeenCalled();
    expect(host.registerRulePack).not.toHaveBeenCalled();
    expect(host.registerSignalProvider).not.toHaveBeenCalled();
    expect(host.registerMetricProvider).not.toHaveBeenCalled();
  });

  it('skips safely when optional Nx capabilities are absent', () => {
    const host = createHost({ capabilities: [] });

    governanceExtensionNx.register(host);

    expect(host.registerEnricher).not.toHaveBeenCalled();
    expect(host.registerRulePack).not.toHaveBeenCalled();
    expect(host.registerSignalProvider).not.toHaveBeenCalled();
    expect(host.registerMetricProvider).not.toHaveBeenCalled();
  });

  it('loads from the package public barrel', async () => {
    const loaded = await import('../index.js');

    expect(loaded.governanceExtensionNx).toBe(governanceExtensionNx);
    expect(loaded.default).toBe(governanceExtensionNx);
    expect(loaded.createGovernanceExtensionNx()).toBe(governanceExtensionNx);
  });
});

function createHost(
  options: { capabilities?: GovernanceCapability[] } = {}
): GovernanceExtensionHost {
  const capabilities = options.capabilities ?? [
    {
      id: 'nx.project-graph',
      data: {
        projectCount: 0,
        projects: [],
      },
    },
  ];
  const context: GovernanceExtensionHostContext = {
    workspaceRoot: '/workspace',
    profileName: 'frontend-layered',
    options: {},
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/workspace',
      projects: [],
      dependencies: [],
    },
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
