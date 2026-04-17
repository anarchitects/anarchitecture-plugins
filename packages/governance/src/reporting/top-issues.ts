import type { GovernanceTopIssue } from '../core/index.js';
import type {
  GovernanceSignal,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  KnownGovernanceSignalType,
} from '../signal-engine/index.js';

const SOURCE_ORDER: Record<GovernanceSignalSource, number> = {
  graph: 0,
  conformance: 1,
  policy: 2,
  extension: 3,
};

const TYPE_ORDER: Record<KnownGovernanceSignalType, number> = {
  'structural-dependency': 0,
  'cross-domain-dependency': 1,
  'missing-domain-context': 2,
  'circular-dependency': 3,
  'conformance-violation': 4,
  'domain-boundary-violation': 5,
  'layer-boundary-violation': 6,
  'ownership-gap': 7,
};

const SEVERITY_ORDER: Record<GovernanceSignalSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

interface TopIssueGroup {
  issue: GovernanceTopIssue;
}

export function buildTopIssues(
  signals: GovernanceSignal[]
): GovernanceTopIssue[] {
  const groups = new Map<string, TopIssueGroup>();

  for (const signal of signals) {
    const key = buildGroupKey(signal);
    const existing = groups.get(key);

    if (existing) {
      existing.issue.count += 1;
      existing.issue.projects = mergeProjects(existing.issue.projects, signal);
      if (!existing.issue.ruleId) {
        existing.issue.ruleId = readRuleId(signal);
      }
      if (!existing.issue.sourcePluginId) {
        existing.issue.sourcePluginId = signal.sourcePluginId;
      }
      continue;
    }

    groups.set(key, {
      issue: {
        type: signal.type,
        source: signal.source,
        severity: signal.severity,
        count: 1,
        projects: projectsFromSignal(signal),
        ruleId: readRuleId(signal),
        message: signal.message,
        sourcePluginId: signal.sourcePluginId,
      },
    });
  }

  return [...groups.values()]
    .map((group) => group.issue)
    .sort(compareTopIssues);
}

function buildGroupKey(signal: GovernanceSignal): string {
  return [
    signal.type,
    signal.source,
    signal.severity,
    signal.sourceProjectId ?? '',
    signal.targetProjectId ?? '',
    signal.relatedProjectIds.join(','),
  ].join('|');
}

function projectsFromSignal(signal: GovernanceSignal): string[] {
  return [
    ...new Set(
      [
        signal.sourceProjectId,
        signal.targetProjectId,
        ...signal.relatedProjectIds,
      ].filter((value): value is string => !!value)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function mergeProjects(
  existingProjects: string[],
  signal: GovernanceSignal
): string[] {
  return [
    ...new Set([...existingProjects, ...projectsFromSignal(signal)]),
  ].sort((a, b) => a.localeCompare(b));
}

function readRuleId(signal: GovernanceSignal): string | undefined {
  const ruleId = signal.metadata?.ruleId;
  return typeof ruleId === 'string' && ruleId.length > 0 ? ruleId : undefined;
}

function compareTopIssues(
  a: GovernanceTopIssue,
  b: GovernanceTopIssue
): number {
  const severityOrder = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const countOrder = b.count - a.count;
  if (countOrder !== 0) {
    return countOrder;
  }

  const knownTypeOrderA = TYPE_ORDER[a.type as KnownGovernanceSignalType];
  const knownTypeOrderB = TYPE_ORDER[b.type as KnownGovernanceSignalType];
  const typeOrder = knownTypeOrderA - knownTypeOrderB;
  if (
    knownTypeOrderA !== undefined &&
    knownTypeOrderB !== undefined &&
    typeOrder !== 0
  ) {
    return typeOrder;
  }

  if (!(a.type in TYPE_ORDER) || !(b.type in TYPE_ORDER)) {
    const dynamicTypeOrder = a.type.localeCompare(b.type);
    if (dynamicTypeOrder !== 0) {
      return dynamicTypeOrder;
    }
  }

  const sourceOrder = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const projectsOrder = a.projects
    .join(',')
    .localeCompare(b.projects.join(','));
  if (projectsOrder !== 0) {
    return projectsOrder;
  }

  return a.message.localeCompare(b.message);
}
