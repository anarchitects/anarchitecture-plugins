import type {
  GovernanceProject,
  GovernanceWorkspace,
  Ownership,
} from '../core/index.js';
import type { GovernanceInsightDriver } from './models.js';

export interface FeatureImpactAssessment {
  id: string;
  baseRef?: string;
  headRef?: string;
  changedFiles?: string[];
  changedProjects: string[];
  affectedProjects: string[];
  affectedDomains: string[];
  affectedTeams: string[];
  affectedRules: string[];
  affectedTargets?: string[];
  impactRadius: number;
  deliveryRisk: 'low' | 'medium' | 'high';
  recommendedReviewStakeholders: string[];
  drivers: GovernanceInsightDriver[];
}

export interface BuildFeatureImpactAssessmentInput {
  id?: string;
  workspace: GovernanceWorkspace;
  changedProjects: string[];
  affectedProjects?: string[];
  changedFiles?: string[];
  baseRef?: string;
  headRef?: string;
  affectedRules?: string[];
  affectedTargets?: string[];
  drivers?: GovernanceInsightDriver[];
}

const FEATURE_IMPACT_DRIVER_ORDER = [
  'feature-impact-radius',
  'feature-cross-domain-impact',
  'feature-ownership-ambiguity',
  'feature-review-stakeholder-spread',
  'feature-rule-impact',
] as const;

export function buildFeatureImpactAssessment(
  input: BuildFeatureImpactAssessmentInput
): FeatureImpactAssessment {
  const changedProjects = toSortedUniqueList(input.changedProjects);
  const affectedProjects = toSortedUniqueList(
    input.affectedProjects ?? changedProjects
  );
  const changedFiles =
    input.changedFiles !== undefined
      ? toSortedUniqueList(input.changedFiles)
      : undefined;
  const affectedRules = toSortedUniqueList(input.affectedRules ?? []);
  const affectedTargets =
    input.affectedTargets !== undefined
      ? toSortedUniqueList(input.affectedTargets)
      : undefined;

  const projectIndex = new Map(
    input.workspace.projects.map((project) => [project.id, project])
  );
  const affectedProjectRecords = affectedProjects
    .map((projectId) => projectIndex.get(projectId))
    .filter((project): project is GovernanceProject => project !== undefined);

  const affectedDomains = toSortedUniqueList(
    affectedProjectRecords
      .map((project) => project.domain)
      .filter((domain): domain is string => isNonEmptyString(domain))
  );
  const affectedTeams = toSortedUniqueList(
    affectedProjectRecords
      .map((project) => project.ownership?.team)
      .filter((team): team is string => isNonEmptyString(team))
  );
  const recommendedReviewStakeholders = deriveRecommendedReviewStakeholders(
    affectedProjectRecords
  );
  const missingOwnershipCount = countProjectsMissingOwnership(
    affectedProjectRecords
  );
  const impactRadius = calculateImpactRadius({
    affectedProjects,
    affectedDomains,
    affectedTeams,
    recommendedReviewStakeholders,
  });
  const deliveryRisk = deriveDeliveryRisk({
    affectedProjects,
    affectedDomains,
    affectedTeams,
    affectedRules,
    missingOwnershipCount,
    impactRadius,
  });
  const drivers = buildFeatureImpactDrivers({
    providedDrivers: input.drivers ?? [],
    affectedProjects,
    affectedDomains,
    affectedTeams,
    affectedRules,
    missingOwnershipCount,
    recommendedReviewStakeholders,
    impactRadius,
  });

  return {
    id: input.id ?? 'feature-impact-assessment',
    ...(input.baseRef !== undefined ? { baseRef: input.baseRef } : {}),
    ...(input.headRef !== undefined ? { headRef: input.headRef } : {}),
    ...(changedFiles !== undefined ? { changedFiles } : {}),
    changedProjects,
    affectedProjects,
    affectedDomains,
    affectedTeams,
    affectedRules,
    ...(affectedTargets !== undefined ? { affectedTargets } : {}),
    impactRadius,
    deliveryRisk,
    recommendedReviewStakeholders,
    drivers,
  };
}

function deriveRecommendedReviewStakeholders(
  projects: GovernanceProject[]
): string[] {
  const stakeholders = new Set<string>();

  for (const project of projects) {
    const ownership = project.ownership;
    if (!ownership) {
      continue;
    }

    if (isNonEmptyString(ownership.team)) {
      stakeholders.add(ownership.team);
    }

    for (const contact of ownership.contacts ?? []) {
      if (isNonEmptyString(contact)) {
        stakeholders.add(contact);
      }
    }
  }

  return [...stakeholders].sort(compareText);
}

function countProjectsMissingOwnership(projects: GovernanceProject[]): number {
  return projects.filter((project) => !hasExplicitOwnership(project.ownership))
    .length;
}

function hasExplicitOwnership(ownership: Ownership | undefined): boolean {
  return (
    isNonEmptyString(ownership?.team) ||
    (ownership?.contacts?.some((contact) => isNonEmptyString(contact)) ?? false)
  );
}

