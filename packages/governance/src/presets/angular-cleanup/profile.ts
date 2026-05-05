import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_HEALTH_STATUS_THRESHOLDS,
  GovernanceException,
  GovernanceProfile,
  HealthStatusThresholds,
  Measurement,
  ProfileOverrides,
  normalizeGovernanceException,
} from '../../core/index.js';
import {
  GovernanceProfileFile,
  GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
  resolveGovernanceProfilePath,
} from '../../profile/runtime-profile.js';

const LEGACY_PROFILE_METRIC_KEY_MAP = {
  architecturalEntropyWeight: 'architectural-entropy',
  dependencyComplexityWeight: 'dependency-complexity',
  domainIntegrityWeight: 'domain-integrity',
  ownershipCoverageWeight: 'ownership-coverage',
  documentationCompletenessWeight: 'documentation-completeness',
  layerIntegrityWeight: 'layer-integrity',
} as const;

export const angularCleanupProfile: GovernanceProfile = {
  name: 'angular-cleanup',
  description: 'Angular-oriented governance defaults for Nx workspaces.',
  boundaryPolicySource: 'profile',
  layers: ['app', 'feature', 'ui', 'data-access', 'util'],
  allowedDomainDependencies: {
    '*': ['shared'],
  },
  ownership: {
    required: true,
    metadataField: 'ownership',
  },
  health: {
    statusThresholds: DEFAULT_HEALTH_STATUS_THRESHOLDS,
  },
  metrics: {
    'architectural-entropy': 0.2,
    'dependency-complexity': 0.2,
    'domain-integrity': 0.2,
    'ownership-coverage': 0.2,
    'documentation-completeness': 0.2,
    'layer-integrity': 0.2,
  },
};

// This starter file is copied into a workspace during init when no user-owned
// runtime profile exists yet. It stays separate from the built-in preset so the
// workspace can own and evolve its runtime policy explicitly.
export function createAngularCleanupStarterProfile(): GovernanceProfileFile {
  return {
    boundaryPolicySource: 'eslint',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': ['shared'],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {
      architecturalEntropyWeight: 0.2,
      dependencyComplexityWeight: 0.2,
      domainIntegrityWeight: 0.2,
      ownershipCoverageWeight: 0.2,
      documentationCompletenessWeight: 0.2,
      layerIntegrityWeight: 0.2,
    },
    projectOverrides: {},
  };
}

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
  const filePath = resolveGovernanceProfilePath(workspaceRoot, profileName);

  if (!existsSync(filePath)) {
    return {
      boundaryPolicySource: angularCleanupProfile.boundaryPolicySource,
      layers: angularCleanupProfile.layers,
      allowedDomainDependencies:
        angularCleanupProfile.allowedDomainDependencies,
      ownership: angularCleanupProfile.ownership,
      health: angularCleanupProfile.health,
      metrics: angularCleanupProfile.metrics,
      exceptions: [],
      eslintHelperPath: GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
      projectOverrides: {},
      runtimeWarnings: [],
    };
  }

  const raw = JSON.parse(
    readFileSync(filePath, 'utf8')
  ) as GovernanceProfileFile & {
    exceptions?: unknown;
  };

  const boundaryPolicySource =
    raw.boundaryPolicySource ?? angularCleanupProfile.boundaryPolicySource;
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
      raw.layers && raw.layers.length > 0
        ? raw.layers
        : angularCleanupProfile.layers,
    allowedDomainDependencies: {
      ...angularCleanupProfile.allowedDomainDependencies,
      ...(eslintAllowedDependencies ?? {}),
      ...(raw.allowedDomainDependencies ?? {}),
    },
    ownership: {
      ...angularCleanupProfile.ownership,
      ...(raw.ownership ?? {}),
    },
    health: {
      statusThresholds: normalizeHealthStatusThresholds(
        raw.health?.statusThresholds
      ),
    },
    metrics: {
      ...angularCleanupProfile.metrics,
      ...normalizeMetricWeights(raw.metrics),
    },
    exceptions,
    eslintHelperPath,
    projectOverrides: raw.projectOverrides ?? {},
    runtimeWarnings,
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
      return undefined;
    }

    return depConstraintsToAllowedDomainDependencies(governanceDepConstraints);
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

    if (!mapped[sourceDomain]) {
      mapped[sourceDomain] = [];
    }

    mapped[sourceDomain].push(...targetDomains);
    mapped[sourceDomain] = Array.from(new Set(mapped[sourceDomain]));
  }

  return mapped;
}

function normalizeHealthStatusThresholds(
  raw?: Partial<HealthStatusThresholds>
): HealthStatusThresholds {
  const goodMinScore = normalizeThresholdValue(
    raw?.goodMinScore,
    angularCleanupProfile.health.statusThresholds.goodMinScore
  );
  const warningMinScore = normalizeThresholdValue(
    raw?.warningMinScore,
    angularCleanupProfile.health.statusThresholds.warningMinScore
  );

  if (goodMinScore <= warningMinScore) {
    return angularCleanupProfile.health.statusThresholds;
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

  return normalized.sort((a, b) => a.id.localeCompare(b.id));
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
