import type { Ownership } from '../core/index.js';
import type {
  GovernanceGraphBadge,
  GovernanceGraphFinding,
  GovernanceGraphHealth,
} from './contracts.js';

export interface GovernanceGraphBadgeInput {
  findings: GovernanceGraphFinding[];
  owner?: string;
  ownershipSource?: Ownership['source'];
  ownershipRequired?: boolean;
  documentation?: string | number | boolean | null;
  documentationRequired?: boolean;
}

export interface GovernanceGraphNodeStatusInput
  extends GovernanceGraphBadgeInput {
  isKnown?: boolean;
}

export interface GovernanceGraphNodeStatus {
  health: GovernanceGraphHealth;
  score?: number;
  badges: GovernanceGraphBadge[];
}

export interface GovernanceGraphEdgeStatusInput {
  findings: GovernanceGraphFinding[];
  isKnown?: boolean;
}

export interface GovernanceGraphEdgeStatus {
  health: GovernanceGraphHealth;
  score?: number;
}

const BADGE_KIND_ORDER: Record<GovernanceGraphBadge['kind'], number> = {
  ownership: 0,
  documentation: 1,
  policy: 2,
  conformance: 3,
  metric: 4,
  signal: 5,
};

const HEALTH_ORDER: Record<GovernanceGraphHealth, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

export function deriveGovernanceGraphNodeStatus(
  input: GovernanceGraphNodeStatusInput
): GovernanceGraphNodeStatus {
  const badges = deriveGovernanceGraphBadges(input);
  const health = selectHigherPrecedenceHealth([
    deriveGovernanceGraphFindingHealth(input.findings, input.isKnown ?? false),
    ...badges.map((badge) => badge.status),
  ]);

  return {
    health,
    score: scoreForHealth(health),
    badges,
  };
}

export function deriveGovernanceGraphEdgeStatus(
  input: GovernanceGraphEdgeStatusInput
): GovernanceGraphEdgeStatus {
  const health = deriveGovernanceGraphFindingHealth(
    input.findings,
    input.isKnown ?? false
  );

  return {
    health,
    score: scoreForHealth(health),
  };
}

export function deriveGovernanceGraphBadges(
  input: GovernanceGraphBadgeInput
): GovernanceGraphBadge[] {
  const badges: GovernanceGraphBadge[] = [];
  const owner = normalizeText(input.owner);
  const docsState = readDocumentationState(input.documentation);

  if (owner) {
    badges.push({
      id: 'ownership:present',
      label: 'Owner',
      kind: 'ownership',
      status: 'healthy',
      message: `Owner metadata is present (${owner}).`,
    });
  } else if (input.ownershipRequired === true) {
    badges.push({
      id: 'ownership:missing',
      label: 'Missing owner',
      kind: 'ownership',
      status: deriveMissingMetadataStatus(input.findings, 'ownership'),
      message: ownershipMissingMessage(input.ownershipSource),
    });
  } else if (input.ownershipRequired === undefined) {
    badges.push({
      id: 'ownership:unknown',
      label: 'Ownership unknown',
      kind: 'ownership',
      status: 'unknown',
      message: 'Ownership requirements were not available for this graph node.',
    });
  }

  if (docsState === 'present') {
    badges.push({
      id: 'documentation:present',
      label: 'Docs',
      kind: 'documentation',
      status: 'healthy',
      message: 'Documentation metadata is present.',
    });
  } else if (input.documentationRequired === true) {
    badges.push({
      id: 'documentation:missing',
      label: 'Missing docs',
      kind: 'documentation',
      status: deriveMissingMetadataStatus(input.findings, 'documentation'),
      message: 'Documentation metadata is missing or incomplete.',
    });
  } else if (input.documentationRequired === undefined) {
    badges.push({
      id: 'documentation:unknown',
      label: 'Docs unknown',
      kind: 'documentation',
      status: 'unknown',
      message:
        'Documentation requirements were not available for this graph node.',
    });
  }

  return badges.sort(compareBadges);
}

export function deriveGovernanceGraphFindingHealth(
  findings: GovernanceGraphFinding[],
  isKnown: boolean
): GovernanceGraphHealth {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'critical';
  }

  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warning';
  }

  if (!isKnown) {
    return 'unknown';
  }

  return 'healthy';
}

function deriveMissingMetadataStatus(
  findings: GovernanceGraphFinding[],
  kind: 'ownership' | 'documentation'
): GovernanceGraphHealth {
  const matchingFindings = findings.filter((finding) =>
    isMetadataFinding(finding, kind)
  );

  return deriveGovernanceGraphFindingHealth(
    matchingFindings,
    matchingFindings.length > 0
  ) === 'unknown'
    ? 'warning'
    : deriveGovernanceGraphFindingHealth(
        matchingFindings,
        matchingFindings.length > 0
      );
}

function isMetadataFinding(
  finding: GovernanceGraphFinding,
  kind: 'ownership' | 'documentation'
): boolean {
  if (kind === 'ownership') {
    return (
      finding.category === 'ownership' ||
      finding.ruleId === 'ownership-presence' ||
      finding.type === 'ownership-gap'
    );
  }

  return (
    finding.category === 'documentation' ||
    (finding.ruleId?.toLowerCase().includes('doc') ?? false) ||
    (finding.type?.toLowerCase().includes('doc') ?? false)
  );
}

function scoreForHealth(health: GovernanceGraphHealth): number {
  if (health === 'healthy') {
    return 100;
  }

  if (health === 'warning') {
    return 70;
  }

  if (health === 'critical') {
    return 40;
  }

  return 0;
}

function selectHigherPrecedenceHealth(
  healthValues: GovernanceGraphHealth[]
): GovernanceGraphHealth {
  return [...healthValues].sort(compareHealth)[0] ?? 'unknown';
}

function compareBadges(
  left: GovernanceGraphBadge,
  right: GovernanceGraphBadge
): number {
  return (
    BADGE_KIND_ORDER[left.kind] - BADGE_KIND_ORDER[right.kind] ||
    compareHealth(left.status, right.status) ||
    left.id.localeCompare(right.id) ||
    left.label.localeCompare(right.label) ||
    (left.message ?? '').localeCompare(right.message ?? '')
  );
}

function compareHealth(
  left: GovernanceGraphHealth,
  right: GovernanceGraphHealth
): number {
  return HEALTH_ORDER[left] - HEALTH_ORDER[right];
}

function ownershipMissingMessage(
  ownershipSource: Ownership['source'] | undefined
): string {
  if (ownershipSource === 'none') {
    return 'No ownership metadata or CODEOWNERS mapping was found.';
  }

  return 'Required ownership metadata is missing.';
}

function readDocumentationState(
  documentation: GovernanceGraphBadgeInput['documentation']
): 'present' | 'missing' | 'unknown' {
  if (documentation === true || documentation === 'true') {
    return 'present';
  }

  if (
    documentation === false ||
    documentation === 'false' ||
    documentation === null
  ) {
    return 'missing';
  }

  return 'unknown';
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
