import type { GovernanceException, Violation } from '../core/index.js';
import type {
  ConformanceFinding,
  ConformanceSnapshot,
} from '../conformance-adapter/conformance-adapter.js';
import {
  buildConformanceSignals,
  buildPolicySignals,
} from '../signal-engine/index.js';
import { applyGovernanceExceptions } from './apply-governance-exceptions.js';

describe('applyGovernanceExceptions', () => {
  it('suppresses matching policy violations, including project-only ownership exceptions', () => {
    const violations: Violation[] = [
      {
        id: 'billing-shared-domain',
        ruleId: 'domain-boundary',
        project: 'billing-feature',
        severity: 'error',
        category: 'boundary',
        message: 'billing-feature crosses into shared-util.',
        details: {
          targetProject: 'shared-util',
        },
      },
      {
        id: 'billing-ownership',
        ruleId: 'ownership-presence',
        project: 'billing-feature',
        severity: 'warning',
        category: 'ownership',
        message: 'billing-feature has no owner.',
      },
    ];
    const exceptions: GovernanceException[] = [
      {
        id: 'billing-domain-transition',
        source: 'policy',
        scope: {
          source: 'policy',
          ruleId: 'domain-boundary',
          projectId: 'billing-feature',
          targetProjectId: 'shared-util',
        },
        reason: 'Temporary transition.',
        owner: '@org/architecture',
        review: {
          reviewBy: '2026-06-01',
        },
      },
      {
        id: 'billing-ownership-gap',
        source: 'policy',
        scope: {
          source: 'policy',
          ruleId: 'ownership-presence',
          projectId: 'billing-feature',
        },
        reason: 'Ownership migration in progress.',
        owner: '@org/architecture',
        review: {
          expiresAt: '2026-07-01',
        },
      },
    ];

    const result = applyGovernanceExceptions({
      exceptions,
      policyViolations: violations,
      conformanceFindings: [],
      asOf: new Date('2026-04-17T00:00:00.000Z'),
    });

    expect(result.activePolicyViolations).toEqual([]);
    expect(result.suppressedPolicyViolations).toEqual([
      expect.objectContaining({
        finding: violations[0],
        matchedExceptionId: 'billing-domain-transition',
        outcome: 'suppressed',
      }),
      expect.objectContaining({
        finding: violations[1],
        matchedExceptionId: 'billing-ownership-gap',
        outcome: 'suppressed',
      }),
    ]);
    expect(buildPolicySignals(result.activePolicyViolations)).toEqual([]);
  });

  it('prefers the most specific policy exception match', () => {
    const violation: Violation = {
      id: 'billing-shared-domain',
      ruleId: 'domain-boundary',
      project: 'billing-feature',
      severity: 'error',
      category: 'boundary',
      message: 'billing-feature crosses into shared-util.',
      details: {
        targetProject: 'shared-util',
      },
    };
    const result = applyGovernanceExceptions({
      exceptions: [
        {
          id: 'billing-any-domain',
          source: 'policy',
          scope: {
            source: 'policy',
            ruleId: 'domain-boundary',
            projectId: 'billing-feature',
          },
          reason: 'Broader exception.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
        {
          id: 'billing-shared-domain',
          source: 'policy',
          scope: {
            source: 'policy',
            ruleId: 'domain-boundary',
            projectId: 'billing-feature',
            targetProjectId: 'shared-util',
          },
          reason: 'More specific exception.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
      ],
      policyViolations: [violation],
      conformanceFindings: [],
      asOf: new Date('2026-04-17T00:00:00.000Z'),
    });

    expect(result.suppressedPolicyViolations).toEqual([
      expect.objectContaining({
        matchedExceptionId: 'billing-shared-domain',
      }),
    ]);
  });

  it('suppresses conformance findings using exact scope matching and related-project equality', () => {
    const finding: ConformanceFinding = {
      id: 'conformance-1',
      ruleId: '@nx/conformance/enforce-project-boundaries',
      category: 'boundary',
      severity: 'error',
      projectId: 'billing-feature',
      relatedProjectIds: ['shared-util', 'billing-feature'],
      message: 'Conformance boundary violation.',
    };
    const result = applyGovernanceExceptions({
      exceptions: [
        {
          id: 'conformance-boundary',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            relatedProjectIds: ['billing-feature', 'shared-util'],
          },
          reason: 'Known migration overlap.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-07-01',
          },
        },
      ],
      policyViolations: [],
      conformanceFindings: [finding],
      asOf: new Date('2026-04-17T00:00:00.000Z'),
    });

    expect(result.activeConformanceFindings).toEqual([]);
    expect(result.suppressedConformanceFindings).toEqual([
      expect.objectContaining({
        finding,
        matchedExceptionId: 'conformance-boundary',
        outcome: 'suppressed',
      }),
    ]);
    expect(
      buildConformanceSignals(
        makeConformanceSnapshot(result.activeConformanceFindings)
      )
    ).toEqual([]);
  });

  it('prefers the most specific conformance exception and leaves unmatched findings active', () => {
    const findings: ConformanceFinding[] = [
      {
        id: 'specific-match',
        ruleId: '@nx/conformance/enforce-project-boundaries',
        category: 'boundary',
        severity: 'error',
        projectId: 'billing-feature',
        relatedProjectIds: ['shared-util'],
        message: 'Specific conformance boundary violation.',
      },
      {
        id: 'active-finding',
        ruleId: '@nx/conformance/ensure-owners',
        category: 'ownership',
        severity: 'warning',
        projectId: 'billing-feature',
        relatedProjectIds: [],
        message: 'Ownership warning.',
      },
    ];

    const result = applyGovernanceExceptions({
      exceptions: [
        {
          id: 'broader-boundary',
          source: 'conformance',
          scope: {
            source: 'conformance',
            category: 'boundary',
            projectId: 'billing-feature',
          },
          reason: 'Broader exception.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
        {
          id: 'specific-boundary',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            category: 'boundary',
            projectId: 'billing-feature',
          },
          reason: 'Specific exception.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
      ],
      policyViolations: [],
      conformanceFindings: findings,
      asOf: new Date('2026-04-17T00:00:00.000Z'),
    });

    expect(result.suppressedConformanceFindings).toEqual([
      expect.objectContaining({
        finding: findings[0],
        matchedExceptionId: 'specific-boundary',
      }),
    ]);
    expect(result.activeConformanceFindings).toEqual([findings[1]]);
  });

  it('reactivates stale and expired exception matches instead of suppressing them', () => {
    const policyViolation: Violation = {
      id: 'orders-shared-domain',
      ruleId: 'domain-boundary',
      project: 'orders-app',
      severity: 'error',
      category: 'boundary',
      message: 'Domain boundary violation.',
      details: {
        targetProject: 'shared-util',
      },
    };
    const conformanceFinding: ConformanceFinding = {
      id: 'finding-1',
      ruleId: '@nx/conformance/enforce-project-boundaries',
      category: 'boundary',
      severity: 'warning',
      projectId: 'orders-app',
      relatedProjectIds: ['shared-util'],
      message: 'Boundary warning.',
    };

    const result = applyGovernanceExceptions({
      exceptions: [
        {
          id: 'stale-policy',
          source: 'policy',
          scope: {
            source: 'policy',
            ruleId: 'domain-boundary',
            projectId: 'orders-app',
            targetProjectId: 'shared-util',
          },
          reason: 'Needs review.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-04-01',
          },
        },
        {
          id: 'expired-conformance',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            projectId: 'orders-app',
          },
          reason: 'Expired exception.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-04-01',
          },
        },
      ],
      policyViolations: [policyViolation],
      conformanceFindings: [conformanceFinding],
      asOf: new Date('2026-04-17T00:00:00.000Z'),
    });

    expect(result.suppressedPolicyViolations).toEqual([]);
    expect(result.suppressedConformanceFindings).toEqual([]);
    expect(result.activePolicyViolations).toEqual([policyViolation]);
    expect(result.activeConformanceFindings).toEqual([conformanceFinding]);
    expect(result.reactivatedPolicyViolations).toEqual([
      expect.objectContaining({
        finding: policyViolation,
        matchedExceptionId: 'stale-policy',
        matchedExceptionStatus: 'stale',
        outcome: 'active',
      }),
    ]);
    expect(result.reactivatedConformanceFindings).toEqual([
      expect.objectContaining({
        finding: conformanceFinding,
        matchedExceptionId: 'expired-conformance',
        matchedExceptionStatus: 'expired',
        outcome: 'active',
      }),
    ]);
  });
});

function makeConformanceSnapshot(
  findings: ConformanceSnapshot['findings']
): ConformanceSnapshot {
  return {
    workspaceId: 'workspace',
    findings,
    extractedAt: '2026-04-17T00:00:00.000Z',
    source: 'nx-conformance',
  };
}
