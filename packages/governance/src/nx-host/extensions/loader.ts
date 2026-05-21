import {
  GovernanceExtensionRegistrationError,
  type GovernanceLoadedExtension,
} from '../../extensions/runtime.js';
import type { GovernanceExtensionDiagnostic } from '../../extensions/diagnostics.js';

export interface GovernanceExtensionLoadRequest {
  sourceSpecifier: string;
  moduleSpecifier: string;
  source: 'explicit' | 'legacy';
  optional?: boolean;
}

export interface LoadGovernanceExtensionsOptions {
  loadRequests?: readonly GovernanceExtensionLoadRequest[];
  moduleLoader?: GovernanceExtensionModuleLoader;
}

export type GovernanceExtensionModuleLoader = (
  specifier: string
) => Promise<unknown>;

export async function loadGovernanceExtensions(
  options: LoadGovernanceExtensionsOptions = {}
): Promise<GovernanceLoadedExtension[]> {
  const result = await loadGovernanceExtensionsWithDiagnostics(options);
  return result.extensions;
}

export async function loadGovernanceExtensionsWithDiagnostics(
  options: LoadGovernanceExtensionsOptions = {}
): Promise<{
  extensions: GovernanceLoadedExtension[];
  diagnostics: GovernanceExtensionDiagnostic[];
}> {
  const moduleLoader = options.moduleLoader ?? defaultGovernanceModuleLoader;
  const extensions: GovernanceLoadedExtension[] = [];
  const diagnostics: GovernanceExtensionDiagnostic[] = [];
  const loadRequests = [...(options.loadRequests ?? [])];

  if (loadRequests.some((request) => request.source === 'legacy')) {
    diagnostics.push({
      code: 'governance.extension.legacy_probing_used',
      severity: 'warning',
      message:
        'Legacy governance extension probing from nx.json.plugins is deprecated. Register governance extensions explicitly under nx.json.governance.extensions instead.',
      legacy: true,
    });
  }

  for (const loadRequest of loadRequests) {
    try {
      const loadedModule = await moduleLoader(loadRequest.moduleSpecifier);
      const governanceExtension =
        readGovernanceExtensionDefinition(loadedModule);

      extensions.push({
        sourceSpecifier: loadRequest.sourceSpecifier,
        moduleSpecifier: loadRequest.moduleSpecifier,
        legacy: loadRequest.source === 'legacy',
        definition: governanceExtension,
      });
      diagnostics.push({
        code: 'governance.extension.loaded',
        severity: 'notice',
        message: `Loaded governance extension from "${loadRequest.moduleSpecifier}".`,
        packageName: loadRequest.sourceSpecifier,
        moduleSpecifier: loadRequest.moduleSpecifier,
        extensionId: governanceExtension.id,
        legacy: loadRequest.source === 'legacy',
      });
    } catch (error) {
      if (
        shouldSkipMissingGovernanceExtension(
          error,
          loadRequest.moduleSpecifier,
          loadRequest
        )
      ) {
        diagnostics.push(
          createMissingExtensionDiagnostic(
            loadRequest,
            loadRequest.source === 'legacy'
              ? 'governance.extension.legacy_entrypoint_missing'
              : 'governance.extension.skipped_optional_missing'
          )
        );
        continue;
      }

      if (
        loadRequest.source === 'explicit' &&
        isMissingDirectModuleLookup(error, loadRequest.moduleSpecifier)
      ) {
        diagnostics.push(
          createMissingExtensionDiagnostic(
            loadRequest,
            'governance.extension.missing_required'
          )
        );
        throw new GovernanceExtensionRegistrationError(
          toErrorMessage(error),
          diagnostics
        );
      }

      if (isInvalidGovernanceExtensionDefinitionError(error)) {
        diagnostics.push({
          code: 'governance.extension.invalid_definition',
          severity: 'error',
          message: toErrorMessage(error),
          packageName: loadRequest.sourceSpecifier,
          moduleSpecifier: loadRequest.moduleSpecifier,
          legacy: loadRequest.source === 'legacy',
        });
        throw new GovernanceExtensionRegistrationError(
          toErrorMessage(error),
          diagnostics
        );
      }

      throw error;
    }
  }

  return {
    extensions,
    diagnostics,
  };
}

function createMissingExtensionDiagnostic(
  loadRequest: GovernanceExtensionLoadRequest,
  code:
    | 'governance.extension.skipped_optional_missing'
    | 'governance.extension.missing_required'
    | 'governance.extension.legacy_entrypoint_missing'
): GovernanceExtensionDiagnostic {
  const message =
    code === 'governance.extension.skipped_optional_missing'
      ? `Skipped optional governance extension "${loadRequest.moduleSpecifier}" because the package could not be resolved.`
      : code === 'governance.extension.missing_required'
      ? `Required governance extension "${loadRequest.moduleSpecifier}" could not be resolved.`
      : `Skipped legacy governance extension probe for "${loadRequest.moduleSpecifier}" because the governance entrypoint is missing.`;

  return {
    code,
    severity:
      code === 'governance.extension.missing_required' ? 'error' : 'notice',
    message,
    packageName: loadRequest.sourceSpecifier,
    moduleSpecifier: loadRequest.moduleSpecifier,
    legacy: loadRequest.source === 'legacy',
  };
}

function readGovernanceExtensionDefinition(
  loadedModule: unknown
): GovernanceLoadedExtension['definition'] {
  const governanceExtension = (
    loadedModule as { governanceExtension?: unknown }
  )?.governanceExtension;

  if (
    !governanceExtension ||
    typeof governanceExtension !== 'object' ||
    typeof (governanceExtension as GovernanceLoadedExtension['definition'])
      .register !== 'function'
  ) {
    throw new Error(
      'Governance extension module must export a named "governanceExtension" definition.'
    );
  }

  return governanceExtension as GovernanceLoadedExtension['definition'];
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

function shouldSkipMissingGovernanceExtension(
  error: unknown,
  moduleSpecifier: string,
  loadRequest: GovernanceExtensionLoadRequest
): boolean {
  if (loadRequest.source === 'legacy') {
    return isMissingGovernanceEntrypoint(error, moduleSpecifier);
  }

  return (
    loadRequest.optional === true &&
    isMissingDirectModuleLookup(error, moduleSpecifier)
  );
}

function isMissingDirectModuleLookup(
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

function isInvalidGovernanceExtensionDefinitionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message ===
      'Governance extension module must export a named "governanceExtension" definition.'
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

function splitPackageSubpath(specifier: string): {
  packageName: string;
  subpath: string;
} {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return {
      packageName: parts.slice(0, 2).join('/'),
      subpath: `./${parts.slice(2).join('/')}`,
    };
  }

  const [packageName, ...rest] = specifier.split('/');
  return {
    packageName: packageName ?? specifier,
    subpath: `./${rest.join('/')}`,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
