import { logger } from '@nx/devkit';
import { GovernanceProfile, GovernanceWorkspace } from '../core/index.js';
import { GovernanceSignal } from '../signal-engine/index.js';
import { GovernanceExtensionHostContext } from './contracts.js';
import { DefaultGovernanceCapabilityRegistry } from './capabilities.js';
import {
  applyGovernanceEnrichers,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  evaluateGovernanceRulePacks,
  GovernanceExtensionRegistry,
  registerGovernanceExtensions,
  registerGovernanceExtensionsWithDiagnostics,
} from './host.js';

describe('registerGovernanceExtensions', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'frontend-layered',
    options: {
      output: 'cli',
      reportType: 'health',
    },
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    },
    capabilities: new DefaultGovernanceCapabilityRegistry([
      {
        id: 'capability:nx',
      },
    ]),
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

  function createGovernanceExtension(
    id: string,
    register: (host: {
      registerMetricProvider(value: unknown): void;
      registerSignalProvider(value: unknown): void;
      registerRulePack(value: unknown): void;
      registerEnricher(value: unknown): void;
      context: GovernanceExtensionHostContext;
    }) => void = () => undefined
  ) {
    return {
      governanceExtension: {
        id,
        register,
      },
    };
  }

  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads explicitly configured extension packages directly', async () => {
    const registry = await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          extensions: [
            {
              package: '@anarchitects/governance-extension-angular',
            },
          ],
        },
      },
      moduleLoader: async (specifier) => {
        if (specifier === '@anarchitects/governance-extension-angular') {
          return createGovernanceExtension('angular', (host) => {
            host.registerMetricProvider('metric-angular');
          });
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(registry).toEqual({
      metricProviders: [
        { pluginId: 'angular', contribution: 'metric-angular' },
      ],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
  });

  it('loads explicitly configured extensions before legacy plugin-discovered extensions', async () => {
    const registrationOrder: string[] = [];

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          legacyPluginProbing: true,
          extensions: [
            {
              package: '@anarchitects/governance-extension-angular',
            },
          ],
        },
        plugins: ['plugin-b'],
      },
      moduleLoader: async (specifier) => {
        if (specifier === '@anarchitects/governance-extension-angular') {
          return createGovernanceExtension('angular', () => {
            registrationOrder.push('explicit');
          });
        }

        if (specifier === 'plugin-b/governance-extension') {
          return createGovernanceExtension('plugin-b', () => {
            registrationOrder.push('legacy');
          });
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(registrationOrder).toEqual(['explicit', 'legacy']);
  });

  it('does not probe legacy plugins by default when explicit extensions are configured', async () => {
    const loadedSpecifiers: string[] = [];

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          extensions: [
            {
              package: '@anarchitects/governance-extension-angular',
            },
          ],
        },
        plugins: ['plugin-b'],
      },
      moduleLoader: async (specifier) => {
        loadedSpecifiers.push(specifier);

        if (specifier === '@anarchitects/governance-extension-angular') {
          return createGovernanceExtension('angular');
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(loadedSpecifiers).toEqual([
      '@anarchitects/governance-extension-angular',
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

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
    expect(logger.warn).toHaveBeenCalledWith(
      'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.'
    );
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
    expect(Object.keys(receivedContext ?? {}).sort()).toEqual([
      'capabilities',
      'inventory',
      'options',
      'profileName',
      'workspaceRoot',
    ]);
    expect(receivedContext?.capabilities.has('capability:nx')).toBe(true);
    expect(receivedContext?.capabilities.list()).toEqual([
      {
        id: 'capability:nx',
      },
    ]);
  });

  it('skips optional explicitly configured extensions when the package is missing', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
                optional: true,
              },
            ],
          },
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

  it('fails when a required explicitly configured extension package is missing', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
            ],
          },
        },
        moduleLoader: async (specifier) => {
          throw createMissingModuleError(specifier);
        },
      })
    ).rejects.toThrow(
      "Cannot find module '@anarchitects/governance-extension-angular'"
    );
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

  it('enables legacy probing alongside explicit extensions when legacyPluginProbing is true', async () => {
    const loadedSpecifiers: string[] = [];

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          extensions: [
            {
              package: '@anarchitects/governance-extension-angular',
            },
          ],
          legacyPluginProbing: true,
        },
        plugins: ['plugin-b'],
      },
      moduleLoader: async (specifier) => {
        loadedSpecifiers.push(specifier);

        if (specifier === '@anarchitects/governance-extension-angular') {
          return createGovernanceExtension('angular');
        }

        if (specifier === 'plugin-b/governance-extension') {
          return createGovernanceExtension('plugin-b');
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(loadedSpecifiers).toEqual([
      '@anarchitects/governance-extension-angular',
      'plugin-b/governance-extension',
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('disables legacy probing when legacyPluginProbing is false', async () => {
    const loadedSpecifiers: string[] = [];

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          extensions: [],
          legacyPluginProbing: false,
        },
        plugins: ['plugin-b'],
      },
      moduleLoader: async (specifier) => {
        loadedSpecifiers.push(specifier);
        return createGovernanceExtension('plugin-b');
      },
    });

    expect(loadedSpecifiers).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not load the same module specifier twice across explicit and legacy discovery', async () => {
    const loadedSpecifiers: string[] = [];

    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          extensions: [
            {
              package: 'plugin-a/governance-extension',
            },
          ],
        },
        plugins: ['plugin-a'],
      },
      moduleLoader: async (specifier) => {
        loadedSpecifiers.push(specifier);
        return createGovernanceExtension('plugin-a');
      },
    });

    expect(loadedSpecifiers).toEqual(['plugin-a/governance-extension']);
  });

  it('emits the legacy probing deprecation warning only once per discovery run', async () => {
    await registerGovernanceExtensions(baseContext, {
      nxJson: {
        governance: {
          legacyPluginProbing: true,
        },
        plugins: ['plugin-a', 'plugin-b'],
      },
      moduleLoader: async (specifier) => {
        if (specifier === 'plugin-a/governance-extension') {
          return createGovernanceExtension('plugin-a');
        }

        if (specifier === 'plugin-b/governance-extension') {
          return createGovernanceExtension('plugin-b');
        }

        throw new Error(`Unexpected specifier ${specifier}`);
      },
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.'
    );
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
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
              {
                package: '@anarchitects/governance-extension-typescript',
              },
            ],
          },
        },
        moduleLoader: async (specifier) =>
          specifier === '@anarchitects/governance-extension-angular'
            ? createGovernanceExtension('shared-extension')
            : createGovernanceExtension('shared-extension'),
      })
    ).rejects.toThrow('Duplicate governance extension id "shared-extension"');
  });

  it('fails optional explicit extensions when an installed package is missing a transitive dependency', async () => {
    await expect(
      registerGovernanceExtensions(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
                optional: true,
              },
            ],
          },
        },
        moduleLoader: async () => {
          throw createErrorWithCode(
            "Cannot find module '@anarchitects/governance-extension-angular/runtime-dependency'",
            'MODULE_NOT_FOUND'
          );
        },
      })
    ).rejects.toThrow(
      "Cannot find module '@anarchitects/governance-extension-angular/runtime-dependency'"
    );
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

