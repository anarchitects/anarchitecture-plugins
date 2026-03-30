import { workspaceRoot } from '@nx/devkit';
import * as fs from 'node:fs';
import path from 'node:path';

export interface ResolvedConformanceInput {
  conformanceJson?: string;
  source: 'explicit' | 'nx-json' | 'none';
}

export function resolveConformanceInput(
  explicitConformanceJson?: string
): ResolvedConformanceInput {
  if (explicitConformanceJson) {
    return {
      conformanceJson: explicitConformanceJson,
      source: 'explicit',
    };
  }

  const outputPath = readNxJsonConformanceOutputPath();
  if (!outputPath) {
    return {
      conformanceJson: undefined,
      source: 'none',
    };
  }

  return {
    conformanceJson: outputPath,
    source: 'nx-json',
  };
}

function readNxJsonConformanceOutputPath(): string | undefined {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');

  try {
    const raw = fs.readFileSync(nxJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const conformance = asRecord(parsed.conformance);
    const outputPath = conformance?.outputPath;

    return typeof outputPath === 'string' && outputPath.trim().length > 0
      ? outputPath
      : undefined;
  } catch (error) {
    throw new Error(
      `Unable to read Nx Conformance configuration from ${nxJsonPath}: ${toErrorMessage(
        error
      )}`
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.';
}
