import type { GovernanceAssessment, Violation } from '../core/index.js';
import type { GovernanceSignal, GovernanceSignalSeverity } from '../signal-engine/index.js';
import {
  GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
  GovernanceGraphBooleanFacetEntry,
  GovernanceGraphDocument,
  GovernanceGraphEdge,
  GovernanceGraphFinding,
  GovernanceGraphNode,
  GovernanceGraphStringFacetEntry,
} from './contracts.js';
import type { GovernanceAssessmentArtifacts } from '../plugin/build-assessment-artifacts.js';

const SEVERITY_ORDER: Record<GovernanceSignalSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function buildGovernanceGraphDocument(
  artifacts: GovernanceAssessmentArtifacts
): GovernanceGraphDocument {
  const { assessment, signals } = artifacts;
  const findings = buildFindings(signals, assessment.violations);
  const dependencyCounts = buildDependencyCounts(assessment.workspace);
  const dependentCounts = buildDependentCounts(assessment.workspace);

  const nodes = [...assessment.workspace.projects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((project) =>
      buildNode(
        project,
        findings,
        dependencyCounts.get(project.id) ?? 0,
        dependentCounts.get(project.id) ?? 0
      )
    );

  const edges = [...assessment.workspace.dependencies]
    .sort(compareDependencies)
    .map((dependency, index) => buildEdge(dependency, index, findings));

  return {
    schemaVersion: GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION,
    summary: {
      workspace: {
        id: assessment.workspace.id,
        name: assessment.workspace.name,
        root: assessment.workspace.root,
      },
      profile: assessment.profile,
      warnings: [...assessment.warnings],
      projectCount: assessment.workspace.projects.length,
      dependencyCount: assessment.workspace.dependencies.length,
      signalCount: signals.length,
      violationCount: assessment.violations.length,
      findingCount: findings.length,
      health: assessment.health,
      signalBreakdown: assessment.signalBreakdown,
      metricBreakdown: assessment.metricBreakdown,
      topIssues: assessment.topIssues,
    },
    nodes,
    edges,
    findings,
    filters: {
      domains: buildStringFacet(nodes, (node) => node.domain),
      layers: buildStringFacet(nodes, (node) => node.layer),
      projectTypes: buildStringFacet(nodes, (node) => node.type),
      ownershipPresence: buildBooleanFacet(nodes, (node) => node.ownership.present),
      documentationPresence: buildBooleanFacet(
        nodes,
        (node) => node.documentationPresent
      ),
      findingSeverities: buildStringFacet(findings, (finding) => finding.severity),
      findingSources: buildStringFacet(findings, (finding) => finding.source),
      findingCategories: buildStringFacet(findings, (finding) => finding.category),
      findingTypes: buildStringFacet(findings, (finding) => finding.type),
      ruleIds: buildStringFacet(findings, (finding) => finding.ruleId),
      sourcePluginIds: buildStringFacet(
        findings,
        (finding) => finding.sourcePluginId
      ),
      metricFamilies: buildStringFacet(
        assessment.metricBreakdown.families,
        (family) => family.family
      ),
    },
  };
}

function buildFindings(
  signals: GovernanceSignal[],
  violations: GovernanceAssessment['violations']
): GovernanceGraphFinding[] {
  return [
    ...signals.map(normalizeSignalFinding),
    ...violations.map(normalizeViolationFinding),
  ].sort(compareFindings);
}

function normalizeSignalFinding(signal: GovernanceSignal): GovernanceGraphFinding {
  return {
    id: `signal:${signal.id}`,
    kind: 'signal',
    source: signal.source,
    type: signal.type,
    category: signal.category,
    severity: signal.severity,
    message: signal.message,
    ruleId:
      typeof signal.metadata?.ruleId === 'string'
        ? signal.metadata.ruleId
        : undefined,
    sourcePluginId: signal.sourcePluginId,
    sourceProjectId: signal.sourceProjectId,
    targetProjectId: signal.targetProjectId,
    relatedProjectIds: [...signal.relatedProjectIds].sort((a, b) =>
      a.localeCompare(b)
    ),
  };
}

function normalizeViolationFinding(violation: Violation): GovernanceGraphFinding {
  const targetProjectId = readViolationTargetProject(violation);
  const relatedProjectIds = [violation.project, targetProjectId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return {
    id: `violation:${violation.id}`,
    kind: 'violation',
    source: violation.sourcePluginId ? 'extension' : 'policy',
    type: violation.ruleId,
    category: violation.category,
    severity: violation.severity,
    message: violation.message,
    ruleId: violation.ruleId,
    sourcePluginId: violation.sourcePluginId,
    sourceProjectId: violation.project,
    targetProjectId,
    relatedProjectIds,
  };
}

function buildNode(
  project: GovernanceAssessment['workspace']['projects'][number],
  findings: GovernanceGraphFinding[],
  dependencyCount: number,
  dependentCount: number
): GovernanceGraphNode {
  const ownershipContacts = [...(project.ownership?.contacts ?? [])].sort((a, b) =>
    a.localeCompare(b)
  );
  const ownershipPresent =
    Boolean(project.ownership?.team) || ownershipContacts.length > 0;

  return {
    id: project.id,
    name: project.name,
    root: project.root,
    type: project.type,
    tags: [...project.tags].sort((a, b) => a.localeCompare(b)),
    domain: project.domain,
    layer: project.layer,
    ownership: {
      present: ownershipPresent,
      source: project.ownership?.source ?? 'none',
      team: project.ownership?.team,
      contacts: ownershipContacts,
    },
    documentationPresent:
      project.metadata.documentation === true ||
      project.metadata.documentation === 'true',
    dependencyCount,
    dependentCount,
    findingIds: attachNodeFindings(project.id, findings),
  };
}

function buildEdge(
  dependency: GovernanceAssessment['workspace']['dependencies'][number],
  index: number,
  findings: GovernanceGraphFinding[]
): GovernanceGraphEdge {
  return {
    id: buildEdgeId(
      dependency.source,
      dependency.target,
      dependency.type,
      dependency.sourceFile,
      index
    ),
    sourceProjectId: dependency.source,
    targetProjectId: dependency.target,
    dependencyType: dependency.type,
    sourceFile: dependency.sourceFile,
    findingIds: attachEdgeFindings(dependency.source, dependency.target, findings),
  };
}

function attachNodeFindings(
  projectId: string,
  findings: GovernanceGraphFinding[]
): GovernanceGraphFinding['id'][] {
  const attached = new Set<string>();

  for (const finding of findings) {
    if (finding.kind === 'signal') {
      if (
        finding.sourceProjectId === projectId ||
        finding.relatedProjectIds.includes(projectId)
      ) {
        attached.add(finding.id);
      }
      continue;
    }

    if (finding.sourceProjectId === projectId) {
      attached.add(finding.id);
    }
  }

  return [...attached].sort((a, b) => compareFindingIds(a, b, findings));
}

function attachEdgeFindings(
  sourceProjectId: string,
  targetProjectId: string,
  findings: GovernanceGraphFinding[]
): GovernanceGraphFinding['id'][] {
  const attached = new Set<string>();

  for (const finding of findings) {
    if (
      finding.sourceProjectId === sourceProjectId &&
      finding.targetProjectId === targetProjectId
    ) {
      attached.add(finding.id);
    }
  }

  return [...attached].sort((a, b) => compareFindingIds(a, b, findings));
}

function compareFindingIds(
  a: string,
  b: string,
  findings: GovernanceGraphFinding[]
): number {
  const findingMap = new Map(findings.map((finding) => [finding.id, finding]));
  return compareFindings(
    findingMap.get(a) ?? minimalFinding(a),
    findingMap.get(b) ?? minimalFinding(b)
  );
}

function minimalFinding(id: string): GovernanceGraphFinding {
  return {
    id,
    kind: 'signal',
    source: 'graph',
    type: '',
    category: 'structure',
    severity: 'info',
    message: '',
    relatedProjectIds: [],
  };
}

function compareFindings(
  a: GovernanceGraphFinding,
  b: GovernanceGraphFinding
): number {
  const severityOrder =
    SEVERITY_ORDER[a.severity as GovernanceSignalSeverity] -
    SEVERITY_ORDER[b.severity as GovernanceSignalSeverity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const sourceOrder = a.source.localeCompare(b.source);
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const typeOrder = a.type.localeCompare(b.type);
  if (typeOrder !== 0) {
    return typeOrder;
  }

  const sourceProjectOrder = (a.sourceProjectId ?? '').localeCompare(
    b.sourceProjectId ?? ''
  );
  if (sourceProjectOrder !== 0) {
    return sourceProjectOrder;
  }

  const targetProjectOrder = (a.targetProjectId ?? '').localeCompare(
    b.targetProjectId ?? ''
  );
  if (targetProjectOrder !== 0) {
    return targetProjectOrder;
  }

  const idOrder = a.id.localeCompare(b.id);
  if (idOrder !== 0) {
    return idOrder;
  }

  return a.message.localeCompare(b.message);
}

function compareDependencies(
  a: GovernanceAssessment['workspace']['dependencies'][number],
  b: GovernanceAssessment['workspace']['dependencies'][number]
): number {
  return (
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) ||
    a.type.localeCompare(b.type) ||
    (a.sourceFile ?? '').localeCompare(b.sourceFile ?? '')
  );
}

function buildEdgeId(
  sourceProjectId: string,
  targetProjectId: string,
  dependencyType: string,
  sourceFile: string | undefined,
  index: number
): string {
  const filePart = sourceFile ? `|${sourceFile}` : '';
  return `${sourceProjectId}|${targetProjectId}|${dependencyType}${filePart}|${index}`;
}

function readViolationTargetProject(
  violation: Violation
): string | undefined {
  const targetProject = violation.details?.targetProject;
  return typeof targetProject === 'string' && targetProject.length > 0
    ? targetProject
    : undefined;
}

function buildDependencyCounts(
  workspace: GovernanceAssessment['workspace']
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const dependency of workspace.dependencies) {
    counts.set(dependency.source, (counts.get(dependency.source) ?? 0) + 1);
  }

  return counts;
}

function buildDependentCounts(
  workspace: GovernanceAssessment['workspace']
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const dependency of workspace.dependencies) {
    counts.set(dependency.target, (counts.get(dependency.target) ?? 0) + 1);
  }

  return counts;
}

function buildStringFacet<T>(
  items: readonly T[],
  readValue: (item: T) => string | undefined
): GovernanceGraphStringFacetEntry[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const value = readValue(item);
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

function buildBooleanFacet<T>(
  items: readonly T[],
  readValue: (item: T) => boolean
): GovernanceGraphBooleanFacetEntry[] {
  const counts = new Map<boolean, number>();

  for (const item of items) {
    const value = readValue(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([value, count]) => ({ value, count }));
}
