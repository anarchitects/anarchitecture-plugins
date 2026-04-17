import type {
  GovernanceException,
  GovernancePolicyExceptionScope,
  GovernanceConformanceExceptionScope,
  Violation,
} from '../core/index.js';
import {
  buildGovernanceExceptionScopeKey,
  isConformanceExceptionScope,
  isPolicyExceptionScope,
} from '../core/index.js';
import type { ConformanceFinding } from '../conformance-adapter/conformance-adapter.js';

export interface GovernanceExceptionMatch {
  exceptionId: string;
  scopeKey: string;
  specificity: number;
}

export interface GovernanceAppliedFinding<T> {
  finding: T;
  outcome: 'active' | 'suppressed';
  matchedExceptionId?: string;
}

export interface GovernanceSuppressedFinding<T> {
  finding: T;
  outcome: 'suppressed';
  matchedExceptionId: string;
}

export interface GovernanceExceptionApplicationResult {
  declaredExceptions: GovernanceException[];
  policyViolations: GovernanceAppliedFinding<Violation>[];
  conformanceFindings: GovernanceAppliedFinding<ConformanceFinding>[];
  activePolicyViolations: Violation[];
  suppressedPolicyViolations: GovernanceSuppressedFinding<Violation>[];
  activeConformanceFindings: ConformanceFinding[];
  suppressedConformanceFindings: GovernanceSuppressedFinding<ConformanceFinding>[];
}

export interface ApplyGovernanceExceptionsInput {
  exceptions: GovernanceException[];
  policyViolations: Violation[];
  conformanceFindings: ConformanceFinding[];
}

export function applyGovernanceExceptions(
  input: ApplyGovernanceExceptionsInput
): GovernanceExceptionApplicationResult {
  const policyViolations = input.policyViolations.map((violation) =>
    applyPolicyException(violation, input.exceptions)
  );
  const conformanceFindings = input.conformanceFindings.map((finding) =>
    applyConformanceException(finding, input.exceptions)
  );

  return {
    declaredExceptions: [...input.exceptions],
    policyViolations,
    conformanceFindings,
    activePolicyViolations: policyViolations
      .filter((entry) => entry.outcome === 'active')
      .map((entry) => entry.finding),
    suppressedPolicyViolations: policyViolations.filter(isSuppressedFinding),
    activeConformanceFindings: conformanceFindings
      .filter((entry) => entry.outcome === 'active')
      .map((entry) => entry.finding),
    suppressedConformanceFindings: conformanceFindings.filter(
      isSuppressedFinding
    ),
  };
}

function applyPolicyException(
  violation: Violation,
  exceptions: GovernanceException[]
): GovernanceAppliedFinding<Violation> {
  const bestMatch = selectBestMatch(
    exceptions
      .filter((exception) => exception.source === 'policy')
      .flatMap((exception) => {
        const match = matchPolicyException(exception.scope, violation);
        return match
          ? [
              {
                ...match,
                exceptionId: exception.id,
              },
            ]
          : [];
      })
  );

  if (!bestMatch) {
    return {
      finding: violation,
      outcome: 'active',
    };
  }

  return {
    finding: violation,
    outcome: 'suppressed',
    matchedExceptionId: bestMatch.exceptionId,
  };
}

function applyConformanceException(
  finding: ConformanceFinding,
  exceptions: GovernanceException[]
): GovernanceAppliedFinding<ConformanceFinding> {
  const bestMatch = selectBestMatch(
    exceptions
      .filter((exception) => exception.source === 'conformance')
      .flatMap((exception) => {
        const match = matchConformanceException(exception.scope, finding);
        return match
          ? [
              {
                ...match,
                exceptionId: exception.id,
              },
            ]
          : [];
      })
  );

  if (!bestMatch) {
    return {
      finding,
      outcome: 'active',
    };
  }

  return {
    finding,
    outcome: 'suppressed',
    matchedExceptionId: bestMatch.exceptionId,
  };
}

function matchPolicyException(
  scope: GovernanceException['scope'],
  violation: Violation
): Omit<GovernanceExceptionMatch, 'exceptionId'> | null {
  if (!isPolicyExceptionScope(scope)) {
    return null;
  }

  const targetProjectId = normalizeText(violation.details?.targetProject);

  if (scope.ruleId !== violation.ruleId || scope.projectId !== violation.project) {
    return null;
  }

  if (scope.targetProjectId && scope.targetProjectId !== targetProjectId) {
    return null;
  }

  return {
    scopeKey: buildGovernanceExceptionScopeKey(scope),
    specificity: getPolicySpecificity(scope),
  };
}

function matchConformanceException(
  scope: GovernanceException['scope'],
  finding: ConformanceFinding
): Omit<GovernanceExceptionMatch, 'exceptionId'> | null {
  if (!isConformanceExceptionScope(scope)) {
    return null;
  }

  if (scope.ruleId && scope.ruleId !== finding.ruleId) {
    return null;
  }

  if (scope.category && scope.category !== finding.category) {
    return null;
  }

  if (scope.projectId && scope.projectId !== finding.projectId) {
    return null;
  }

  if (
    scope.relatedProjectIds &&
    !areEqualRelatedProjectIds(scope.relatedProjectIds, finding.relatedProjectIds)
  ) {
    return null;
  }

  return {
    scopeKey: buildGovernanceExceptionScopeKey(scope),
    specificity: getConformanceSpecificity(scope),
  };
}

function selectBestMatch(
  matches: GovernanceExceptionMatch[]
): GovernanceExceptionMatch | null {
  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort(compareExceptionMatches)[0] ?? null;
}

function compareExceptionMatches(
  left: GovernanceExceptionMatch,
  right: GovernanceExceptionMatch
): number {
  if (left.specificity !== right.specificity) {
    return right.specificity - left.specificity;
  }

  const scopeComparison = left.scopeKey.localeCompare(right.scopeKey);
  if (scopeComparison !== 0) {
    return scopeComparison;
  }

  return left.exceptionId.localeCompare(right.exceptionId);
}

function getPolicySpecificity(scope: GovernancePolicyExceptionScope): number {
  return scope.targetProjectId ? 2 : 1;
}

function getConformanceSpecificity(
  scope: GovernanceConformanceExceptionScope
): number {
  return [
    scope.ruleId,
    scope.category,
    scope.projectId,
    scope.relatedProjectIds?.length ? 'relatedProjectIds' : undefined,
  ].filter(Boolean).length;
}

function areEqualRelatedProjectIds(
  left: string[],
  right: string[]
): boolean {
  const normalizedLeft = normalizeRelatedProjectIds(left);
  const normalizedRight = normalizeRelatedProjectIds(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((projectId, index) => {
    return projectId === normalizedRight[index];
  });
}

function normalizeRelatedProjectIds(projectIds: string[]): string[] {
  return [...new Set(projectIds.map(normalizeText).filter(isDefined))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isSuppressedFinding<T>(
  finding: GovernanceAppliedFinding<T>
): finding is GovernanceSuppressedFinding<T> {
  return (
    finding.outcome === 'suppressed' &&
    typeof finding.matchedExceptionId === 'string'
  );
}
