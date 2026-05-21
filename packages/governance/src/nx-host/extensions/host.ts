import { logger, workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

import type { GovernanceExtensionHostContext } from '../../extensions/contracts.js';
import {
  type GovernanceExtensionModuleLoader,
  type GovernanceExtensionRegistrationResult,
  type GovernanceExtensionRegistry,
  type GovernanceExtensionLoadRequest,
  registerGovernanceExtensionsWithDiagnostics,
} from '../../extensions/host.js';
import type { GovernanceExtensionConfig } from '../../extensions/config.js';

import { loadGovernanceExtensionConfig } from './config.js';

interface NxJsonPluginConfig {
  plugin?: string;
  options?: unknown;
}

interface NxJsonShape {
  plugins?: Array<string | NxJsonPluginConfig>;
  governance?: {
    extensions?: unknown;
    legacyPluginProbing?: unknown;
  };
}

export interface DiscoverGovernanceExtensionsOptions {
  workspaceRoot?: string;
  nxJson?: NxJsonShape;
  moduleLoader?: GovernanceExtensionModuleLoader;
}

export type RegisterGovernanceExtensionsOptions =
  DiscoverGovernanceExtensionsOptions;

export async function registerNxGovernanceExtensions(
  context: GovernanceExtensionHostContext,
  options: RegisterGovernanceExtensionsOptions = {}
): Promise<GovernanceExtensionRegistry> {
  const result = await registerNxGovernanceExtensionsWithDiagnostics(
    context,
    options
  );

  return result.registry;
}

export async function registerNxGovernanceExtensionsWithDiagnostics(
  context: GovernanceExtensionHostContext,
  options: RegisterGovernanceExtensionsOptions = {}
): Promise<GovernanceExtensionRegistrationResult> {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  const governanceExtensionConfig = loadGovernanceExtensionConfig({ nxJson });
  const loadRequests = buildGovernanceExtensionLoadRequests(
    nxJson,
    governanceExtensionConfig
  );

  if (loadRequests.some((request) => request.source === 'legacy')) {
    logger.warn(
      'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.'
    );
  }

  return registerGovernanceExtensionsWithDiagnostics(context, {
    loadRequests,
    moduleLoader: options.moduleLoader,
  });
}

export async function discoverNxGovernanceExtensionLoadRequests(
  options: DiscoverGovernanceExtensionsOptions = {}
): Promise<GovernanceExtensionLoadRequest[]> {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  const governanceExtensionConfig = loadGovernanceExtensionConfig({ nxJson });

  return buildGovernanceExtensionLoadRequests(
    nxJson,
    governanceExtensionConfig
  );
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

function buildGovernanceExtensionLoadRequests(
  nxJson: NxJsonShape,
  governanceExtensionConfig: GovernanceExtensionConfig
): GovernanceExtensionLoadRequest[] {
  const seenModuleSpecifiers = new Set<string>();
  const requests: GovernanceExtensionLoadRequest[] = [];

  for (const registration of governanceExtensionConfig.extensions) {
    appendLoadRequest(requests, seenModuleSpecifiers, {
      sourceSpecifier: registration.package,
      moduleSpecifier: registration.package,
      source: 'explicit',
      optional: registration.optional ?? false,
    });
  }

  if (!shouldProbeLegacyPlugins(governanceExtensionConfig)) {
    return requests;
  }

  for (const pluginSpecifier of normalizePluginSpecifiers(nxJson.plugins)) {
    appendLoadRequest(requests, seenModuleSpecifiers, {
      sourceSpecifier: pluginSpecifier,
      moduleSpecifier: toGovernanceExtensionModuleSpecifier(pluginSpecifier),
      source: 'legacy',
    });
  }

  return requests;
}

function shouldProbeLegacyPlugins(config: GovernanceExtensionConfig): boolean {
  if (config.legacyPluginProbing !== undefined) {
    return config.legacyPluginProbing;
  }

  return config.extensions.length === 0;
}

function appendLoadRequest(
  target: GovernanceExtensionLoadRequest[],
  seenModuleSpecifiers: Set<string>,
  request: GovernanceExtensionLoadRequest
): void {
  if (seenModuleSpecifiers.has(request.moduleSpecifier)) {
    return;
  }

  seenModuleSpecifiers.add(request.moduleSpecifier);
  target.push(request);
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}
