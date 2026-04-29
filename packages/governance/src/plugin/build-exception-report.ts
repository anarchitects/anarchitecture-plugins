import type {
  GovernanceExceptionFinding,
  GovernanceExceptionReport,
  GovernanceExceptionUsage,
  Violation,
} from '../core/index.js';
import type { ConformanceFinding } from '../conformance-adapter/conformance-adapter.js';
import type {
  GovernanceExceptionApplicationResult,
  GovernanceSuppressedFinding,
} from './apply-governance-exceptions.js';

const SOURCE_ORDER = {
  policy: 0,
  conformance: 1,
} as const;

const SEVERITY_ORDER = {
  error: 0,
  warning: 1,
  info: 2,
} as const;

export function buildExceptionReport(
  application: GovernanceExceptionApplicationResult
): GovernanceExceptionReport {
  const usageCounts = countMatchesByExceptionId(application);
  const activeExceptionCount = Object.values(
    application.exceptionStatuses
  ).filter((status) => status === 'active').length;
  const staleExceptionCount = Object.values(
    application.exceptionStatuses
  ).filter((status) => status === 'stale').length;
  const expiredExceptionCount = Object.values(
    application.exceptionStatuses
  ).filter((status) => status === 'expired').length;
  const suppressedFindings = [
    ...application.suppressedPolicyViolations.map((entry) =>
      mapSuppressedPolicyViolation(entry)
    ),
    ...application.suppressedConformanceFindings.map((entry) =>
      mapSuppressedConformanceFinding(entry)
    ),
  ].sort(compareSuppressedFindings);
  const reactivatedFindings = [
    ...application.reactivatedPolicyViolations.map((entry) =>
      mapReactivatedPolicyViolation(entry)
    ),
    ...application.reactivatedConformanceFindings.map((entry) =>
      mapReactivatedConformanceFinding(entry)
    ),
  ].sort(compareSuppressedFindings);

  const used: GovernanceExceptionUsage[] = [];
  const unused: GovernanceExceptionUsage[] = [];

  for (const exception of [...application.declaredExceptions].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    const matchCount = usageCounts.get(exception.id) ?? 0;
    const usage = {
      id: exception.id,
      source: exception.source,
      status: application.exceptionStatuses[exception.id],
      reason: exception.reason,
      owner: exception.owner,
      review: { ...exception.review },
      matchCount,
    };

    if (matchCount > 0) {
      used.push(usage);
    } else {
      unused.push(usage);
    }
  }

  return {
    summary: {
      declaredCount: application.declaredExceptions.length,
      matchedCount: used.length,
      suppressedPolicyViolationCount:
        application.suppressedPolicyViolations.length,
      suppressedConformanceFindingCount:
        application.suppressedConformanceFindings.length,
      unusedExceptionCount: unused.length,
      activeExceptionCount,
      staleExceptionCount,
      expiredExceptionCount,
      reactivatedPolicyViolationCount:
        application.reactivatedPolicyViolations.length,
      reactivatedConformanceFindingCount:
        application.reactivatedConformanceFindings.length,
    },
    used,
    unused,
    suppressedFindings,
    reactivatedFindings,
  };
}

function countMatchesByExceptionId(
  application: GovernanceExceptionApplicationResult
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of [
    ...application.suppressedPolicyViolations,
    ...application.suppressedConformanceFindings,
    ...application.reactivatedPolicyViolations.filter(
      (finding) => typeof finding.matchedExceptionId === 'string'
    ),
    ...application.reactivatedConformanceFindings.filter(
      (finding) => typeof finding.matchedExceptionId === 'string'
    ),
  ]) {
    if (entry.matchedExceptionId) {
      counts.set(
        entry.matchedExceptionId,
        (counts.get(entry.matchedExceptionId) ?? 0) + 1
      );
    }
  }

  return counts;
}

