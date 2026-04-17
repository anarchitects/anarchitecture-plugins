import {
  GovernanceExtensionHostContext,
  registerGovernanceExtensions,
} from './host.js';

describe('registerGovernanceExtensions', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'angular-cleanup',
    options: {
      output: 'cli',
      reportType: 'health',
    },
    snapshot: {
      root: '/repo',
      projects: [],
      dependencies: [],
      codeownersByProject: {},
    },
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    },
  };

  function createMissingModuleError(specifier: string): Error {
    const error = new Error(`Cannot find module '${specifier}'`);
    (error as Error & { code: string }).code = 'MODULE_NOT_FOUND';
    return error;
  }

  it('discovers extensions from string and object plugin entries and registers them in nx.json order', async () => {
    const registrationOrder: string[] = [];

    const registry = await registerGovernanceExtensions(baseContext, {
      nxJson: {
        plugins: [
          '@nx/jest/plugin',
          { plugin: 'plugin-a' },
          { plugin: 'plugin-b', options: { ignored: true } },
        ],
      },
      moduleLoader: async (specifier) => {
        if (specifier === '@nx/jest/plugin/governance-extension') {
          throw createMissingModuleError(specifier);
        }

        if (specifier === 'plugin-a/governance-extension') {
          return {
            governanceExtension: {
              id: 'plugin-a',
              register(host: {
                registerAnalyzer(value: unknown): void;
                registerMetricProvider(value: unknown): void;
              }) {
                registrationOrder.push('plugin-a');
                host.registerAnalyzer('analyzer-a');
                host.registerMetricProvider('metric-a');
              },
            },
          };
        }

        if (specifier === 'plugin-b/governance-extension') {
          return {
            governanceExtension: {
              id: 'plugin-b',
              register(host: {
                registerSignalProvider(value: unknown): void;
                registerRulePack(value: unknown): void;
                registerEnricher(value: unknown): void;
              }) {
                registrationOrder.push('plugin-b');
                host.registerSignalProvider('signal-b');
                host.registerRulePack('rule-b');
                host.registerEnricher('enricher-b');
              },
            },
          };
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(registrationOrder).toEqual(['plugin-a', 'plugin-b']);
    expect(registry).toEqual({
      analyzers: ['analyzer-a'],
      metricProviders: ['metric-a'],
      signalProviders: ['signal-b'],
      rulePacks: ['rule-b'],
      enrichers: ['enricher-b'],
    });
  });

  it('passes immutable host context to registered extensions', async () => {
    let receivedContext: GovernanceExtensionHostContext | undefined;

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        plugins: ['plugin-a'],
      },
      moduleLoader: async () => ({
        governanceExtension: {
          id: 'plugin-a',
          register(host: { context: GovernanceExtensionHostContext }) {
            receivedContext = host.context;
          },
        },
      }),
    });

    expect(receivedContext).toEqual(baseContext);
    expect(Object.isFrozen(receivedContext)).toBe(true);
    expect(Object.isFrozen(receivedContext?.options)).toBe(true);
  });

  it('ignores plugins without a governance extension entrypoint', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async (specifier) => {
          throw createMissingModuleError(specifier);
        },
      })
    ).resolves.toEqual({
      analyzers: [],
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
  });

  it('rejects invalid governance extension modules without a named export', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async () => ({
          default: {
            id: 'plugin-a',
          },
        }),
      })
    ).rejects.toThrow(
      'Governance extension module must export a named "governanceExtension" definition.'
    );
  });

  it('rejects duplicate extension ids', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['plugin-a', 'plugin-b'],
        },
        moduleLoader: async () => ({
          governanceExtension: {
            id: 'shared-extension',
            register() {
              return undefined;
            },
          },
        }),
      })
    ).rejects.toThrow('Duplicate governance extension id "shared-extension"');
  });

  it('wraps registration failures with extension context', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async () => ({
          governanceExtension: {
            id: 'plugin-a',
            register() {
              throw new Error('boom');
            },
          },
        }),
      })
    ).rejects.toThrow(
      'Governance extension "plugin-a" from "plugin-a/governance-extension" failed during registration: boom'
    );
  });
});
