import {
  GovernanceExtensionHostContext,
  registerGovernanceExtensions,
} from './host.js';

describe('registerGovernanceExtensions', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'frontend-layered',
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

  function createErrorWithCode(message: string, code: string): Error {
    const error = new Error(message);
    (error as Error & { code: string }).code = code;
    return error;
  }

  function createMissingModuleError(specifier: string): Error {
    return createErrorWithCode(
      `Cannot find module '${specifier}'`,
      'MODULE_NOT_FOUND'
    );
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
                registerMetricProvider(value: unknown): void;
                registerRulePack(value: unknown): void;
              }) {
                registrationOrder.push('plugin-a');
                host.registerMetricProvider('metric-a');
                host.registerRulePack('rule-a');
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
      metricProviders: [{ pluginId: 'plugin-a', contribution: 'metric-a' }],
      signalProviders: [{ pluginId: 'plugin-b', contribution: 'signal-b' }],
      rulePacks: [
        { pluginId: 'plugin-a', contribution: 'rule-a' },
        { pluginId: 'plugin-b', contribution: 'rule-b' },
      ],
      enrichers: [{ pluginId: 'plugin-b', contribution: 'enricher-b' }],
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
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
  });

  it('ignores plugins whose governance entrypoint subpath is not exported', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['@nx/jest/plugin'],
        },
        moduleLoader: async () => {
          throw createErrorWithCode(
            'Package subpath \'./plugin/governance-extension\' is not defined by "exports" in /repo/node_modules/@nx/jest/package.json',
            'ERR_PACKAGE_PATH_NOT_EXPORTED'
          );
        },
      })
    ).resolves.toEqual({
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
  });

  it('ignores absolute-path module lookup failures for missing governance entrypoints', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['@nx/playwright/plugin'],
        },
        moduleLoader: async () => {
          throw createErrorWithCode(
            "Cannot find module '/repo/node_modules/@nx/playwright/plugin/governance-extension/index.js' imported from /repo/dist/index.js",
            'ERR_MODULE_NOT_FOUND'
          );
        },
      })
    ).resolves.toEqual({
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
  });

  it('rethrows unrelated module resolution errors', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async () => {
          throw createErrorWithCode(
            "Cannot find module 'plugin-a/runtime-dependency'",
            'MODULE_NOT_FOUND'
          );
        },
      })
    ).rejects.toThrow("Cannot find module 'plugin-a/runtime-dependency'");
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
