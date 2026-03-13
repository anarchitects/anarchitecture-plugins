import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GovernanceProfile, ProfileOverrides } from '../../core/index.js';

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
  metrics: {
    architecturalEntropyWeight: 0.2,
    dependencyComplexityWeight: 0.2,
    domainIntegrityWeight: 0.2,
    ownershipCoverageWeight: 0.2,
    documentationCompletenessWeight: 0.2,
  },
};

export interface ResolvedProfileOverrides extends ProfileOverrides {
  boundaryPolicySource: GovernanceProfile['boundaryPolicySource'];
  runtimeWarnings: string[];
}

export async function loadProfileOverrides(
  workspaceRoot: string,
  profileName: string
): Promise<ResolvedProfileOverrides> {
  const filePath = join(
    workspaceRoot,
    `tools/governance/profiles/${profileName}.json`
  );

  if (!existsSync(filePath)) {
    return {
      boundaryPolicySource: angularCleanupProfile.boundaryPolicySource,
      layers: angularCleanupProfile.layers,
      allowedDomainDependencies: angularCleanupProfile.allowedDomainDependencies,
      ownership: angularCleanupProfile.ownership,
      metrics: angularCleanupProfile.metrics,
      projectOverrides: {},
      runtimeWarnings: [],
    };
  }

  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
    boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
    layers?: string[];
    allowedDomainDependencies?: Record<string, string[]>;
    ownership?: ProfileOverrides['ownership'];
    metrics?: Partial<GovernanceProfile['metrics']>;
    projectOverrides?: ProfileOverrides['projectOverrides'];
  };

  const boundaryPolicySource =
    raw.boundaryPolicySource ?? angularCleanupProfile.boundaryPolicySource;

  const eslintAllowedDependencies =
    boundaryPolicySource === 'eslint'
      ? await loadAllowedDomainDependenciesFromEslint(workspaceRoot)
      : undefined;

  const runtimeWarnings =
    boundaryPolicySource === 'eslint'
      ? [
          'Boundary policy source is ESLint constraints (tools/governance/eslint/dependency-constraints.mjs). Profile allowedDomainDependencies is treated as fallback.',
        ]
      : [];

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
    metrics: {
      ...angularCleanupProfile.metrics,
      ...(raw.metrics ?? {}),
    },
    projectOverrides: raw.projectOverrides ?? {},
    runtimeWarnings,
  };
}

async function loadAllowedDomainDependenciesFromEslint(
  workspaceRoot: string
): Promise<Record<string, string[]> | undefined> {
  const helperPath = join(
    workspaceRoot,
    'tools/governance/eslint/dependency-constraints.mjs'
  );

  if (!existsSync(helperPath)) {
    return undefined;
  }

  try {
    const moduleUrl = pathToFileURL(helperPath).href;
    const mod = (await import(moduleUrl)) as {
      governanceDepConstraints?: unknown;
    };

    if (!Array.isArray(mod.governanceDepConstraints)) {
      return undefined;
    }

    return depConstraintsToAllowedDomainDependencies(mod.governanceDepConstraints);
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
      (constraint as { onlyDependOnLibsWithTags?: unknown }).onlyDependOnLibsWithTags ??
      [];

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
