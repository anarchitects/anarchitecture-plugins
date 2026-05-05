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
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_LEGACY_PROFILE_NAME,
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

const BASE_PROFILE_METRICS: Record<Measurement['id'], number> = {
  'architectural-entropy': 0.2,
  'dependency-complexity': 0.2,
  'domain-integrity': 0.2,
  'ownership-coverage': 0.2,
  'documentation-completeness': 0.2,
  'layer-integrity': 0.2,
};

const BASE_PROFILE_OWNERSHIP: GovernanceProfile['ownership'] = {
  required: true,
  metadataField: 'ownership',
};

const BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES: Record<string, string[]> = {
  '*': ['shared'],
};

const BASE_HEALTH_THRESHOLDS = DEFAULT_HEALTH_STATUS_THRESHOLDS;

function createBuiltInProfile(
  name: string,
  description: string,
  layers: string[]
): GovernanceProfile {
  return {
    name,
    description,
    boundaryPolicySource: 'profile',
    layers,
    allowedDomainDependencies: BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES,
    ownership: BASE_PROFILE_OWNERSHIP,
    health: {
      statusThresholds: BASE_HEALTH_THRESHOLDS,
    },
    metrics: BASE_PROFILE_METRICS,
  };
}

function createBuiltInStarterProfile(layers: string[]): GovernanceProfileFile {
  return {
    boundaryPolicySource: 'eslint',
    layers,
    allowedDomainDependencies: BASE_PROFILE_ALLOWED_DOMAIN_DEPENDENCIES,
    ownership: BASE_PROFILE_OWNERSHIP,
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

export const frontendLayeredProfile = createBuiltInProfile(
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  'Layered frontend-oriented governance defaults for Nx workspaces.',
  ['app', 'feature', 'ui', 'data-access', 'util']
);

export const layeredWorkspaceProfile = createBuiltInProfile(
  GOVERNANCE_LEGACY_PROFILE_NAME,
  'Legacy compatibility alias for the frontend-layered governance defaults.',
  frontendLayeredProfile.layers
);

export const backendLayered3TierProfile = createBuiltInProfile(
  'backend-layered-3tier',
  'Three-tier backend governance defaults for Nx workspaces.',
  ['api', 'service', 'data-access']
);

export const backendLayeredDddProfile = createBuiltInProfile(
  'backend-layered-ddd',
  'DDD-oriented backend governance defaults for Nx workspaces.',
  ['api', 'application', 'domain', 'infrastructure']
);

export function createFrontendLayeredStarterProfile(): GovernanceProfileFile {
  return createBuiltInStarterProfile(frontendLayeredProfile.layers);
}

export function createLayeredWorkspaceStarterProfile(): GovernanceProfileFile {
  return createFrontendLayeredStarterProfile();
}

export function createBackendLayered3TierStarterProfile(): GovernanceProfileFile {
  return createBuiltInStarterProfile(backendLayered3TierProfile.layers);
}

export function createBackendLayeredDddStarterProfile(): GovernanceProfileFile {
  return createBuiltInStarterProfile(backendLayeredDddProfile.layers);
}

export interface ResolvedProfileOverrides extends ProfileOverrides {
  boundaryPolicySource: GovernanceProfile['boundaryPolicySource'];
  exceptions: GovernanceException[];
  eslintHelperPath: string;
  runtimeWarnings: string[];
}

export function resolveBuiltInGovernanceProfile(
  profileName: string
): GovernanceProfile {
  switch (profileName) {
    case GOVERNANCE_LEGACY_PROFILE_NAME:
      return layeredWorkspaceProfile;
    case 'backend-layered-3tier':
      return backendLayered3TierProfile;
    case 'backend-layered-ddd':
      return backendLayeredDddProfile;
    case GOVERNANCE_DEFAULT_PROFILE_NAME:
    default:
      return frontendLayeredProfile;
  }
}

export function createBuiltInGovernanceStarterProfile(
  profileName: string
): GovernanceProfileFile {
  switch (profileName) {
    case 'backend-layered-3tier':
      return createBackendLayered3TierStarterProfile();
    case 'backend-layered-ddd':
      return createBackendLayeredDddStarterProfile();
    case GOVERNANCE_LEGACY_PROFILE_NAME:
      return createLayeredWorkspaceStarterProfile();
    case GOVERNANCE_DEFAULT_PROFILE_NAME:
    default:
      return createFrontendLayeredStarterProfile();
  }
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
