import { GovernanceWorkspace, Measurement } from '../core/index.js';
import { GovernanceSignal } from '../signal-engine/index.js';

export interface MetricEngineInput {
  workspace: GovernanceWorkspace;
  signals: GovernanceSignal[];
}

export function calculateMetrics(input: MetricEngineInput): Measurement[] {
  const { workspace, signals } = input;
  const dependencyCount = workspace.dependencies.length;
  const projectCount = workspace.projects.length || 1;
  const structuralDependencyCount = signals.filter(
    (signal) => signal.type === 'structural-dependency'
  ).length;
  const canonicalDependencyCount =
    structuralDependencyCount > 0 ? structuralDependencyCount : dependencyCount;
  const policySignalCount = signals.filter(
    (signal) => signal.source === 'policy'
  ).length;

  const layerViolations = signals.filter(
    (signal) => signal.type === 'layer-boundary-violation'
  ).length;
  const domainViolations = signals.filter(
    (signal) => signal.type === 'domain-boundary-violation'
  ).length;
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
      policySignalCount / Math.max(canonicalDependencyCount, 1)
    ),
    makeScore(
      'dependency-complexity',
      'Dependency Complexity',
      canonicalDependencyCount / projectCount / 4
    ),
    makeScore(
      'domain-integrity',
      'Domain Integrity',
      domainViolations / Math.max(canonicalDependencyCount, 1)
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
      layerViolations / Math.max(canonicalDependencyCount, 1)
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
