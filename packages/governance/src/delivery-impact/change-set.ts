import type { GovernanceWorkspace } from '../core/index.js';
import type { GovernanceInsightDriver } from './models.js';
import {
  buildFeatureImpactAssessment,
  type FeatureImpactAssessment,
} from './feature-impact-assessment.js';

export type ChangeSetSource = 'git' | 'github' | 'manual' | (string & {});

export interface ChangeSetInput {
  id?: string;
  source?: ChangeSetSource;
  baseRef?: string;
  headRef?: string;
  changedFiles: string[];
  changedProjects?: string[];
  metadata?: Record<string, unknown>;
}

export interface ChangeSetProjectMapping {
  changedProjects: string[];
  unresolvedFiles: string[];
}

export interface ChangeSetImpactInput {
  workspace: GovernanceWorkspace;
  changeSet: ChangeSetInput;
  affectedProjects?: string[];
  affectedRules?: string[];
  affectedTargets?: string[];
  drivers?: GovernanceInsightDriver[];
}

export function buildFeatureImpactAssessmentFromChangeSet(
  input: ChangeSetImpactInput
): FeatureImpactAssessment {
  const projectMapping = resolveChangeSetProjectMapping(input.changeSet);

  return buildFeatureImpactAssessment({
    id: input.changeSet.id,
    workspace: input.workspace,
    changedProjects: projectMapping.changedProjects,
    affectedProjects: input.affectedProjects,
    changedFiles: input.changeSet.changedFiles,
    baseRef: input.changeSet.baseRef,
    headRef: input.changeSet.headRef,
    affectedRules: input.affectedRules,
    affectedTargets: input.affectedTargets,
    drivers: input.drivers,
  });
}

export function resolveChangeSetProjectMapping(
  changeSet: ChangeSetInput
): ChangeSetProjectMapping {
  return {
    changedProjects: toSortedUniqueList(changeSet.changedProjects ?? []),
    unresolvedFiles:
      changeSet.changedProjects && changeSet.changedProjects.length > 0
        ? []
        : toSortedUniqueList(changeSet.changedFiles),
  };
}

function toSortedUniqueList(values: string[]): string[] {
  return [...new Set(values.filter((value) => isNonEmptyString(value)))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
