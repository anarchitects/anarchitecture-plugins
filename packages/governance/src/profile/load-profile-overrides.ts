import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  GovernanceException,
  GovernanceProfile,
  HealthStatusThresholds,
  Measurement,
  ProfileOverrides,
  normalizeGovernanceException,
} from '../core/index.js';
import {
  GovernanceProfileFile,
  GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_LEGACY_PROFILE_NAME,
  resolveGovernanceProfilePath,
} from './runtime-profile.js';
import { resolveBuiltInGovernanceProfile } from '../presets/registry.js';

const LEGACY_PROFILE_METRIC_KEY_MAP = {
  architecturalEntropyWeight: 'architectural-entropy',
  dependencyComplexityWeight: 'dependency-complexity',
  domainIntegrityWeight: 'domain-integrity',
  ownershipCoverageWeight: 'ownership-coverage',
  documentationCompletenessWeight: 'documentation-completeness',
  layerIntegrityWeight: 'layer-integrity',
} as const;

export interface ResolvedProfileOverrides extends ProfileOverrides {
  boundaryPolicySource: GovernanceProfile['boundaryPolicySource'];
  exceptions: GovernanceException[];
  eslintHelperPath: string;
  runtimeWarnings: string[];
}

export async function loadProfileOverrides(
  workspaceRoot: string,
  profileName: string
): Promise<ResolvedProfileOverrides> {
  const builtInProfile = resolveBuiltInGovernanceProfile(profileName);
  const filePath =
    resolveExistingProfilePath(workspaceRoot, profileName) ??
    resolveGovernanceProfilePath(workspaceRoot, profileName);

  if (!existsSync(filePath)) {
    return buildDefaultResolvedOverrides(builtInProfile);
  }

  const raw = JSON.parse(
    readFileSync(filePath, 'utf8')
  ) as GovernanceProfileFile & {
    exceptions?: unknown;
  };

  const boundaryPolicySource =
    raw.boundaryPolicySource ?? builtInProfile.boundaryPolicySource;
  const eslintHelperPath =
    raw.eslint?.helperPath ?? GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH;

  const eslintAllowedDependencies =
    boundaryPolicySource === 'eslint'
      ? await loadAllowedDomainDependenciesFromEslint(
          workspaceRoot,
          eslintHelperPath
        )
      : undefined;

  const runtimeWarnings =
    boundaryPolicySource === 'eslint'
      ? [
          `Boundary policy source is ESLint constraints (${eslintHelperPath}). Profile allowedDomainDependencies is treated as fallback.`,
        ]
      : [];

  const exceptions = normalizeProfileExceptions(raw.exceptions, filePath);

  return {
    boundaryPolicySource,
    layers:
      raw.layers && raw.layers.length > 0 ? raw.layers : builtInProfile.layers,
    allowedDomainDependencies: {
      ...builtInProfile.allowedDomainDependencies,
      ...(eslintAllowedDependencies ?? {}),
      ...(raw.allowedDomainDependencies ?? {}),
    },
    ownership: {
      ...builtInProfile.ownership,
      ...(raw.ownership ?? {}),
    },
    health: {
      statusThresholds: normalizeHealthStatusThresholds(
        raw.health?.statusThresholds,
        builtInProfile
      ),
    },
    metrics: {
      ...builtInProfile.metrics,
      ...normalizeMetricWeights(raw.metrics),
    },
    exceptions,
    eslintHelperPath,
    projectOverrides: raw.projectOverrides ?? {},
    runtimeWarnings,
  };
}

function resolveExistingProfilePath(
  workspaceRoot: string,
  profileName: string
): string | null {
  for (const candidate of resolveProfileAliasCandidates(profileName)) {
    const filePath = resolveGovernanceProfilePath(workspaceRoot, candidate);

    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

function resolveProfileAliasCandidates(profileName: string): string[] {
  if (profileName === GOVERNANCE_DEFAULT_PROFILE_NAME) {
    return [GOVERNANCE_DEFAULT_PROFILE_NAME, GOVERNANCE_LEGACY_PROFILE_NAME];
  }

  if (profileName === GOVERNANCE_LEGACY_PROFILE_NAME) {
    return [GOVERNANCE_LEGACY_PROFILE_NAME, GOVERNANCE_DEFAULT_PROFILE_NAME];
  }

  return [profileName];
}

function buildDefaultResolvedOverrides(
  profile: GovernanceProfile
): ResolvedProfileOverrides {
  return {
    boundaryPolicySource: profile.boundaryPolicySource,
    layers: profile.layers,
    allowedDomainDependencies: profile.allowedDomainDependencies,
    ownership: profile.ownership,
    health: profile.health,
    metrics: profile.metrics,
    exceptions: [],
    eslintHelperPath: GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
    projectOverrides: {},
    runtimeWarnings: [],
  };
}

function normalizeMetricWeights(
  raw: Partial<Record<string, number>> | undefined
): Record<Measurement['id'], number> {
  if (!raw) {
    return {};
  }

  const normalized: Record<string, number> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }

    const normalizedKey =
      LEGACY_PROFILE_METRIC_KEY_MAP[
        key as keyof typeof LEGACY_PROFILE_METRIC_KEY_MAP
      ] ?? key;

    normalized[normalizedKey] = value;
  }

  return normalized;
}

