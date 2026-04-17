import type { GovernanceException } from '../core/index.js';
import { buildExceptionReport } from './build-exception-report.js';
import type { GovernanceExceptionApplicationResult } from './apply-governance-exceptions.js';

describe('buildExceptionReport', () => {
  it('builds deterministic used, unused, and suppressed finding output', () => {
    const declaredExceptions: GovernanceException[] = [
      {
        id: 'z-unused',
        source: 'conformance',
        scope: {
          source: 'conformance',
          category: 'ownership',
          projectId: 'payments-feature',
        },
        reason: 'Unused exception.',
        owner: '@org/architecture',
        review: {
          expiresAt: '2026-08-01',
        },
      },
      {
        id: 'a-policy',
        source: 'policy',
        scope: {
          source: 'policy',
          ruleId: 'domain-boundary',
          projectId: 'orders-app',
          targetProjectId: 'shared-util',
        },
        reason: 'Active migration.',
        owner: '@org/architecture',
        review: {
          reviewBy: '2026-06-01',
        },
      },
    ];

    const result = buildExceptionReport(
      makeApplicationResult({
        declaredExceptions,
        suppressedPolicyViolations: [
          {
            outcome: 'suppressed',
            matchedExceptionId: 'a-policy',
            finding: {
              id: 'orders-shared-domain',
              ruleId: 'domain-boundary',
              project: 'orders-app',
              severity: 'error',
              category: 'boundary',
              message: 'Domain boundary violation.',
              details: {
                targetProject: 'shared-util',
              },
              sourcePluginId: 'policy-plugin',
            },
          },
        ],
        suppressedConformanceFindings: [
          {
            outcome: 'suppressed',
            matchedExceptionId: 'a-policy',
            finding: {
              id: 'finding-1',
              ruleId: '@nx/conformance/enforce-project-boundaries',
              category: 'boundary',
              severity: 'warning',
              projectId: 'orders-app',
              relatedProjectIds: ['shared-util', 'orders-app'],
              message: 'Boundary warning.',
              metadata: {
                sourcePluginId: 'conformance-plugin',
              },
            },
          },
        ],
      })
    );

    expect(result.summary).toEqual({
      declaredCount: 2,
      matchedCount: 1,
      suppressedPolicyViolationCount: 1,
      suppressedConformanceFindingCount: 1,
      unusedExceptionCount: 1,
      activeExceptionCount: 2,
      staleExceptionCount: 0,
      expiredExceptionCount: 0,
      reactivatedPolicyViolationCount: 0,
      reactivatedConformanceFindingCount: 0,
    });
    expect(result.used).toEqual([
      {
        id: 'a-policy',
        source: 'policy',
        status: 'active',
        reason: 'Active migration.',
        owner: '@org/architecture',
        review: {
          reviewBy: '2026-06-01',
        },
        matchCount: 2,
      },
    ]);
    expect(result.unused).toEqual([
      {
        id: 'z-unused',
        source: 'conformance',
        status: 'active',
        reason: 'Unused exception.',
        owner: '@org/architecture',
        review: {
          expiresAt: '2026-08-01',
        },
        matchCount: 0,
      },
    ]);
    expect(result.suppressedFindings).toEqual([
      {
        kind: 'policy-violation',
        exceptionId: 'a-policy',
        source: 'policy',
        status: 'active',
        ruleId: 'domain-boundary',
        category: 'boundary',
        severity: 'error',
        projectId: 'orders-app',
        targetProjectId: 'shared-util',
        relatedProjectIds: ['orders-app', 'shared-util'],
        message: 'Domain boundary violation.',
        sourcePluginId: 'policy-plugin',
      },
      {
        kind: 'conformance-finding',
        exceptionId: 'a-policy',
        source: 'conformance',
        status: 'active',
        ruleId: '@nx/conformance/enforce-project-boundaries',
        category: 'boundary',
        severity: 'warning',
        projectId: 'orders-app',
        relatedProjectIds: ['orders-app', 'shared-util'],
        message: 'Boundary warning.',
        sourcePluginId: 'conformance-plugin',
      },
    ]);
    expect(result.reactivatedFindings).toEqual([]);
  });
});

function makeApplicationResult(input: {
  declaredExceptions: GovernanceException[];
  suppressedPolicyViolations: GovernanceExceptionApplicationResult['suppressedPolicyViolations'];
  suppressedConformanceFindings: GovernanceExceptionApplicationResult['suppressedConformanceFindings'];
}): GovernanceExceptionApplicationResult {
  return {
    declaredExceptions: input.declaredExceptions,
    exceptionStatuses: Object.fromEntries(
      input.declaredExceptions.map((exception) => [exception.id, 'active'])
    ) as GovernanceExceptionApplicationResult['exceptionStatuses'],
    policyViolations: [],
    conformanceFindings: [],
    activePolicyViolations: [],
    suppressedPolicyViolations: input.suppressedPolicyViolations,
    reactivatedPolicyViolations: [],
    activeConformanceFindings: [],
    suppressedConformanceFindings: input.suppressedConformanceFindings,
    reactivatedConformanceFindings: [],
  };
}