function mapSuppressedPolicyViolation(
  entry: GovernanceSuppressedFinding<Violation>
): GovernanceExceptionFinding {
  const targetProjectId = asString(entry.finding.details?.targetProject);
  const projectId = asString(entry.finding.project);

  return {
    kind: 'policy-violation',
    exceptionId: entry.matchedExceptionId,
    source: 'policy',
    ruleId: entry.finding.ruleId,
    category: entry.finding.category,
    severity: entry.finding.severity,
    status: 'active',
    ...(projectId ? { projectId } : {}),
    ...(targetProjectId ? { targetProjectId } : {}),
    relatedProjectIds: [projectId, targetProjectId].filter(
      (value): value is string => typeof value === 'string'
    ),
    message: entry.finding.message,
    ...(entry.finding.sourcePluginId
      ? { sourcePluginId: entry.finding.sourcePluginId }
      : {}),
  };
}

function mapSuppressedConformanceFinding(
  entry: GovernanceSuppressedFinding<ConformanceFinding>
): GovernanceExceptionFinding {
  return {
    kind: 'conformance-finding',
    exceptionId: entry.matchedExceptionId,
    source: 'conformance',
    ...(entry.finding.ruleId ? { ruleId: entry.finding.ruleId } : {}),
    category: entry.finding.category,
    severity: entry.finding.severity,
    status: 'active',
    ...(entry.finding.projectId ? { projectId: entry.finding.projectId } : {}),
    relatedProjectIds: [...entry.finding.relatedProjectIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    message: entry.finding.message,
    ...(asString(entry.finding.metadata?.sourcePluginId)
      ? { sourcePluginId: asString(entry.finding.metadata?.sourcePluginId) }
      : {}),
  };
}

function mapReactivatedPolicyViolation(
  entry: GovernanceExceptionApplicationResult['reactivatedPolicyViolations'][number]
): GovernanceExceptionFinding {
  const targetProjectId = asString(entry.finding.details?.targetProject);
  const projectId = asString(entry.finding.project);

  return {
    kind: 'policy-violation',
    exceptionId: entry.matchedExceptionId ?? 'unknown-exception',
    source: 'policy',
    status: entry.matchedExceptionStatus ?? 'stale',
    ruleId: entry.finding.ruleId,
    category: entry.finding.category,
    severity: entry.finding.severity,
    ...(projectId ? { projectId } : {}),
    ...(targetProjectId ? { targetProjectId } : {}),
    relatedProjectIds: [targetProjectId].filter(
      (value): value is string => typeof value === 'string'
    ),
    message: entry.finding.message,
    ...(entry.finding.sourcePluginId
      ? { sourcePluginId: entry.finding.sourcePluginId }
      : {}),
  };
}

function mapReactivatedConformanceFinding(
  entry: GovernanceExceptionApplicationResult['reactivatedConformanceFindings'][number]
): GovernanceExceptionFinding {
  return {
    kind: 'conformance-finding',
    exceptionId: entry.matchedExceptionId ?? 'unknown-exception',
    source: 'conformance',
    status: entry.matchedExceptionStatus ?? 'stale',
    ...(entry.finding.ruleId ? { ruleId: entry.finding.ruleId } : {}),
    category: entry.finding.category,
    severity: entry.finding.severity,
    ...(entry.finding.projectId ? { projectId: entry.finding.projectId } : {}),
    relatedProjectIds: [...entry.finding.relatedProjectIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    message: entry.finding.message,
    ...(asString(entry.finding.metadata?.sourcePluginId)
      ? { sourcePluginId: asString(entry.finding.metadata?.sourcePluginId) }
      : {}),
  };
}

function compareSuppressedFindings(
  left: GovernanceExceptionFinding,
  right: GovernanceExceptionFinding
): number {
  const sourceOrder = SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const severityOrder =
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const ruleComparison = (left.ruleId ?? '').localeCompare(right.ruleId ?? '');
  if (ruleComparison !== 0) {
    return ruleComparison;
  }

  const projectScopeComparison = [
    left.projectId ?? '',
    left.targetProjectId ?? '',
    left.relatedProjectIds.join(','),
  ]
    .join('|')
    .localeCompare(
      [
        right.projectId ?? '',
        right.targetProjectId ?? '',
        right.relatedProjectIds.join(','),
      ].join('|')
    );
  if (projectScopeComparison !== 0) {
    return projectScopeComparison;
  }

  const messageComparison = left.message.localeCompare(right.message);
  if (messageComparison !== 0) {
    return messageComparison;
  }

  return left.exceptionId.localeCompare(right.exceptionId);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