describe('governance extension contribution ordering', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'frontend-layered',
    options: {
      output: 'cli',
      reportType: 'health',
    },
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    },
    capabilities: new DefaultGovernanceCapabilityRegistry([
      {
        id: 'capability:nx',
      },
    ]),
  };

  const testProfile = {
    name: 'frontend-layered',
  } as unknown as GovernanceProfile;

  async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  it('applies enrichers sequentially in registry order', async () => {
    const executionOrder: string[] = [];
    const registry: GovernanceExtensionRegistry = {
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [
        {
          pluginId: 'plugin-a',
          contribution: {
            async enrichWorkspace({
              workspace,
            }: {
              workspace: GovernanceWorkspace;
            }) {
              executionOrder.push('plugin-a');
              await wait(5);
              return {
                ...workspace,
                metadata: { order: ['plugin-a'] },
              };
            },
          },
        },
        {
          pluginId: 'plugin-b',
          contribution: {
            enrichWorkspace({ workspace }: { workspace: GovernanceWorkspace }) {
              executionOrder.push('plugin-b');
              return {
                ...workspace,
                metadata: {
                  order: [
                    ...(((workspace as { metadata?: { order?: string[] } })
                      .metadata?.order as string[] | undefined) ?? []),
                    'plugin-b',
                  ],
                },
              };
            },
          },
        },
      ],
    };

    const enriched = await applyGovernanceEnrichers(registry, {
      workspace: baseContext.inventory,
      profile: testProfile,
      context: baseContext,
    });

    expect(executionOrder).toEqual(['plugin-a', 'plugin-b']);
    expect(
      (enriched as { metadata?: { order?: string[] } }).metadata?.order
    ).toEqual(['plugin-a', 'plugin-b']);
  });

  it('preserves deterministic rule-pack ordering regardless of async completion timing', async () => {
    const registry: GovernanceExtensionRegistry = {
      metricProviders: [],
      signalProviders: [],
      enrichers: [],
      rulePacks: [
        {
          pluginId: 'plugin-a',
          contribution: {
            async evaluate() {
              await wait(10);
              return [
                {
                  id: 'violation-a',
                  ruleId: 'rule-a',
                  project: 'a',
                  severity: 'warning' as const,
                  category: 'architecture' as const,
                  message: 'A',
                },
              ];
            },
          },
        },
        {
          pluginId: 'plugin-b',
          contribution: {
            async evaluate() {
              await wait(1);
              return [
                {
                  id: 'violation-b',
                  ruleId: 'rule-b',
                  project: 'b',
                  severity: 'warning' as const,
                  category: 'architecture' as const,
                  message: 'B',
                },
              ];
            },
          },
        },
      ],
    };

    const violations = await evaluateGovernanceRulePacks(registry, {
      workspace: baseContext.inventory,
      profile: testProfile,
      context: baseContext,
    });

    expect(violations.map((violation) => violation.id)).toEqual([
      'violation-a',
      'violation-b',
    ]);
    expect(violations.map((violation) => violation.sourcePluginId)).toEqual([
      'plugin-a',
      'plugin-b',
    ]);
  });

  it('preserves deterministic signal-provider ordering regardless of async completion timing', async () => {
    const registry: GovernanceExtensionRegistry = {
      metricProviders: [],
      rulePacks: [],
      enrichers: [],
      signalProviders: [
        {
          pluginId: 'plugin-a',
          contribution: {
            async provideSignals() {
              await wait(10);
              return [
                {
                  id: 'signal-a',
                  type: 'signal-a',
                  severity: 'warning' as const,
                  category: 'boundary' as const,
                  message: 'A',
                  source: 'extension' as const,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  relatedProjectIds: [],
                },
              ] satisfies GovernanceSignal[];
            },
          },
        },
        {
          pluginId: 'plugin-b',
          contribution: {
            async provideSignals() {
              await wait(1);
              return [
                {
                  id: 'signal-b',
                  type: 'signal-b',
                  severity: 'warning' as const,
                  category: 'boundary' as const,
                  message: 'B',
                  source: 'extension' as const,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  relatedProjectIds: [],
                },
              ] satisfies GovernanceSignal[];
            },
          },
        },
      ],
    };

    const signals = await collectGovernanceSignals(registry, {
      workspace: baseContext.inventory,
      profile: testProfile,
      context: baseContext,
      violations: [],
      signals: [],
    });

    expect(signals.map((signal) => signal.id)).toEqual([
      'signal-a',
      'signal-b',
    ]);
    expect(signals.map((signal) => signal.sourcePluginId)).toEqual([
      'plugin-a',
      'plugin-b',
    ]);
  });

  it('preserves deterministic metric-provider ordering regardless of async completion timing', async () => {
    const registry: GovernanceExtensionRegistry = {
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
      metricProviders: [
        {
          pluginId: 'plugin-a',
          contribution: {
            async provideMetrics() {
              await wait(10);
              return [
                {
                  id: 'metric-a',
                  name: 'Metric A',
                  family: 'architecture' as const,
                  value: 1,
                  score: 10,
                  maxScore: 10,
                  unit: 'ratio' as const,
                },
              ];
            },
          },
        },
        {
          pluginId: 'plugin-b',
          contribution: {
            async provideMetrics() {
              await wait(1);
              return [
                {
                  id: 'metric-b',
                  name: 'Metric B',
                  family: 'architecture' as const,
                  value: 1,
                  score: 10,
                  maxScore: 10,
                  unit: 'ratio' as const,
                },
              ];
            },
          },
        },
      ],
    };

    const measurements = await collectGovernanceMeasurements(registry, {
      workspace: baseContext.inventory,
      profile: testProfile,
      context: baseContext,
      signals: [],
      measurements: [],
      violations: [],
    });

    expect(measurements.map((measurement) => measurement.id)).toEqual([
      'metric-a',
      'metric-b',
    ]);
    expect(
      measurements.map((measurement) => measurement.sourcePluginId)
    ).toEqual(['plugin-a', 'plugin-b']);
  });
});