async function loadAllowedDomainDependenciesFromEslint(
  workspaceRoot: string,
  helperPath: string
): Promise<Record<string, string[]> | undefined> {
  const resolvedHelperPath = join(workspaceRoot, helperPath);

  if (!existsSync(resolvedHelperPath)) {
    return undefined;
  }

  try {
    const moduleUrl = pathToFileURL(resolvedHelperPath).href;
    const mod = (await import(moduleUrl)) as {
      governanceDepConstraints?: unknown;
      default?: {
        governanceDepConstraints?: unknown;
      };
    };
    const governanceDepConstraints = Array.isArray(mod.governanceDepConstraints)
      ? mod.governanceDepConstraints
      : Array.isArray(mod.default?.governanceDepConstraints)
      ? mod.default.governanceDepConstraints
      : undefined;

    if (!Array.isArray(governanceDepConstraints)) {
      const parsedConstraints = readGovernanceDepConstraintsFromSource(
        readFileSync(resolvedHelperPath, 'utf8')
      );

      if (!Array.isArray(parsedConstraints)) {
        return undefined;
      }

      return depConstraintsToAllowedDomainDependencies(parsedConstraints);
    }

    return depConstraintsToAllowedDomainDependencies(governanceDepConstraints);
  } catch {
    const parsedConstraints = readGovernanceDepConstraintsFromSource(
      readFileSync(resolvedHelperPath, 'utf8')
    );

    if (!Array.isArray(parsedConstraints)) {
      return undefined;
    }

    return depConstraintsToAllowedDomainDependencies(parsedConstraints);
  }
}

function readGovernanceDepConstraintsFromSource(
  helperSource: string
): unknown[] | undefined {
  try {
    const evaluationResult = Function(
      `"use strict";
const exports = {};
${helperSource
  .replace(
    /export\s+const\s+governanceDepConstraints\s*=/g,
    'const governanceDepConstraints ='
  )
  .replace(/export\s+default\s+/g, 'const __governanceDefaultExport = ')}
return {
  governanceDepConstraints:
    typeof governanceDepConstraints !== 'undefined'
      ? governanceDepConstraints
      : undefined,
  default:
    typeof __governanceDefaultExport !== 'undefined'
      ? __governanceDefaultExport
      : undefined,
};
`
    )() as {
      governanceDepConstraints?: unknown;
      default?: {
        governanceDepConstraints?: unknown;
      };
    };

    return Array.isArray(evaluationResult.governanceDepConstraints)
      ? evaluationResult.governanceDepConstraints
      : Array.isArray(evaluationResult.default?.governanceDepConstraints)
      ? evaluationResult.default.governanceDepConstraints
      : undefined;
  } catch {
    return undefined;
  }
}

function depConstraintsToAllowedDomainDependencies(
  depConstraints: unknown[]
): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};

  for (const constraint of depConstraints) {
    if (!constraint || typeof constraint !== 'object') {
      continue;
    }

    const sourceTag = (constraint as { sourceTag?: unknown }).sourceTag;
    const allowed =
      (constraint as { onlyDependOnLibsWithTags?: unknown })
        .onlyDependOnLibsWithTags ?? [];

    if (typeof sourceTag !== 'string' || !sourceTag.startsWith('domain:')) {
      continue;
    }

    if (!Array.isArray(allowed)) {
      continue;
    }

    const sourceDomain = sourceTag.replace(/^domain:/, '');
    const targetDomains = allowed
      .filter((tag): tag is string => typeof tag === 'string')
      .filter((tag) => tag.startsWith('domain:'))
      .map((tag) => tag.replace(/^domain:/, ''));

    mapped[sourceDomain] = Array.from(new Set(targetDomains)).sort();
  }

  return mapped;
}

function normalizeHealthStatusThresholds(
  rawThresholds: Partial<HealthStatusThresholds> | undefined,
  profile: GovernanceProfile
): HealthStatusThresholds {
  const goodMinScore = normalizeThresholdValue(
    rawThresholds?.goodMinScore,
    profile.health.statusThresholds.goodMinScore
  );
  const warningMinScore = normalizeThresholdValue(
    rawThresholds?.warningMinScore,
    profile.health.statusThresholds.warningMinScore
  );

  if (goodMinScore <= warningMinScore) {
    return profile.health.statusThresholds;
  }

  return {
    goodMinScore,
    warningMinScore,
  };
}

function normalizeThresholdValue(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, value));
}

function normalizeProfileExceptions(
  raw: unknown,
  filePath: string
): GovernanceException[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error(
      `Governance profile at ${filePath} has invalid exceptions: expected an array.`
    );
  }

  const normalized = raw.map((entry, index) =>
    normalizeProfileExceptionEntry(entry, index, filePath)
  );
  const ids = new Set<string>();

  for (const exception of normalized) {
    if (ids.has(exception.id)) {
      throw new Error(
        `Governance profile at ${filePath} has duplicate exception id "${exception.id}".`
      );
    }

    ids.add(exception.id);
  }

  return normalized.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeProfileExceptionEntry(
  entry: unknown,
  index: number,
  filePath: string
): GovernanceException {
  if (!entry || typeof entry !== 'object') {
    throw new Error(
      `Governance profile at ${filePath} has invalid exception at index ${index}: expected an object.`
    );
  }

  const candidate = entry as Partial<GovernanceException>;
  const candidateId =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : `#${index}`;

  try {
    return normalizeGovernanceException(candidate as GovernanceException);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown exception error.';

    throw new Error(
      `Governance profile at ${filePath} has invalid exception "${candidateId}" at index ${index}: ${message}`
    );
  }
}
