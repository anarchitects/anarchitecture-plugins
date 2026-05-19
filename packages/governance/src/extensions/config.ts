import { workspaceRoot as defaultWorkspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

export interface GovernanceExtensionRegistration {
  package: string;
  optional?: boolean;
  options?: Record<string, unknown>;
}

export interface GovernanceExtensionConfig {
  extensions: GovernanceExtensionRegistration[];
}

interface NxJsonGovernanceShape {
  extensions?: unknown;
}

interface NxJsonShape {
  governance?: NxJsonGovernanceShape;
}

export interface LoadGovernanceExtensionConfigOptions {
  workspaceRoot?: string;
  nxJson?: NxJsonShape;
}

export function loadGovernanceExtensionConfig(
  options: LoadGovernanceExtensionConfigOptions = {}
): GovernanceExtensionConfig {
  const nxJson = options.nxJson ?? readNxJson(options.workspaceRoot);
  return parseGovernanceExtensionConfig(nxJson);
}

export function parseGovernanceExtensionConfig(
  nxJson: NxJsonShape = {}
): GovernanceExtensionConfig {
  const extensions = nxJson.governance?.extensions;

  if (extensions === undefined) {
    return {
      extensions: [],
    };
  }

  if (!Array.isArray(extensions)) {
    throw new Error(
      'Invalid governance extension config: nx.json governance.extensions must be an array.'
    );
  }

  const registrations = extensions.map((entry, index) =>
    parseRegistration(entry, index)
  );
  const seenPackages = new Set<string>();

  for (const registration of registrations) {
    if (seenPackages.has(registration.package)) {
      throw new Error(
        `Invalid governance extension config: duplicate extension package "${registration.package}" is not allowed.`
      );
    }

    seenPackages.add(registration.package);
  }

  return {
    extensions: registrations,
  };
}

function readNxJson(workspaceRoot = defaultWorkspaceRoot): NxJsonShape {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');

  try {
    return JSON.parse(fs.readFileSync(nxJsonPath, 'utf8')) as NxJsonShape;
  } catch (error) {
    throw new Error(
      `Unable to read governance extension config from ${nxJsonPath}: ${toErrorMessage(
        error
      )}`
    );
  }
}

function parseRegistration(
  entry: unknown,
  index: number
): GovernanceExtensionRegistration {
  const record = asRecord(entry);

  if (!record) {
    throw new Error(
      `Invalid governance extension config: governance.extensions[${index}] must be an object.`
    );
  }

  const packageName = record.package;
  if (typeof packageName !== 'string' || packageName.trim().length === 0) {
    throw new Error(
      `Invalid governance extension config: governance.extensions[${index}].package must be a non-empty string.`
    );
  }

  const optional = record.optional;
  if (optional !== undefined && typeof optional !== 'boolean') {
    throw new Error(
      `Invalid governance extension config: governance.extensions[${index}].optional must be a boolean when provided.`
    );
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
      throw new Error(
        `Invalid governance extension config: governance.extensions[${index}].options must be an object when provided.`
      );
    }

    registration.options = { ...parsedOptions };
  }

  return registration;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
