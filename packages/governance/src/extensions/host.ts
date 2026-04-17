import { workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

import { GovernanceWorkspace } from '../core/models.js';
import { AdapterWorkspaceSnapshot } from '../nx-adapter/types.js';

export interface GovernanceExtensionDefinition {
  id: string;
  register(host: GovernanceExtensionHost): void | Promise<void>;
}

export interface GovernanceExtensionHostContext {
  workspaceRoot: string;
  profileName: string;
  options: Readonly<Record<string, unknown>>;
  snapshot: AdapterWorkspaceSnapshot;
  inventory: GovernanceWorkspace;
}

export interface GovernanceExtensionRegistry {
  analyzers: unknown[];
  metricProviders: unknown[];
  signalProviders: unknown[];
  rulePacks: unknown[];
  enrichers: unknown[];
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

export class GovernanceExtensionHost {
  readonly context: GovernanceExtensionHostContext;

  private readonly registry: GovernanceExtensionRegistry = {
    analyzers: [],
    metricProviders: [],
    signalProviders: [],
    rulePacks: [],
    enrichers: [],
  };

  constructor(context: GovernanceExtensionHostContext) {
    this.context = Object.freeze({
      ...context,
      options: Object.freeze({ ...context.options }),
    });
  }

  registerAnalyzer(analyzer: unknown): void {
    this.registry.analyzers.push(analyzer);
  }

  registerMetricProvider(metricProvider: unknown): void {
    this.registry.metricProviders.push(metricProvider);
  }

  registerSignalProvider(signalProvider: unknown): void {
    this.registry.signalProviders.push(signalProvider);
  }

  registerRulePack(rulePack: unknown): void {
    this.registry.rulePacks.push(rulePack);
  }

  registerEnricher(enricher: unknown): void {
    this.registry.enrichers.push(enricher);
  }

  toRegistry(): GovernanceExtensionRegistry {
    return {
      analyzers: [...this.registry.analyzers],
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
  const host = new GovernanceExtensionHost(context);
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
      await extension.definition.register(host);
    } catch (error) {
      throw new Error(
        `Governance extension "${extension.definition.id}" from "${
          extension.moduleSpecifier
        }" failed during registration: ${toErrorMessage(error)}`
      );
    }
  }

  return host.toRegistry();
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
  const isModuleNotFoundCode =
    errorCode === 'ERR_MODULE_NOT_FOUND' || errorCode === 'MODULE_NOT_FOUND';
  const mentionsModuleSpecifier =
    message.includes(`'${moduleSpecifier}'`) ||
    message.includes(`"${moduleSpecifier}"`) ||
    message.includes(` ${moduleSpecifier} `) ||
    message.endsWith(moduleSpecifier);

  return isModuleNotFoundCode
    ? mentionsModuleSpecifier
    : message.startsWith('Cannot find module') && mentionsModuleSpecifier;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}
