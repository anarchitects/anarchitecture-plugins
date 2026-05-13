import { workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

import { GovernanceWorkspace, Measurement, Violation } from '../core/index.js';
import { GovernanceSignal } from '../signal-engine/index.js';
import {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost as GovernanceExtensionHostContract,
  GovernanceExtensionHostContext,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceRulePack,
  GovernanceRulePackInput,
  GovernanceSignalProvider,
  GovernanceSignalProviderInput,
  GovernanceWorkspaceEnricher,
  GovernanceWorkspaceEnricherInput,
} from './contracts.js';

interface RegisteredGovernanceContribution<T> {
  pluginId: string;
  contribution: T;
}

export interface GovernanceExtensionRegistry {
  metricProviders: RegisteredGovernanceContribution<GovernanceMetricProvider>[];
  signalProviders: RegisteredGovernanceContribution<GovernanceSignalProvider>[];
  rulePacks: RegisteredGovernanceContribution<GovernanceRulePack>[];
  enrichers: RegisteredGovernanceContribution<GovernanceWorkspaceEnricher>[];
}

interface NxJsonPluginConfig {
  plugin?: string;
}

interface NxJsonShape {
  plugins?: Array<string | NxJsonPluginConfig>;
}

interface DiscoveredGovernanceExtension {
  pluginSpecifier: string;
  moduleSpecifier: string;
  definition: GovernanceExtensionDefinition;
}

export interface DiscoverGovernanceExtensionsOptions {
  workspaceRoot?: string;
  nxJson?: NxJsonShape;
  moduleLoader?: GovernanceExtensionModuleLoader;
}

export type RegisterGovernanceExtensionsOptions =
  DiscoverGovernanceExtensionsOptions;

export type GovernanceExtensionModuleLoader = (
  specifier: string
) => Promise<unknown>;

export class GovernanceExtensionHost
  implements GovernanceExtensionHostContract
{
  readonly context: GovernanceExtensionHostContext;

  private readonly registry: GovernanceExtensionRegistry = {
    metricProviders: [],
    signalProviders: [],
    rulePacks: [],
    enrichers: [],
  };

  private readonly pluginId: string;

  constructor(context: GovernanceExtensionHostContext, pluginId: string) {
    this.context = Object.freeze({
      ...context,
      options: Object.freeze({ ...context.options }),
    });
    this.pluginId = pluginId;
  }

  registerMetricProvider(metricProvider: GovernanceMetricProvider): void {
    this.registry.metricProviders.push({
      pluginId: this.pluginId,
      contribution: metricProvider,
    });
  }

  registerSignalProvider(signalProvider: GovernanceSignalProvider): void {
    this.registry.signalProviders.push({
      pluginId: this.pluginId,
      contribution: signalProvider,
    });
  }

  registerRulePack(rulePack: GovernanceRulePack): void {
    this.registry.rulePacks.push({
      pluginId: this.pluginId,
      contribution: rulePack,
    });
  }

  registerEnricher(enricher: GovernanceWorkspaceEnricher): void {
    this.registry.enrichers.push({
      pluginId: this.pluginId,
      contribution: enricher,
    });
  }

  toRegistry(): GovernanceExtensionRegistry {
    return {
      metricProviders: [...this.registry.metricProviders],
      signalProviders: [...this.registry.signalProviders],
      rulePacks: [...this.registry.rulePacks],
      enrichers: [...this.registry.enrichers],
    };
  }
}

export async function discoverGovernanceExtensions(
  options: DiscoverGovernanceExtensionsOptions = {}
): Promise<DiscoveredGovernanceExtension[]> {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  const moduleLoader = options.moduleLoader ?? defaultGovernanceModuleLoader;
  const extensions: DiscoveredGovernanceExtension[] = [];

  for (const pluginSpecifier of normalizePluginSpecifiers(nxJson.plugins)) {
    const moduleSpecifier =
      toGovernanceExtensionModuleSpecifier(pluginSpecifier);

    try {
      const loadedModule = await moduleLoader(moduleSpecifier);
      const governanceExtension =
        readGovernanceExtensionDefinition(loadedModule);

      extensions.push({
        pluginSpecifier,
        moduleSpecifier,
        definition: governanceExtension,
      });
    } catch (error) {
      if (isMissingGovernanceEntrypoint(error, moduleSpecifier)) {
        continue;
      }

      throw error;
    }
  }

  return extensions;
}

export async function registerGovernanceExtensions(
  context: GovernanceExtensionHostContext,
  options: RegisterGovernanceExtensionsOptions = {}
): Promise<GovernanceExtensionRegistry> {
  const registry: GovernanceExtensionRegistry = {
    metricProviders: [],
    signalProviders: [],
    rulePacks: [],
    enrichers: [],
  };
  const discoveredExtensions = await discoverGovernanceExtensions(options);
  const seenExtensionIds = new Map<string, string>();

  for (const extension of discoveredExtensions) {
    validateGovernanceExtensionId(extension);

    const previousModule = seenExtensionIds.get(extension.definition.id);
    if (previousModule) {
      throw new Error(
        `Duplicate governance extension id "${extension.definition.id}" was found in "${previousModule}" and "${extension.moduleSpecifier}".`
      );
    }

    seenExtensionIds.set(extension.definition.id, extension.moduleSpecifier);

    try {
      const host = new GovernanceExtensionHost(
        context,
        extension.definition.id
      );
      await extension.definition.register(host);
      mergeRegistry(registry, host.toRegistry());
    } catch (error) {
      throw new Error(
        `Governance extension "${extension.definition.id}" from "${
          extension.moduleSpecifier
        }" failed during registration: ${toErrorMessage(error)}`
      );
    }
  }

  return registry;
}

export async function applyGovernanceEnrichers(
  registry: GovernanceExtensionRegistry,
  input: GovernanceWorkspaceEnricherInput
): Promise<GovernanceWorkspace> {
  let workspace = input.workspace;

  for (const enricher of registry.enrichers) {
    const enrichedWorkspace = await enricher.contribution.enrichWorkspace({
      ...input,
      workspace,
    });
    workspace = enrichedWorkspace;
  }

  return workspace;
}

export async function evaluateGovernanceRulePacks(
  registry: GovernanceExtensionRegistry,
  input: GovernanceRulePackInput
): Promise<Violation[]> {
  const violations = await Promise.all(
    registry.rulePacks.map(async (rulePack) => {
      const providedViolations = await rulePack.contribution.evaluate(input);
      return providedViolations.map((violation) => ({
        ...violation,
        sourcePluginId: violation.sourcePluginId ?? rulePack.pluginId,
      }));
    })
  );

  return violations.flat();
}

export async function collectGovernanceSignals(
  registry: GovernanceExtensionRegistry,
  input: GovernanceSignalProviderInput
): Promise<GovernanceSignal[]> {
  const signals = await Promise.all(
    registry.signalProviders.map(async (signalProvider) => {
      const providedSignals = await signalProvider.contribution.provideSignals(
        input
      );
      return providedSignals.map((signal) => ({
        ...signal,
        source: 'extension' as const,
        sourcePluginId: signal.sourcePluginId ?? signalProvider.pluginId,
      }));
    })
  );

  return signals.flat();
}

export async function collectGovernanceMeasurements(
  registry: GovernanceExtensionRegistry,
  input: GovernanceMetricProviderInput
): Promise<Measurement[]> {
  const measurements = await Promise.all(
    registry.metricProviders.map(async (metricProvider) => {
      const providedMeasurements =
        await metricProvider.contribution.provideMetrics(input);
      return providedMeasurements.map((measurement) => ({
        ...measurement,
        sourcePluginId: measurement.sourcePluginId ?? metricProvider.pluginId,
      }));
    })
  );

  return measurements.flat();
}

function readNxJson(workspaceRoot = defaultWorkspaceRoot): NxJsonShape {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');

  try {
    const raw = fs.readFileSync(nxJsonPath, 'utf8');
    return JSON.parse(raw) as NxJsonShape;
  } catch (error) {
    throw new Error(
      `Unable to read Nx plugin configuration from ${nxJsonPath}: ${toErrorMessage(
        error
      )}`
    );
  }
}

function mergeRegistry(
  target: GovernanceExtensionRegistry,
  source: GovernanceExtensionRegistry
): void {
  target.metricProviders.push(...source.metricProviders);
  target.signalProviders.push(...source.signalProviders);
  target.rulePacks.push(...source.rulePacks);
  target.enrichers.push(...source.enrichers);
}

function normalizePluginSpecifiers(
  plugins: NxJsonShape['plugins'] = []
): string[] {
  return plugins.flatMap((pluginEntry) => {
    const pluginSpecifier =
      typeof pluginEntry === 'string' ? pluginEntry : pluginEntry?.plugin;

    if (
      typeof pluginSpecifier !== 'string' ||
      pluginSpecifier.trim().length === 0 ||
      pluginSpecifier === '@anarchitects/nx-governance' ||
      isLocalPluginSpecifier(pluginSpecifier)
    ) {
      return [];
    }

    return [pluginSpecifier];
  });
}

function isLocalPluginSpecifier(pluginSpecifier: string): boolean {
  return (
    pluginSpecifier.startsWith('.') ||
    pluginSpecifier.startsWith('/') ||
    pluginSpecifier.startsWith('file:')
  );
}

function toGovernanceExtensionModuleSpecifier(pluginSpecifier: string): string {
  return `${pluginSpecifier}/governance-extension`;
}

function readGovernanceExtensionDefinition(
  loadedModule: unknown
): GovernanceExtensionDefinition {
  const governanceExtension = (
    loadedModule as { governanceExtension?: unknown }
  )?.governanceExtension;

  if (
    !governanceExtension ||
    typeof governanceExtension !== 'object' ||
    typeof (governanceExtension as GovernanceExtensionDefinition).register !==
      'function'
  ) {
    throw new Error(
      'Governance extension module must export a named "governanceExtension" definition.'
    );
  }

  return governanceExtension as GovernanceExtensionDefinition;
}

function validateGovernanceExtensionId(
  extension: DiscoveredGovernanceExtension
): void {
  if (
    typeof extension.definition.id !== 'string' ||
    extension.definition.id.trim().length === 0
  ) {
    throw new Error(
      `Governance extension module "${extension.moduleSpecifier}" must declare a non-empty "id".`
    );
  }
}

async function defaultGovernanceModuleLoader(
  specifier: string
): Promise<unknown> {
  return import(specifier);
}

function isMissingGovernanceEntrypoint(
  error: unknown,
  moduleSpecifier: string
): boolean {
  const errorRecord =
    error && typeof error === 'object'
      ? (error as { code?: string; message?: string })
      : undefined;

  const message = errorRecord?.message;
  if (typeof message !== 'string') {
    return false;
  }

  const errorCode = errorRecord?.code;
  if (errorCode === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
    return matchesGovernanceEntrypointSubpath(message, moduleSpecifier);
  }

  if (
    errorCode === 'ERR_MODULE_NOT_FOUND' ||
    errorCode === 'MODULE_NOT_FOUND'
  ) {
    return matchesGovernanceEntrypointLookup(message, moduleSpecifier);
  }

  return (
    message.startsWith('Cannot find module') &&
    matchesGovernanceEntrypointLookup(message, moduleSpecifier)
  );
}

function matchesGovernanceEntrypointSubpath(
  message: string,
  moduleSpecifier: string
): boolean {
  const { packageName, subpath } = splitPackageSubpath(moduleSpecifier);

  return (
    message.includes('Package subpath') &&
    message.includes(packageName) &&
    message.includes(subpath)
  );
}

function matchesGovernanceEntrypointLookup(
  message: string,
  moduleSpecifier: string
): boolean {
  const normalizedSpecifier = normalizeLookupTarget(moduleSpecifier);
  const quotedTargets = extractQuotedValues(message);

  return quotedTargets.some((target) =>
    isMatchingGovernanceLookupTarget(target, normalizedSpecifier)
  );
}

function isMatchingGovernanceLookupTarget(
  target: string,
  normalizedSpecifier: string
): boolean {
  const normalizedTarget = normalizeLookupTarget(target);

  return (
    normalizedTarget === normalizedSpecifier ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}.js`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}.mjs`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}.cjs`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}/index.js`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}/index.mjs`) ||
    normalizedTarget.endsWith(`/${normalizedSpecifier}/index.cjs`)
  );
}

function extractQuotedValues(message: string): string[] {
  return [...message.matchAll(/['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? ''
  );
}

function normalizeLookupTarget(target: string): string {
  return target
    .replace(/^file:\/\/\/?/, '/')
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function splitPackageSubpath(moduleSpecifier: string): {
  packageName: string;
  subpath: string;
} {
  const segments = moduleSpecifier.split('/');
  const packageSegments = moduleSpecifier.startsWith('@')
    ? segments.slice(0, 2)
    : segments.slice(0, 1);
  const packageName = packageSegments.join('/');
  const subpathSegments = segments.slice(packageSegments.length);

  return {
    packageName,
    subpath: `./${subpathSegments.join('/')}`,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}
