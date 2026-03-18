import { createHash } from 'node:crypto';

import type {
  ConformanceFinding,
  ConformanceSnapshot,
} from '../conformance-adapter/conformance-adapter.js';
import type { WorkspaceGraphSnapshot } from '../nx-adapter/graph-adapter.js';
import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './types.js';

export interface BuildGovernanceSignalsOptions {
  graphSnapshot: WorkspaceGraphSnapshot;
  conformanceSnapshot: ConformanceSnapshot;
}

interface SignalDraft {
  type: GovernanceSignalType;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  metadata?: Record<string, unknown>;
  source: GovernanceSignalSource;
  createdAt: string;
}

const SIGNAL_ID_PREFIX = 'signal-';
const SOURCE_SORT_ORDER: Record<GovernanceSignalSource, number> = {
  graph: 0,
  conformance: 1,
};
const SEVERITY_SORT_ORDER: Record<GovernanceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export function buildGraphSignals(
  snapshot: WorkspaceGraphSnapshot
): GovernanceSignal[] {
  const projectsById = new Map(
    snapshot.projects.map((project) => [project.id, project] as const)
  );
  const signals: GovernanceSignal[] = [];

  for (const dependency of snapshot.dependencies) {
    const sourceProject = projectsById.get(dependency.sourceProjectId);
    const targetProject = projectsById.get(dependency.targetProjectId);
    const sourceDomain = normalizeText(sourceProject?.domain);
    const targetDomain = normalizeText(targetProject?.domain);
    const relatedProjectIds = normalizeRelatedProjectIds([
      dependency.sourceProjectId,
      dependency.targetProjectId,
    ]);

    signals.push(
      finalizeSignal({
        type: 'structural-dependency',
        sourceProjectId: dependency.sourceProjectId,
        targetProjectId: dependency.targetProjectId,
        relatedProjectIds,
        severity: 'info',
        category: 'dependency',
        message: `Dependency: ${dependency.sourceProjectId} -> ${dependency.targetProjectId}.`,
        metadata: {
          dependencyType: dependency.type,
        },
        source: 'graph',
        createdAt: snapshot.extractedAt,
      })
    );

    if (sourceDomain && targetDomain && sourceDomain !== targetDomain) {
      signals.push(
        finalizeSignal({
          type: 'cross-domain-dependency',
          sourceProjectId: dependency.sourceProjectId,
          targetProjectId: dependency.targetProjectId,
          relatedProjectIds,
          severity: 'warning',
          category: 'boundary',
          message: `Cross-domain dependency: ${dependency.sourceProjectId} (${sourceDomain}) -> ${dependency.targetProjectId} (${targetDomain}).`,
          metadata: {
            sourceDomain,
            targetDomain,
          },
          source: 'graph',
          createdAt: snapshot.extractedAt,
        })
      );
      continue;
    }

    if (!sourceDomain || !targetDomain) {
      signals.push(
        finalizeSignal({
          type: 'missing-domain-context',
          sourceProjectId: dependency.sourceProjectId,
          targetProjectId: dependency.targetProjectId,
          relatedProjectIds,
          severity: 'warning',
          category: 'boundary',
          message: `Missing domain context for dependency: ${dependency.sourceProjectId} -> ${dependency.targetProjectId}.`,
          metadata: {
            sourceDomain,
            targetDomain,
            missingSourceDomain: !sourceDomain,
            missingTargetDomain: !targetDomain,
          },
          source: 'graph',
          createdAt: snapshot.extractedAt,
        })
      );
    }
  }

  return signals.sort(compareSignals);
}

export function buildConformanceSignals(
  snapshot: ConformanceSnapshot
): GovernanceSignal[] {
  return snapshot.findings
    .map((finding) => mapConformanceFindingToSignal(finding, snapshot.extractedAt))
    .sort(compareSignals);
}

export function buildGovernanceSignals(
  options: BuildGovernanceSignalsOptions
): GovernanceSignal[] {
  const mergedSignals = [
    ...buildGraphSignals(options.graphSnapshot),
    ...buildConformanceSignals(options.conformanceSnapshot),
  ];
  const dedupedSignals = new Map<string, GovernanceSignal>();

  for (const signal of mergedSignals) {
    if (!dedupedSignals.has(signal.id)) {
      dedupedSignals.set(signal.id, signal);
    }
  }

  return [...dedupedSignals.values()].sort(compareSignals);
}

function mapConformanceFindingToSignal(
  finding: ConformanceFinding,
  extractedAt: string
): GovernanceSignal {
  const relatedProjectIds = normalizeRelatedProjectIds(finding.relatedProjectIds);
  const targetProjectId =
    relatedProjectIds.length === 1 ? relatedProjectIds[0] : undefined;

  return finalizeSignal({
    type: 'conformance-violation',
    sourceProjectId: finding.projectId,
    targetProjectId,
    relatedProjectIds,
    severity: finding.severity,
    category: finding.category,
    message: finding.message,
    metadata: finding.metadata ? { ...finding.metadata } : undefined,
    source: 'conformance',
    createdAt: extractedAt,
  });
}

function finalizeSignal(draft: SignalDraft): GovernanceSignal {
  const normalizedSourceProjectId = normalizeText(draft.sourceProjectId);
  const normalizedTargetProjectId = normalizeText(draft.targetProjectId);
  const normalizedRelatedProjectIds = normalizeRelatedProjectIds(
    draft.relatedProjectIds
  );
  const metadata =
    draft.metadata && Object.keys(draft.metadata).length > 0
      ? { ...draft.metadata }
      : undefined;

  return {
    id: buildSignalId({
      source: draft.source,
      type: draft.type,
      category: draft.category,
      sourceProjectId: normalizedSourceProjectId,
      targetProjectId: normalizedTargetProjectId,
      message: draft.message,
      relatedProjectIds: normalizedRelatedProjectIds,
    }),
    type: draft.type,
    sourceProjectId: normalizedSourceProjectId,
    targetProjectId: normalizedTargetProjectId,
    relatedProjectIds: normalizedRelatedProjectIds,
    severity: draft.severity,
    category: draft.category,
    message: draft.message,
    metadata,
    source: draft.source,
    createdAt: draft.createdAt,
  };
}

function normalizeRelatedProjectIds(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(normalizeText).filter((value): value is string => !!value))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function buildSignalId(input: {
  source: GovernanceSignalSource;
  type: GovernanceSignalType;
  category: GovernanceSignalCategory;
  sourceProjectId?: string;
  targetProjectId?: string;
  message: string;
  relatedProjectIds: string[];
}): string {
  const seed = [
    input.source,
    input.type,
    input.category,
    input.sourceProjectId ?? '',
    input.targetProjectId ?? '',
    input.message,
    input.relatedProjectIds.join(','),
  ].join('|');

  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `${SIGNAL_ID_PREFIX}${hash}`;
}

function compareSignals(a: GovernanceSignal, b: GovernanceSignal): number {
  const sourceOrder =
    SOURCE_SORT_ORDER[a.source] - SOURCE_SORT_ORDER[b.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const typeOrder = a.type.localeCompare(b.type);
  if (typeOrder !== 0) {
    return typeOrder;
  }

  const severityOrder =
    SEVERITY_SORT_ORDER[a.severity] - SEVERITY_SORT_ORDER[b.severity];
  if (severityOrder !== 0) {
    return severityOrder;
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

  return a.id.localeCompare(b.id);
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