describe('registerGovernanceExtensionsWithDiagnostics', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'frontend-layered',
    options: {
      output: 'cli',
      reportType: 'health',
    },
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    },
    capabilities: new DefaultGovernanceCapabilityRegistry([
      {
        id: 'capability:nx',
      },
    ]),
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

  function createGovernanceExtension(
    id: string,
    register: (host: {
      registerMetricProvider(value: unknown): void;
      registerSignalProvider(value: unknown): void;
      registerRulePack(value: unknown): void;
      registerEnricher(value: unknown): void;
      context: GovernanceExtensionHostContext;
    }) => void = () => undefined
  ) {
    return {
      governanceExtension: {
        id,
        register,
      },
    };
  }

  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits a loaded diagnostic for explicitly configured extensions', async () => {
    const result = await registerGovernanceExtensionsWithDiagnostics(
      baseContext,
      {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
            ],
          },
        },
        moduleLoader: async () => createGovernanceExtension('angular'),
      }
    );

    expect(result.diagnostics).toEqual([
      {
        code: 'governance.extension.loaded',
        severity: 'notice',
        message:
          'Loaded governance extension from "@anarchitects/governance-extension-angular".',
        packageName: '@anarchitects/governance-extension-angular',
        moduleSpecifier: '@anarchitects/governance-extension-angular',
        extensionId: 'angular',
        legacy: false,
      },
    ]);
  });

  it('emits a skipped diagnostic for optional missing explicit extensions and continues', async () => {
    const result = await registerGovernanceExtensionsWithDiagnostics(
      baseContext,
      {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
                optional: true,
              },
            ],
          },
        },
        moduleLoader: async (specifier) => {
          throw createMissingModuleError(specifier);
        },
      }
    );

    expect(result.registry).toEqual({
      metricProviders: [],
      signalProviders: [],
      rulePacks: [],
      enrichers: [],
    });
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.extension.skipped_optional_missing',
        severity: 'notice',
        message:
          'Skipped optional governance extension "@anarchitects/governance-extension-angular" because the package could not be resolved.',
        packageName: '@anarchitects/governance-extension-angular',
        moduleSpecifier: '@anarchitects/governance-extension-angular',
        legacy: false,
      },
    ]);
  });

  it('emits a missing-required diagnostic and throws for required missing explicit extensions', async () => {
    await expect(
      registerGovernanceExtensionsWithDiagnostics(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
            ],
          },
        },
        moduleLoader: async (specifier) => {
          throw createMissingModuleError(specifier);
        },
      })
    ).rejects.toMatchObject({
      diagnostics: [
        {
          code: 'governance.extension.missing_required',
          severity: 'error',
          packageName: '@anarchitects/governance-extension-angular',
          moduleSpecifier: '@anarchitects/governance-extension-angular',
          legacy: false,
        },
      ],
    });
  });

  it('emits a legacy probing diagnostic once when compatibility probing is used', async () => {
    const result = await registerGovernanceExtensionsWithDiagnostics(
      baseContext,
      {
        nxJson: {
          governance: {
            legacyPluginProbing: true,
          },
          plugins: ['plugin-a', 'plugin-b'],
        },
        moduleLoader: async (specifier) => {
          if (specifier === 'plugin-a/governance-extension') {
            throw createMissingModuleError(specifier);
          }

          if (specifier === 'plugin-b/governance-extension') {
            return createGovernanceExtension('plugin-b');
          }

          throw new Error(`Unexpected specifier ${specifier}`);
        },
      }
    );

    expect(
      result.diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === 'governance.extension.legacy_probing_used'
      )
    ).toEqual([
      {
        code: 'governance.extension.legacy_probing_used',
        severity: 'warning',
        message:
          'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.',
        legacy: true,
      },
    ]);
  });

  it('emits a missing legacy entrypoint diagnostic and continues', async () => {
    const result = await registerGovernanceExtensionsWithDiagnostics(
      baseContext,
      {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async (specifier) => {
          throw createMissingModuleError(specifier);
        },
      }
    );

    expect(result.diagnostics).toEqual([
      {
        code: 'governance.extension.legacy_probing_used',
        severity: 'warning',
        message:
          'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.',
        legacy: true,
      },
      {
        code: 'governance.extension.legacy_entrypoint_missing',
        severity: 'notice',
        message:
          'Skipped legacy governance extension probe for "plugin-a/governance-extension" because the governance entrypoint is missing.',
        packageName: 'plugin-a',
        moduleSpecifier: 'plugin-a/governance-extension',
        legacy: true,
      },
    ]);
  });

  it('emits an invalid-definition diagnostic before throwing', async () => {
    await expect(
      registerGovernanceExtensionsWithDiagnostics(baseContext, {
        nxJson: {
          plugins: ['plugin-a'],
        },
        moduleLoader: async () => ({
          default: {
            id: 'plugin-a',
          },
        }),
      })
    ).rejects.toMatchObject({
      diagnostics: [
        {
          code: 'governance.extension.legacy_probing_used',
        },
        {
          code: 'governance.extension.invalid_definition',
          severity: 'error',
          moduleSpecifier: 'plugin-a/governance-extension',
          packageName: 'plugin-a',
          legacy: true,
        },
      ],
    });
  });

  it('emits a duplicate-id diagnostic before throwing', async () => {
    await expect(
      registerGovernanceExtensionsWithDiagnostics(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
              {
                package: '@anarchitects/governance-extension-typescript',
              },
            ],
          },
        },
        moduleLoader: async (specifier) =>
          specifier === '@anarchitects/governance-extension-angular'
            ? createGovernanceExtension('shared-extension')
            : createGovernanceExtension('shared-extension'),
      })
    ).rejects.toMatchObject({
      diagnostics: [
        {
          code: 'governance.extension.loaded',
          moduleSpecifier: '@anarchitects/governance-extension-angular',
        },
        {
          code: 'governance.extension.loaded',
          moduleSpecifier: '@anarchitects/governance-extension-typescript',
        },
        {
          code: 'governance.extension.duplicate_id',
          severity: 'error',
          extensionId: 'shared-extension',
          moduleSpecifier: '@anarchitects/governance-extension-typescript',
        },
      ],
    });
  });

  it('emits a registration-failed diagnostic before throwing', async () => {
    await expect(
      registerGovernanceExtensionsWithDiagnostics(baseContext, {
        nxJson: {
          governance: {
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
            ],
          },
        },
        moduleLoader: async () =>
          createGovernanceExtension('angular', () => {
            throw new Error('boom');
          }),
      })
    ).rejects.toMatchObject({
      diagnostics: [
        {
          code: 'governance.extension.loaded',
          moduleSpecifier: '@anarchitects/governance-extension-angular',
        },
        {
          code: 'governance.extension.registration_failed',
          severity: 'error',
          extensionId: 'angular',
          moduleSpecifier: '@anarchitects/governance-extension-angular',
        },
      ],
    });
  });

  it('preserves deterministic diagnostic order', async () => {
    const result = await registerGovernanceExtensionsWithDiagnostics(
      baseContext,
      {
        nxJson: {
          governance: {
            legacyPluginProbing: true,
            extensions: [
              {
                package: '@anarchitects/governance-extension-angular',
              },
              {
                package: '@anarchitects/governance-extension-typescript',
                optional: true,
              },
            ],
          },
          plugins: ['plugin-a'],
        },
        moduleLoader: async (specifier) => {
          if (specifier === '@anarchitects/governance-extension-angular') {
            return createGovernanceExtension('angular');
          }

          if (specifier === '@anarchitects/governance-extension-typescript') {
            throw createMissingModuleError(specifier);
          }

          if (specifier === 'plugin-a/governance-extension') {
            throw createMissingModuleError(specifier);
          }

          throw new Error(`Unexpected specifier ${specifier}`);
        },
      }
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'governance.extension.legacy_probing_used',
      'governance.extension.loaded',
      'governance.extension.skipped_optional_missing',
      'governance.extension.legacy_entrypoint_missing',
    ]);
  });
});
