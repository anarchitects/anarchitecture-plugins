export interface GovernanceExtensionRegistration {
  package: string;
  optional?: boolean;
  options?: Record<string, unknown>;
}

export interface GovernanceExtensionConfig {
  extensions: GovernanceExtensionRegistration[];
  legacyPluginProbing?: boolean;
}

export interface GovernanceExtensionConfigInput {
  extensions?: unknown;
  legacyPluginProbing?: unknown;
}

export type GovernanceExtensionConfigDiagnosticCode =
  | 'invalid-legacy-plugin-probing'
  | 'invalid-extensions'
  | 'invalid-extension-entry'
  | 'invalid-extension-package'
  | 'invalid-extension-optional'
  | 'invalid-extension-options'
  | 'duplicate-extension-package';

export interface GovernanceExtensionConfigDiagnostic {
  code: GovernanceExtensionConfigDiagnosticCode;
  path: string;
  message: string;
}

export interface GovernanceExtensionConfigParseResult {
  config?: GovernanceExtensionConfig;
  diagnostics: GovernanceExtensionConfigDiagnostic[];
}

export function validateGovernanceExtensionConfig(
  input: GovernanceExtensionConfigInput = {}
): GovernanceExtensionConfigParseResult {
  const diagnostics: GovernanceExtensionConfigDiagnostic[] = [];
  const extensions = input.extensions;
  const legacyPluginProbing =
    typeof input.legacyPluginProbing === 'boolean'
      ? input.legacyPluginProbing
      : undefined;
  const rawLegacyPluginProbing = input.legacyPluginProbing;

  if (
    rawLegacyPluginProbing !== undefined &&
    typeof rawLegacyPluginProbing !== 'boolean'
  ) {
    diagnostics.push({
      code: 'invalid-legacy-plugin-probing',
      path: 'governance.legacyPluginProbing',
      message:
        'Invalid governance extension config: governance.legacyPluginProbing must be a boolean when provided.',
    });
  }

  if (extensions === undefined) {
    return diagnostics.length > 0
      ? { diagnostics }
      : {
          diagnostics: [],
          config: {
            extensions: [],
            ...(legacyPluginProbing !== undefined
              ? { legacyPluginProbing }
              : {}),
          },
        };
  }

  if (!Array.isArray(extensions)) {
    diagnostics.push({
      code: 'invalid-extensions',
      path: 'governance.extensions',
      message:
        'Invalid governance extension config: governance.extensions must be an array.',
    });

    return {
      diagnostics,
    };
  }

  const registrations: GovernanceExtensionRegistration[] = [];
  const seenPackages = new Set<string>();

  for (const [index, entry] of extensions.entries()) {
    const parsedRegistration = parseRegistration(entry, index);

    if ('diagnostic' in parsedRegistration) {
      diagnostics.push(parsedRegistration.diagnostic);
      continue;
    }

    if (seenPackages.has(parsedRegistration.registration.package)) {
      diagnostics.push({
        code: 'duplicate-extension-package',
        path: `governance.extensions[${index}].package`,
        message: `Invalid governance extension config: duplicate extension package "${parsedRegistration.registration.package}" is not allowed.`,
      });
      continue;
    }

    seenPackages.add(parsedRegistration.registration.package);
    registrations.push(parsedRegistration.registration);
  }

  if (diagnostics.length > 0) {
    return {
      diagnostics,
    };
  }

  return {
    diagnostics: [],
    config: {
      extensions: registrations,
      ...(legacyPluginProbing !== undefined ? { legacyPluginProbing } : {}),
    },
  };
}

export function parseGovernanceExtensionConfig(
  input: GovernanceExtensionConfigInput = {}
): GovernanceExtensionConfig {
  const result = validateGovernanceExtensionConfig(input);
  const diagnostic = result.diagnostics[0];

  if (diagnostic) {
    throw new Error(diagnostic.message);
  }

  return result.config ?? { extensions: [] };
}

function parseRegistration(
  entry: unknown,
  index: number
):
  | {
      registration: GovernanceExtensionRegistration;
    }
  | {
      diagnostic: GovernanceExtensionConfigDiagnostic;
    } {
  const record = asRecord(entry);

  if (!record) {
    return {
      diagnostic: {
        code: 'invalid-extension-entry',
        path: `governance.extensions[${index}]`,
        message: `Invalid governance extension config: governance.extensions[${index}] must be an object.`,
      },
    };
  }

  const packageName = record.package;
  if (typeof packageName !== 'string' || packageName.trim().length === 0) {
    return {
      diagnostic: {
        code: 'invalid-extension-package',
        path: `governance.extensions[${index}].package`,
        message: `Invalid governance extension config: governance.extensions[${index}].package must be a non-empty string.`,
      },
    };
  }

  const optional = record.optional;
  if (optional !== undefined && typeof optional !== 'boolean') {
    return {
      diagnostic: {
        code: 'invalid-extension-optional',
        path: `governance.extensions[${index}].optional`,
        message: `Invalid governance extension config: governance.extensions[${index}].optional must be a boolean when provided.`,
      },
    };
  }

  const registration: GovernanceExtensionRegistration = {
    package: packageName,
  };

  if (optional !== undefined) {
    registration.optional = optional;
  }

  if (record.options !== undefined) {
    const parsedOptions = asRecord(record.options);
    if (!parsedOptions) {
      return {
        diagnostic: {
          code: 'invalid-extension-options',
          path: `governance.extensions[${index}].options`,
          message: `Invalid governance extension config: governance.extensions[${index}].options must be an object when provided.`,
        },
      };
    }

    registration.options = { ...parsedOptions };
  }

  return {
    registration,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
