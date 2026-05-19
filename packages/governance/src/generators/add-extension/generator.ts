import { formatFiles, Tree, updateJson } from '@nx/devkit';

import {
  parseGovernanceExtensionConfig,
  type GovernanceExtensionRegistration,
} from '../../extensions/config.js';
import type { AddExtensionGeneratorSchema } from './schema.js';

export default async function addExtensionGenerator(
  tree: Tree,
  schema: AddExtensionGeneratorSchema
): Promise<void> {
  const packageName = normalizePackageName(schema.package);
  const shouldUpdateOptional = schema.optional !== undefined;

  updateJson(tree, 'nx.json', (nxJson) => {
    const config = parseGovernanceExtensionConfig(
      asRecord(nxJson) as {
        governance?: {
          extensions?: unknown;
        };
      }
    );
    const extensions = [...config.extensions];
    const existingIndex = extensions.findIndex(
      (entry) => entry.package === packageName
    );

    if (existingIndex === -1) {
      extensions.push({
        package: packageName,
        optional: schema.optional ?? true,
      });
    } else if (shouldUpdateOptional) {
      extensions[existingIndex] = {
        ...extensions[existingIndex],
        optional: schema.optional,
      };
    }

    const nxJsonRecord = asRecord(nxJson) ?? {};
    const governance = asRecord(nxJsonRecord.governance) ?? {};

    return {
      ...nxJsonRecord,
      governance: {
        ...governance,
        extensions: extensions.map(cloneRegistration),
      },
    };
  });

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

function normalizePackageName(packageName: string): string {
  if (typeof packageName !== 'string' || packageName.trim().length === 0) {
    throw new Error('Governance extension package must be a non-empty string.');
  }

  return packageName.trim();
}

function cloneRegistration(
  registration: GovernanceExtensionRegistration
): GovernanceExtensionRegistration {
  return {
    package: registration.package,
    ...(registration.optional !== undefined
      ? {
          optional: registration.optional,
        }
      : {}),
    ...(registration.options !== undefined
      ? {
          options: { ...registration.options },
        }
      : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
