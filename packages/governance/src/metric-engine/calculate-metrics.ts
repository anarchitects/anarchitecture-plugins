import {
  GovernanceWorkspace,
  Measurement,
  Violation,
} from '../core/index.js';

export function calculateMetrics(
  workspace: GovernanceWorkspace,
  violations: Violation[]
): Measurement[] {
  const dependencyCount = workspace.dependencies.length;
  const projectCount = workspace.projects.length || 1;
  const violationCount = violations.length;

  const layerViolations = violations.filter((v) => v.ruleId === 'layer-boundary').length;
  const domainViolations = violations.filter((v) => v.ruleId === 'domain-boundary').length;
  const ownedProjects = workspace.projects.filter(
    (project) =>
      Boolean(project.ownership?.team) ||
      (project.ownership?.contacts?.length ?? 0) > 0
  ).length;

  const documentedProjects = workspace.projects.filter((project) => {
    const doc = project.metadata.documentation;
    return doc === true || doc === 'true';
  }).length;

  return [
    makeScore(
      'architectural-entropy',
      'Architectural Entropy',
      violationCount / Math.max(dependencyCount, 1)
    ),
    makeScore(
      'dependency-complexity',
      'Dependency Complexity',
      dependencyCount / projectCount / 4
    ),
    makeScore(
      'domain-integrity',
      'Domain Integrity',
      domainViolations / Math.max(dependencyCount, 1)
    ),
    makeScore(
      'ownership-coverage',
      'Ownership Coverage',
      ownedProjects / projectCount,
      true
    ),
    makeScore(
      'documentation-completeness',
      'Documentation Completeness',
      documentedProjects / projectCount,
      true
    ),
    makeScore(
      'layer-integrity',
      'Layer Integrity',
      layerViolations / Math.max(dependencyCount, 1)
    ),
  ];
}

function makeScore(
  id: string,
  name: string,
  ratio: number,
  ratioIsPositive = false
): Measurement {
  const bounded = Math.max(0, Math.min(1, ratio));
  const value = Number(bounded.toFixed(4));
  const score = ratioIsPositive
    ? Math.round(value * 100)
    : Math.round((1 - value) * 100);

  return {
    id,
    name,
    value,
    score,
    maxScore: 100,
    unit: 'ratio',
  };
}