function calculateImpactRadius(input: {
  affectedProjects: string[];
  affectedDomains: string[];
  affectedTeams: string[];
  recommendedReviewStakeholders: string[];
}): number {
  const { affectedProjects, affectedDomains, affectedTeams } = input;

  return (
    affectedProjects.length +
    Math.max(0, affectedDomains.length - 1) * 2 +
    Math.max(0, affectedTeams.length - 1) * 2
  );
}

function deriveDeliveryRisk(input: {
  affectedProjects: string[];
  affectedDomains: string[];
  affectedTeams: string[];
  affectedRules: string[];
  missingOwnershipCount: number;
  impactRadius: number;
}): FeatureImpactAssessment['deliveryRisk'] {
  const {
    affectedProjects,
    affectedDomains,
    affectedTeams,
    affectedRules,
    missingOwnershipCount,
    impactRadius,
  } = input;

  if (
    (affectedDomains.length > 1 && affectedTeams.length > 1) ||
    missingOwnershipCount > 0 ||
    affectedRules.length > 0 ||
    impactRadius >= 8
  ) {
    return 'high';
  }

  if (
    affectedProjects.length > 1 ||
    affectedDomains.length > 1 ||
    affectedTeams.length > 1 ||
    impactRadius >= 4
  ) {
    return 'medium';
  }

  return 'low';
}

function buildFeatureImpactDrivers(input: {
  providedDrivers: GovernanceInsightDriver[];
  affectedProjects: string[];
  affectedDomains: string[];
  affectedTeams: string[];
  affectedRules: string[];
  missingOwnershipCount: number;
  recommendedReviewStakeholders: string[];
  impactRadius: number;
}): GovernanceInsightDriver[] {
  const derivedDrivers: GovernanceInsightDriver[] = [];

  if (input.affectedProjects.length > 0) {
    derivedDrivers.push({
      id: 'feature-impact-radius',
      label: 'Feature impact radius',
      value: input.impactRadius,
      unit: 'count',
      explanation: `${input.affectedProjects.length} affected ${pluralize(
        'project',
        input.affectedProjects.length
      )} across ${input.affectedDomains.length} ${pluralize(
        'domain',
        input.affectedDomains.length
      )}.`,
    });
  }

  if (input.affectedDomains.length > 1) {
    derivedDrivers.push({
      id: 'feature-cross-domain-impact',
      label: 'Feature cross-domain impact',
      value: input.affectedDomains.length,
      unit: 'count',
      explanation: `${input.affectedDomains.length} affected ${pluralize(
        'domain',
        input.affectedDomains.length
      )} increase coordination overhead.`,
    });
  }

  if (input.missingOwnershipCount > 0) {
    derivedDrivers.push({
      id: 'feature-ownership-ambiguity',
      label: 'Feature ownership ambiguity',
      value: input.missingOwnershipCount,
      unit: 'count',
      explanation: `${input.missingOwnershipCount} affected ${pluralize(
        'project',
        input.missingOwnershipCount
      )} ${
        input.missingOwnershipCount === 1 ? 'is' : 'are'
      } missing clear ownership metadata.`,
    });
  }

  if (input.recommendedReviewStakeholders.length > 1) {
    derivedDrivers.push({
      id: 'feature-review-stakeholder-spread',
      label: 'Feature review stakeholder spread',
      value: input.recommendedReviewStakeholders.length,
      unit: 'count',
      explanation: `${input.recommendedReviewStakeholders.length} review stakeholders should be involved.`,
    });
  }

  if (input.affectedRules.length > 0) {
    derivedDrivers.push({
      id: 'feature-rule-impact',
      label: 'Feature rule impact',
      value: input.affectedRules.length,
      unit: 'count',
      explanation: `${input.affectedRules.length} affected ${pluralize(
        'rule',
        input.affectedRules.length
      )} increase delivery risk review.`,
    });
  }

  return mergeDrivers(input.providedDrivers, derivedDrivers);
}

function mergeDrivers(
  providedDrivers: GovernanceInsightDriver[],
  derivedDrivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  const byId = new Map<string, GovernanceInsightDriver>();

  for (const driver of [...providedDrivers, ...derivedDrivers]) {
    if (!byId.has(driver.id)) {
      byId.set(driver.id, driver);
    }
  }

  return [...byId.values()].sort(compareDrivers);
}

function compareDrivers(
  left: GovernanceInsightDriver,
  right: GovernanceInsightDriver
): number {
  const leftKnownIndex = FEATURE_IMPACT_DRIVER_ORDER.indexOf(
    left.id as (typeof FEATURE_IMPACT_DRIVER_ORDER)[number]
  );
  const rightKnownIndex = FEATURE_IMPACT_DRIVER_ORDER.indexOf(
    right.id as (typeof FEATURE_IMPACT_DRIVER_ORDER)[number]
  );

  if (leftKnownIndex !== -1 || rightKnownIndex !== -1) {
    if (leftKnownIndex === -1) {
      return 1;
    }

    if (rightKnownIndex === -1) {
      return -1;
    }

    return leftKnownIndex - rightKnownIndex;
  }

  return compareText(left.id, right.id);
}

function toSortedUniqueList(values: string[]): string[] {
  return [...new Set(values.filter((value) => isNonEmptyString(value)))].sort(
    compareText
  );
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}
