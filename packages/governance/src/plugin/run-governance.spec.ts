import * as fs from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

jest.mock('../presets/frontend-layered/profile.js', () => {
  const actual = jest.requireActual(
    '../presets/frontend-layered/profile.js'
  ) as typeof import('../presets/frontend-layered/profile.js');

  return {
    ...actual,
    loadProfileOverrides: jest.fn(actual.loadProfileOverrides),
  };
});

import { logger, workspaceRoot } from '@nx/devkit';

import { calculateHealthScore } from '../health-engine/calculate-health.js';
import * as profileModule from '../presets/frontend-layered/profile.js';
import {
  frontendLayeredProfile,
  loadProfileOverrides,
} from '../presets/frontend-layered/profile.js';
import { renderCliReport } from '../reporting/render-cli.js';
import { renderJsonReport } from '../reporting/render-json.js';
import { renderManagementReport } from '../reporting/render-management-report.js';
import type {
  GovernanceExtensionHost,
  GovernanceMetricProviderInput,
  GovernanceRulePackInput,
  GovernanceSignalProviderInput,
  GovernanceWorkspaceEnricherInput,
} from '../extensions/contracts.js';
import {
  runGovernance,
  runGovernanceAiDrift,
  runGovernanceDrift,
  runGovernanceManagementInsights,
  runGovernanceSnapshot,
} from './run-governance.js';

const actualProfileModule = jest.requireActual(
  '../presets/frontend-layered/profile.js'
) as typeof import('../presets/frontend-layered/profile.js');
const mockedLoadProfileOverrides = jest.mocked(
  profileModule.loadProfileOverrides
);

describe('runGovernance', () => {
  function writeSnapshotFile(
    directory: string,
    fileName: string,
    snapshot: Record<string, unknown>
  ): string {
    const filePath = path.join(directory, fileName);
    writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
    return filePath;
  }

  afterEach(() => {
    jest.restoreAllMocks();
    mockedLoadProfileOverrides.mockImplementation(
      actualProfileModule.loadProfileOverrides
    );
    jest.useRealTimers();
  });

  it('keeps report measurement ids stable across report types after signal-based metric wiring', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const profileName = 'frontend-layered';
    const overrides = await loadProfileOverrides(workspaceRoot, profileName);
    const resolvedWeights = {
      'architectural-entropy':
        overrides.metrics?.['architectural-entropy'] ??
        frontendLayeredProfile.metrics['architectural-entropy'],
      'dependency-complexity':
        overrides.metrics?.['dependency-complexity'] ??
        frontendLayeredProfile.metrics['dependency-complexity'],
      'domain-integrity':
        overrides.metrics?.['domain-integrity'] ??
        frontendLayeredProfile.metrics['domain-integrity'],
      'ownership-coverage':
        overrides.metrics?.['ownership-coverage'] ??
        frontendLayeredProfile.metrics['ownership-coverage'],
      'documentation-completeness':
        overrides.metrics?.['documentation-completeness'] ??
        frontendLayeredProfile.metrics['documentation-completeness'],
      'layer-integrity':
        overrides.metrics?.['layer-integrity'] ??
        frontendLayeredProfile.metrics['layer-integrity'],
    };
    const resolvedStatusThresholds =
      overrides.health?.statusThresholds ??
      frontendLayeredProfile.health.statusThresholds;

    const health = await runGovernance({ reportType: 'health' });
    const boundaries = await runGovernance({ reportType: 'boundaries' });
    const ownership = await runGovernance({ reportType: 'ownership' });
    const architecture = await runGovernance({ reportType: 'architecture' });

    expect(health.assessment.measurements.map((metric) => metric.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
    expect(
      boundaries.assessment.measurements.map((metric) => metric.id)
    ).toEqual(['domain-integrity', 'layer-integrity']);
    expect(
      ownership.assessment.measurements.map((metric) => metric.id)
    ).toEqual(['ownership-coverage']);
    expect(
      architecture.assessment.measurements.map((metric) => metric.id)
    ).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'layer-integrity',
    ]);

    expect(health.assessment.health).toEqual(
      calculateHealthScore(
        health.assessment.measurements,
        resolvedWeights,
        resolvedStatusThresholds,
        {
          topIssues: health.assessment.topIssues,
        }
      )
    );
    expect(boundaries.assessment.health).toEqual(health.assessment.health);
    expect(ownership.assessment.health).toEqual(health.assessment.health);
    expect(architecture.assessment.health).toEqual(health.assessment.health);
    expect(health.assessment.health.explainability.weakestMetrics.length).toBe(
      3
    );
    expect(health.assessment.health.projectHotspots.length).toBeGreaterThan(0);
    expect(
      health.assessment.health.explainability.dominantIssues.length
    ).toBeGreaterThan(0);
    expect(health.assessment.signalBreakdown.bySource).toEqual([
      {
        source: 'graph',
        count: health.assessment.signalBreakdown.bySource[0].count,
      },
      { source: 'conformance', count: 0 },
      {
        source: 'policy',
        count: health.assessment.signalBreakdown.bySource[2].count,
      },
      { source: 'extension', count: 0 },
    ]);
    expect(health.assessment.signalBreakdown.bySeverity).toEqual([
      {
        severity: 'info',
        count: health.assessment.signalBreakdown.bySeverity[0].count,
      },
      {
        severity: 'warning',
        count: health.assessment.signalBreakdown.bySeverity[1].count,
      },
      {
        severity: 'error',
        count: health.assessment.signalBreakdown.bySeverity[2].count,
      },
    ]);
    expect(
      health.assessment.signalBreakdown.byType.reduce(
        (total, entry) => total + entry.count,
        0
      )
    ).toBe(health.assessment.signalBreakdown.total);
    expect(
      health.assessment.metricBreakdown.families.map((entry) => entry.family)
    ).toEqual(['architecture', 'boundaries', 'ownership', 'documentation']);
    expect(
      boundaries.assessment.metricBreakdown.families.map(
        (entry) => entry.family
      )
    ).toEqual(['boundaries']);
    expect(
      ownership.assessment.metricBreakdown.families.map((entry) => entry.family)
    ).toEqual(['ownership']);
    expect(health.assessment.topIssues.length).toBeGreaterThan(0);
  });

  it('uses the explicit runtime profile option when resolving governance configuration', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    await runGovernance({
      profile: 'custom-profile',
      reportType: 'health',
    });

    expect(mockedLoadProfileOverrides).toHaveBeenCalledWith(
      workspaceRoot,
      'custom-profile'
    );
  });

  it('loads conformance signals into the assessment pipeline when conformanceJson is provided', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'finding-1',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Conformance boundary violation',
          projectId: 'packages/governance',
        },
      ])
    );

    try {
      const baseline = await runGovernance({ reportType: 'health' });
      const withConformance = await runGovernance({
        reportType: 'health',
        conformanceJson,
      });

      expect(
        baseline.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 0 });
      expect(
        withConformance.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
      expect(
        withConformance.assessment.signalBreakdown.byType.find(
          (entry) => entry.type === 'conformance-violation'
        )
      ).toEqual({ type: 'conformance-violation', count: 1 });
      expect(
        withConformance.assessment.signalBreakdown.bySeverity.find(
          (entry) => entry.severity === 'error'
        )?.count
      ).toBe(
        (baseline.assessment.signalBreakdown.bySeverity.find(
          (entry) => entry.severity === 'error'
        )?.count ?? 0) + 1
      );
      expect(withConformance.assessment.topIssues).toContainEqual(
        expect.objectContaining({
          type: 'conformance-violation',
          source: 'conformance',
          severity: 'error',
          count: 1,
        })
      );

      const baselineEntropy = baseline.assessment.measurements.find(
        (metric) => metric.id === 'architectural-entropy'
      );
      const conformanceEntropy = withConformance.assessment.measurements.find(
        (metric) => metric.id === 'architectural-entropy'
      );

      expect(conformanceEntropy?.value).toBeGreaterThan(
        baselineEntropy?.value ?? 0
      );
      expect(withConformance.assessment.health.score).toBeLessThanOrEqual(
        baseline.assessment.health.score
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns an empty exception report when no exceptions are declared', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const result = await runGovernance({ reportType: 'health' });

    expect(result.assessment.exceptions).toEqual({
      summary: {
        declaredCount: 0,
        matchedCount: 0,
        suppressedPolicyViolationCount: 0,
        suppressedConformanceFindingCount: 0,
        unusedExceptionCount: 0,
        activeExceptionCount: 0,
        staleExceptionCount: 0,
        expiredExceptionCount: 0,
        reactivatedPolicyViolationCount: 0,
        reactivatedConformanceFindingCount: 0,
      },
      used: [],
      unused: [],
      suppressedFindings: [],
      reactivatedFindings: [],
    });
  });

  it('suppresses matching declared exceptions before conformance signals are built', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'suppressed-finding',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Suppressed conformance boundary violation',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance', 'packages/governance-e2e'],
        },
        {
          id: 'active-finding',
          ruleId: '@nx/conformance/ensure-owners',
          severity: 'warning',
          message: 'Active conformance ownership warning',
          projectId: 'packages/governance',
        },
      ])
    );

    const baseline = await runGovernance({
      reportType: 'health',
      conformanceJson,
    });

    const resolvedOverrides = await loadProfileOverrides(
      workspaceRoot,
      'frontend-layered'
    );
    mockedLoadProfileOverrides.mockResolvedValueOnce({
      ...resolvedOverrides,
      exceptions: [
        {
          id: 'suppress-conformance-boundary',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            projectId: 'packages/governance',
          },
          reason: 'Known migration overlap.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
      ],
    });

    try {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
      const withException = await runGovernance({
        reportType: 'health',
        conformanceJson,
      });

      expect(
        baseline.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 2 });
      expect(
        withException.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
      expect(withException.assessment.exceptions.summary).toEqual({
        declaredCount: 1,
        matchedCount: 1,
        suppressedPolicyViolationCount: 0,
        suppressedConformanceFindingCount: 1,
        unusedExceptionCount: 0,
        activeExceptionCount: 1,
        staleExceptionCount: 0,
        expiredExceptionCount: 0,
        reactivatedPolicyViolationCount: 0,
        reactivatedConformanceFindingCount: 0,
      });
      expect(withException.assessment.exceptions.used).toEqual([
        {
          id: 'suppress-conformance-boundary',
          source: 'conformance',
          status: 'active',
          reason: 'Known migration overlap.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
          matchCount: 1,
        },
      ]);
      expect(withException.assessment.exceptions.suppressedFindings).toEqual([
        expect.objectContaining({
          kind: 'conformance-finding',
          exceptionId: 'suppress-conformance-boundary',
          source: 'conformance',
          status: 'active',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          category: 'boundary',
          severity: 'error',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance-e2e'],
          message: 'Suppressed conformance boundary violation',
        }),
      ]);
      expect(withException.assessment.exceptions.reactivatedFindings).toEqual(
        []
      );
      expect(
        withException.assessment.topIssues.filter(
          (issue) =>
            issue.source === 'conformance' &&
            issue.type === 'conformance-violation'
        )
      ).toEqual([
        expect.objectContaining({
          severity: 'warning',
          count: 1,
          message: 'Active conformance ownership warning',
        }),
      ]);
      expect(withException.assessment.health.score).toBeGreaterThanOrEqual(
        baseline.assessment.health.score
      );
      expect(
        Object.keys(withException.assessment).sort((left, right) =>
          left.localeCompare(right)
        )
      ).toEqual(
        Object.keys(baseline.assessment).sort((left, right) =>
          left.localeCompare(right)
        )
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports declared but unused exceptions without affecting active burden', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const baseline = await runGovernance({ reportType: 'health' });
    const resolvedOverrides = await loadProfileOverrides(
      workspaceRoot,
      'frontend-layered'
    );
    mockedLoadProfileOverrides.mockResolvedValueOnce({
      ...resolvedOverrides,
      exceptions: [
        {
          id: 'unused-policy-exception',
          source: 'policy',
          scope: {
            source: 'policy',
            ruleId: 'domain-boundary',
            projectId: 'missing-project',
          },
          reason: 'Reserved for future migration.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-08-01',
          },
        },
      ],
    });

    const withUnusedException = await runGovernance({ reportType: 'health' });

    expect(withUnusedException.assessment.exceptions.summary).toEqual({
      declaredCount: 1,
      matchedCount: 0,
      suppressedPolicyViolationCount: 0,
      suppressedConformanceFindingCount: 0,
      unusedExceptionCount: 1,
      activeExceptionCount: 1,
      staleExceptionCount: 0,
      expiredExceptionCount: 0,
      reactivatedPolicyViolationCount: 0,
      reactivatedConformanceFindingCount: 0,
    });
    expect(withUnusedException.assessment.exceptions.used).toEqual([]);
    expect(withUnusedException.assessment.exceptions.unused).toEqual([
      {
        id: 'unused-policy-exception',
        source: 'policy',
        status: 'active',
        reason: 'Reserved for future migration.',
        owner: '@org/architecture',
        review: {
          expiresAt: '2026-08-01',
        },
        matchCount: 0,
      },
    ]);
    expect(
      withUnusedException.assessment.exceptions.suppressedFindings
    ).toEqual([]);
    expect(
      withUnusedException.assessment.exceptions.reactivatedFindings
    ).toEqual([]);
    expect(withUnusedException.assessment.violations).toEqual(
      baseline.assessment.violations
    );
    expect(withUnusedException.assessment.signalBreakdown).toEqual(
      baseline.assessment.signalBreakdown
    );
  });

  it('reactivates findings when exceptions are stale or expired', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.useFakeTimers().setSystemTime(new Date('2026-04-17T00:00:00.000Z'));

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'stale-finding',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Reactivated conformance boundary violation',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance-e2e'],
        },
      ])
    );

    const resolvedOverrides = await loadProfileOverrides(
      workspaceRoot,
      'frontend-layered'
    );
    mockedLoadProfileOverrides.mockResolvedValueOnce({
      ...resolvedOverrides,
      exceptions: [
        {
          id: 'stale-conformance-boundary',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: '@nx/conformance/enforce-project-boundaries',
            projectId: 'packages/governance',
          },
          reason: 'Needs review.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-04-01',
          },
        },
      ],
    });

    try {
      const result = await runGovernance({
        reportType: 'health',
        conformanceJson,
      });

      expect(
        result.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
      expect(result.assessment.exceptions.summary).toEqual({
        declaredCount: 1,
        matchedCount: 1,
        suppressedPolicyViolationCount: 0,
        suppressedConformanceFindingCount: 0,
        unusedExceptionCount: 0,
        activeExceptionCount: 0,
        staleExceptionCount: 1,
        expiredExceptionCount: 0,
        reactivatedPolicyViolationCount: 0,
        reactivatedConformanceFindingCount: 1,
      });
      expect(result.assessment.exceptions.used).toEqual([
        {
          id: 'stale-conformance-boundary',
          source: 'conformance',
          status: 'stale',
          reason: 'Needs review.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-04-01',
          },
          matchCount: 1,
        },
      ]);
      expect(result.assessment.exceptions.suppressedFindings).toEqual([]);
      expect(result.assessment.exceptions.reactivatedFindings).toEqual([
        expect.objectContaining({
          kind: 'conformance-finding',
          exceptionId: 'stale-conformance-boundary',
          source: 'conformance',
          status: 'stale',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          category: 'boundary',
          severity: 'error',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance-e2e'],
          message: 'Reactivated conformance boundary violation',
        }),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads declared exceptions from a real profile file and keeps assessment plus rendered output aligned', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.useFakeTimers().setSystemTime(new Date('2026-04-17T00:00:00.000Z'));

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-exceptions-e2e-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');
    const profilePath = path.join(
      workspaceRoot,
      'tools/governance/profiles/issue-102-e2e.json'
    );

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'active-boundary-finding',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Suppressed conformance boundary violation',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance', 'packages/governance-e2e'],
        },
        {
          id: 'stale-owner-finding',
          ruleId: '@nx/conformance/ensure-owners',
          severity: 'warning',
          message: 'Reactivated conformance ownership warning',
          projectId: 'packages/governance',
        },
      ])
    );
    writeFileSync(
      profilePath,
      `${JSON.stringify(
        {
          exceptions: [
            {
              id: 'stale-owner-gap',
              source: 'conformance',
              scope: {
                source: 'conformance',
                ruleId: '@nx/conformance/ensure-owners',
                projectId: 'packages/governance',
              },
              reason: 'Needs review.',
              owner: '@org/architecture',
              review: {
                reviewBy: '2026-04-01',
              },
            },
            {
              id: 'suppress-boundary',
              source: 'conformance',
              scope: {
                source: 'conformance',
                ruleId: '@nx/conformance/enforce-project-boundaries',
                projectId: 'packages/governance',
              },
              reason: 'Known transition.',
              owner: '@org/architecture',
              review: {
                reviewBy: '2026-06-01',
              },
            },
            {
              id: 'unused-expired-gap',
              source: 'policy',
              scope: {
                source: 'policy',
                ruleId: 'ownership-presence',
                projectId: 'missing-project',
              },
              reason: 'Leftover waiver to remove.',
              owner: '@org/architecture',
              review: {
                expiresAt: '2026-03-01',
              },
            },
          ],
        },
        null,
        2
      )}\n`
    );

    try {
      const result = await runGovernance({
        profile: 'issue-102-e2e',
        reportType: 'health',
        conformanceJson,
      });

      expect(result.assessment.exceptions.summary).toEqual({
        declaredCount: 3,
        matchedCount: 2,
        suppressedPolicyViolationCount: 0,
        suppressedConformanceFindingCount: 1,
        unusedExceptionCount: 1,
        activeExceptionCount: 1,
        staleExceptionCount: 1,
        expiredExceptionCount: 1,
        reactivatedPolicyViolationCount: 0,
        reactivatedConformanceFindingCount: 1,
      });
      expect(result.assessment.exceptions.used).toEqual([
        {
          id: 'stale-owner-gap',
          source: 'conformance',
          status: 'stale',
          reason: 'Needs review.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-04-01',
          },
          matchCount: 1,
        },
        {
          id: 'suppress-boundary',
          source: 'conformance',
          status: 'active',
          reason: 'Known transition.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
          matchCount: 1,
        },
      ]);
      expect(result.assessment.exceptions.unused).toEqual([
        {
          id: 'unused-expired-gap',
          source: 'policy',
          status: 'expired',
          reason: 'Leftover waiver to remove.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-03-01',
          },
          matchCount: 0,
        },
      ]);
      expect(result.assessment.exceptions.suppressedFindings).toEqual([
        expect.objectContaining({
          kind: 'conformance-finding',
          exceptionId: 'suppress-boundary',
          status: 'active',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          projectId: 'packages/governance',
          relatedProjectIds: ['packages/governance-e2e'],
          message: 'Suppressed conformance boundary violation',
        }),
      ]);
      expect(result.assessment.exceptions.reactivatedFindings).toEqual([
        expect.objectContaining({
          kind: 'conformance-finding',
          exceptionId: 'stale-owner-gap',
          status: 'stale',
          ruleId: '@nx/conformance/ensure-owners',
          projectId: 'packages/governance',
          relatedProjectIds: [],
          message: 'Reactivated conformance ownership warning',
        }),
      ]);

      const cliReport = renderCliReport(result.assessment);
      expect(cliReport).toContain('Exceptions:');
      expect(cliReport).toContain('- declared: 3');
      expect(cliReport).toContain('- active: 1');
      expect(cliReport).toContain('- stale: 1');
      expect(cliReport).toContain('- expired: 1');
      expect(cliReport).toContain('- suppressed conformance findings: 1');
      expect(cliReport).toContain('- reactivated conformance findings: 1');
      expect(cliReport).toContain(
        '- suppress-boundary :: active :: conformance/conformance-finding :: [error] :: @nx/conformance/enforce-project-boundaries :: scope=packages/governance -> related=packages/governance-e2e :: Suppressed conformance boundary violation'
      );
      expect(cliReport).toContain(
        '- stale-owner-gap :: stale :: conformance/conformance-finding :: [warning] :: @nx/conformance/ensure-owners :: scope=packages/governance :: Reactivated conformance ownership warning'
      );

      expect(JSON.parse(renderJsonReport(result.assessment))).toMatchObject({
        profile: 'issue-102-e2e',
        exceptions: {
          summary: {
            declaredCount: 3,
            matchedCount: 2,
            suppressedConformanceFindingCount: 1,
            unusedExceptionCount: 1,
            activeExceptionCount: 1,
            staleExceptionCount: 1,
            expiredExceptionCount: 1,
            reactivatedConformanceFindingCount: 1,
          },
          used: [
            {
              id: 'stale-owner-gap',
              status: 'stale',
            },
            {
              id: 'suppress-boundary',
              status: 'active',
            },
          ],
          unused: [
            {
              id: 'unused-expired-gap',
              status: 'expired',
            },
          ],
          suppressedFindings: [
            {
              exceptionId: 'suppress-boundary',
              status: 'active',
            },
          ],
          reactivatedFindings: [
            {
              exceptionId: 'stale-owner-gap',
              status: 'stale',
            },
          ],
        },
      });
    } finally {
      rmSync(profilePath, { force: true });
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('auto-discovers conformance output from nx.json when no override is provided', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');
    const nxJsonPath = path.join(workspaceRoot, 'nx.json');
    const actualReadFileSync = fs.readFileSync;

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'finding-1',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Conformance boundary violation',
          projectId: 'packages/governance',
        },
      ])
    );

    jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath, encoding) => {
      if (path.resolve(String(filePath)) === nxJsonPath) {
        return JSON.stringify({
          conformance: {
            outputPath: conformanceJson,
          },
        });
      }

      return actualReadFileSync(filePath, encoding as never);
    }) as typeof fs.readFileSync);

    try {
      const baseline = await runGovernance({ reportType: 'health' });
      const discovered = await runGovernance({ reportType: 'health' });

      expect(
        baseline.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
      expect(
        discovered.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('prefers explicit conformanceJson over nx.json outputPath', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const explicitConformanceJson = path.join(tempDir, 'explicit.json');
    const nxJsonPath = path.join(workspaceRoot, 'nx.json');
    const actualReadFileSync = fs.readFileSync;

    writeFileSync(
      explicitConformanceJson,
      JSON.stringify([
        {
          id: 'finding-1',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Conformance boundary violation',
          projectId: 'packages/governance',
        },
      ])
    );

    jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath, encoding) => {
      if (path.resolve(String(filePath)) === nxJsonPath) {
        return JSON.stringify({
          conformance: {
            outputPath: 'dist/missing-conformance.json',
          },
        });
      }

      return actualReadFileSync(filePath, encoding as never);
    }) as typeof fs.readFileSync);

    try {
      const result = await runGovernance({
        reportType: 'health',
        conformanceJson: explicitConformanceJson,
      });

      expect(
        result.assessment.signalBreakdown.bySource.find(
          (entry) => entry.source === 'conformance'
        )
      ).toEqual({ source: 'conformance', count: 1 });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renders management insights to CLI by default and handles the real assessment pipeline', async () => {
    const infoSpy = jest
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    const result = await runGovernanceManagementInsights({
      profile: 'frontend-layered',
    });

    expect(result.deliveryImpact.profile).toBe(result.assessment.profile);
    expect(result.rendered).toBe(renderManagementReport(result.deliveryImpact));
    expect(infoSpy).toHaveBeenCalledWith(result.rendered);
    expect(result.success).toBe(true);
  });

  it('writes deterministic delivery-impact json output', async () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const loggerSpy = jest
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    const result = await runGovernanceManagementInsights({
      profile: 'frontend-layered',
      output: 'json',
    });

    expect(JSON.parse(result.rendered)).toEqual(result.deliveryImpact);
    expect(stdoutSpy).toHaveBeenCalledWith(`${result.rendered}\n`);
    expect(loggerSpy).not.toHaveBeenCalledWith(result.rendered);
  });

  it('enriches management insights with snapshot comparison trends when snapshots are available', async () => {
    const infoSpy = jest
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);
    const snapshotDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-management-insights-')
    );

    try {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
      const baseline = await runGovernanceSnapshot({
        profile: 'frontend-layered',
        snapshotDir,
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
      const current = await runGovernanceSnapshot({
        profile: 'frontend-layered',
        snapshotDir,
      });

      const result = await runGovernanceManagementInsights({
        profile: 'frontend-layered',
        snapshotDir,
        baseline: baseline.snapshotPath,
        current: current.snapshotPath,
      });

      expect(result.comparison).toBeDefined();
      expect(
        result.deliveryImpact.indices.some((index) => index.trend !== undefined)
      ).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith(result.rendered);
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  it('fails clearly when nx.json config points to a missing conformance file', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const nxJsonPath = path.join(workspaceRoot, 'nx.json');
    const actualReadFileSync = fs.readFileSync;

    jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath, encoding) => {
      if (path.resolve(String(filePath)) === nxJsonPath) {
        return JSON.stringify({
          conformance: {
            outputPath: 'dist/missing-conformance.json',
          },
        });
      }

      return actualReadFileSync(filePath, encoding as never);
    }) as typeof fs.readFileSync);

    await expect(runGovernance({ reportType: 'health' })).rejects.toThrow(
      'Unable to load Nx Conformance output configured in nx.json'
    );
  });

  it('keeps assessment output unchanged when nx plugins do not expose governance extensions', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const nxJsonPath = path.join(workspaceRoot, 'nx.json');
    const actualReadFileSync = fs.readFileSync;
    const baseline = await runGovernance({ reportType: 'health' });

    jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath, encoding) => {
      if (path.resolve(String(filePath)) === nxJsonPath) {
        return JSON.stringify({
          plugins: [
            '@nx/jest/plugin',
            { plugin: '@nx/vite/plugin' },
            '@anarchitects/nx-governance',
          ],
        });
      }

      return actualReadFileSync(filePath, encoding as never);
    }) as typeof fs.readFileSync);

    const withGovernanceDiscovery = await runGovernance({
      reportType: 'health',
    });

    expect(withGovernanceDiscovery.assessment).toEqual(baseline.assessment);
  });

  it('consumes typed extension enrichers, rule packs, signals, and metrics in a governance run', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const nxJsonPath = path.join(workspaceRoot, 'nx.json');
    const actualReadFileSync = fs.readFileSync;

    jest.doMock(
      'test-plugin/governance-extension',
      () => ({
        governanceExtension: {
          id: 'test-plugin',
          register(host: GovernanceExtensionHost) {
            host.registerEnricher({
              enrichWorkspace({ workspace }: GovernanceWorkspaceEnricherInput) {
                return {
                  ...workspace,
                  projects: workspace.projects.map((project, index) =>
                    index === 0
                      ? {
                          ...project,
                          metadata: {
                            ...project.metadata,
                            extensionTouched: true,
                          },
                        }
                      : project
                  ),
                };
              },
            });
            host.registerRulePack({
              evaluate({ workspace }: GovernanceRulePackInput) {
                return [
                  {
                    id: 'extension-violation',
                    ruleId: 'extension-boundary',
                    project: workspace.projects[0]?.name ?? 'unknown',
                    severity: 'warning',
                    category: 'boundary',
                    message: 'Extension rule violation',
                  },
                ];
              },
            });
            host.registerSignalProvider({
              provideSignals({
                workspace,
                violations,
                signals,
              }: GovernanceSignalProviderInput) {
                return [
                  {
                    id: 'extension-signal',
                    type: 'extension-warning',
                    sourceProjectId: workspace.projects[0]?.name,
                    relatedProjectIds: workspace.projects[0]
                      ? [workspace.projects[0].name]
                      : [],
                    severity: 'warning',
                    category: 'boundary',
                    message: `Extension signal for ${violations.length} violations and ${signals.length} core signals.`,
                    source: 'extension',
                    createdAt: new Date().toISOString(),
                  },
                ];
              },
            });
            host.registerMetricProvider({
              provideMetrics({
                workspace,
                measurements,
              }: GovernanceMetricProviderInput) {
                return [
                  {
                    id: 'extension-coverage',
                    name: 'Extension Coverage',
                    family: 'architecture',
                    value: workspace.projects.length > 0 ? 1 : 0,
                    score: 80,
                    maxScore: 100,
                    unit: 'ratio',
                  },
                ].filter(() => measurements.length > 0);
              },
            });
          },
        },
      }),
      { virtual: true }
    );

    jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath, encoding) => {
      if (path.resolve(String(filePath)) === nxJsonPath) {
        return JSON.stringify({
          plugins: ['test-plugin'],
        });
      }

      return actualReadFileSync(filePath, encoding as never);
    }) as typeof fs.readFileSync);

    const result = await runGovernance({ reportType: 'health' });

    expect(
      result.assessment.workspace.projects[0]?.metadata.extensionTouched
    ).toBe(true);
    expect(
      result.assessment.violations.find(
        (violation) => violation.ruleId === 'extension-boundary'
      )
    ).toEqual(
      expect.objectContaining({
        category: 'boundary',
        sourcePluginId: 'test-plugin',
      })
    );
    expect(result.assessment.signalBreakdown.bySource).toContainEqual({
      source: 'extension',
      count: 1,
    });
    expect(result.assessment.signalBreakdown.byType).toContainEqual({
      type: 'extension-warning',
      count: 1,
    });
    expect(
      result.assessment.measurements.find(
        (measurement) => measurement.id === 'extension-coverage'
      )
    ).toEqual(
      expect.objectContaining({
        family: 'architecture',
        sourcePluginId: 'test-plugin',
      })
    );
    expect(result.assessment.metricBreakdown.families).toContainEqual(
      expect.objectContaining({
        family: 'architecture',
        measurements: expect.arrayContaining([
          expect.objectContaining({ id: 'extension-coverage' }),
        ]),
      })
    );

    jest.dontMock('test-plugin/governance-extension');
  });

  it('filters type and severity breakdowns to the active report type', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-conformance-')
    );
    const conformanceJson = path.join(tempDir, 'conformance.json');

    writeFileSync(
      conformanceJson,
      JSON.stringify([
        {
          id: 'finding-boundary',
          ruleId: '@nx/conformance/enforce-project-boundaries',
          severity: 'error',
          message: 'Conformance boundary violation',
          projectId: 'packages/governance',
        },
        {
          id: 'finding-ownership',
          ruleId: '@nx/conformance/ensure-owners',
          severity: 'warning',
          message: 'Conformance ownership warning',
          projectId: 'packages/governance',
        },
      ])
    );

    try {
      const boundaries = await runGovernance({
        reportType: 'boundaries',
        conformanceJson,
      });
      const ownership = await runGovernance({
        reportType: 'ownership',
        conformanceJson,
      });

      expect(boundaries.assessment.signalBreakdown.byType).toContainEqual({
        type: 'conformance-violation',
        count: 1,
      });
      expect(
        boundaries.assessment.signalBreakdown.bySeverity.find(
          (entry) => entry.severity === 'error'
        )?.count
      ).toBeGreaterThanOrEqual(1);

      expect(ownership.assessment.signalBreakdown.bySource).toEqual([
        { source: 'graph', count: 0 },
        { source: 'conformance', count: 1 },
        { source: 'policy', count: 0 },
        { source: 'extension', count: 0 },
      ]);
      expect(ownership.assessment.signalBreakdown.byType).toEqual([
        { type: 'conformance-violation', count: 1 },
      ]);
      expect(ownership.assessment.signalBreakdown.bySeverity).toEqual([
        { severity: 'info', count: 0 },
        { severity: 'warning', count: 1 },
        { severity: 'error', count: 0 },
      ]);
      expect(boundaries.assessment.topIssues).toContainEqual(
        expect.objectContaining({
          type: 'conformance-violation',
          source: 'conformance',
          severity: 'error',
          count: 1,
        })
      );
      expect(ownership.assessment.topIssues).toEqual([
        expect.objectContaining({
          type: 'conformance-violation',
          source: 'conformance',
          severity: 'warning',
          count: 1,
        }),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('persists enriched snapshot summary fields in repo-snapshot output', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const snapshotDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-snapshots-')
    );

    try {
      const result = await runGovernanceSnapshot({
        output: 'json',
        snapshotDir,
      });
      const rendered = JSON.parse(result.rendered) as {
        snapshot: Record<string, unknown>;
      };
      const snapshot = rendered.snapshot as Record<string, unknown>;

      expect(result.snapshot.metricSchemaVersion).toBe('1.2');
      expect(snapshot['health']).toEqual(
        expect.objectContaining({
          score: result.assessment.health.score,
          status: result.assessment.health.status,
          grade: result.assessment.health.grade,
        })
      );
      expect(snapshot['signalBreakdown']).toEqual(
        result.assessment.signalBreakdown
      );
      expect(snapshot['metricBreakdown']).toEqual(
        result.assessment.metricBreakdown
      );
      expect(snapshot['topIssues']).toEqual(result.assessment.topIssues);
      expect(snapshot['deliveryImpact']).toEqual(
        expect.objectContaining({
          indices: expect.any(Array),
          topDrivers: expect.any(Array),
        })
      );
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  it('keeps insufficient-snapshots drift behavior compatibility-safe', async () => {
    const loggerInfo = jest
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);
    const stdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const snapshotDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-drift-empty-')
    );
    const expectedMessage =
      'At least two snapshots are required. Run nx repo-snapshot multiple times first.';

    try {
      const jsonResult = await runGovernanceDrift({
        output: 'json',
        snapshotDir,
      });
      const cliResult = await runGovernanceDrift({
        output: 'cli',
        snapshotDir,
      });

      expect(jsonResult).toEqual({
        comparison: null,
        signals: [],
        summary: {
          overallTrend: 'stable',
          worseningCount: 0,
          improvingCount: 0,
          stableCount: 0,
          topWorsening: [],
          topImproving: [],
        },
        rendered: JSON.stringify(
          {
            error: expectedMessage,
          },
          null,
          2
        ),
        success: false,
      });
      expect(JSON.parse(jsonResult.rendered)).toEqual({
        error: expectedMessage,
      });
      expect(cliResult.rendered).toBe(expectedMessage);
      expect(cliResult.success).toBe(false);
      expect(stdoutWrite).toHaveBeenCalledWith(`${jsonResult.rendered}\n`);
      expect(loggerInfo).toHaveBeenCalledWith(expectedMessage);
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  it('builds enriched snapshot comparisons and drift summaries', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const snapshotDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-drift-')
    );

    try {
      const baselinePath = writeSnapshotFile(
        snapshotDir,
        '2026-03-01T10-00-00.json',
        {
          timestamp: '2026-03-01T10:00:00Z',
          repo: 'anarchitecture-plugins',
          branch: 'main',
          commitSha: 'abc123',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.1',
          metrics: {
            'architectural-entropy': 0.2,
          },
          scores: {
            workspaceHealth: 80,
            'architectural-entropy': 85,
          },
          violations: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/data-access',
              target: 'libs/shared/data-access',
              severity: 'error',
            },
          ],
          health: {
            score: 80,
            status: 'warning',
            grade: 'B',
          },
          signalBreakdown: {
            total: 3,
            bySource: [
              { source: 'graph', count: 1 },
              { source: 'conformance', count: 0 },
              { source: 'policy', count: 2 },
            ],
            byType: [
              { type: 'structural-dependency', count: 1 },
              { type: 'domain-boundary-violation', count: 2 },
            ],
            bySeverity: [
              { severity: 'info', count: 1 },
              { severity: 'warning', count: 0 },
              { severity: 'error', count: 2 },
            ],
          },
          metricBreakdown: {
            families: [
              {
                family: 'architecture',
                score: 84,
                measurements: [],
              },
              {
                family: 'ownership',
                score: 90,
                measurements: [],
              },
            ],
          },
          topIssues: [
            {
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 2,
              projects: ['libs/orders/data-access', 'libs/shared/data-access'],
              ruleId: 'domain-boundary',
              message: 'Domain boundary is violated.',
            },
          ],
        }
      );
      const currentPath = writeSnapshotFile(
        snapshotDir,
        '2026-03-13T10-00-00.json',
        {
          timestamp: '2026-03-13T10:00:00Z',
          repo: 'anarchitecture-plugins',
          branch: 'main',
          commitSha: 'def456',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.1',
          metrics: {
            'architectural-entropy': 0.25,
          },
          scores: {
            workspaceHealth: 74,
            'architectural-entropy': 79,
          },
          violations: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/data-access',
              target: 'libs/shared/data-access',
              severity: 'error',
            },
            {
              type: 'domain-boundary',
              source: 'libs/orders/feature',
              target: 'libs/shared/ui',
              severity: 'error',
            },
          ],
          health: {
            score: 74,
            status: 'warning',
            grade: 'C',
          },
          signalBreakdown: {
            total: 5,
            bySource: [
              { source: 'graph', count: 2 },
              { source: 'conformance', count: 1 },
              { source: 'policy', count: 2 },
            ],
            byType: [
              { type: 'structural-dependency', count: 2 },
              { type: 'conformance-violation', count: 1 },
              { type: 'domain-boundary-violation', count: 2 },
            ],
            bySeverity: [
              { severity: 'info', count: 1 },
              { severity: 'warning', count: 1 },
              { severity: 'error', count: 3 },
            ],
          },
          metricBreakdown: {
            families: [
              {
                family: 'architecture',
                score: 79,
                measurements: [],
              },
              {
                family: 'ownership',
                score: 90,
                measurements: [],
              },
            ],
          },
          topIssues: [
            {
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 3,
              projects: [
                'libs/orders/data-access',
                'libs/orders/feature',
                'libs/shared/data-access',
              ],
              ruleId: 'domain-boundary',
              message: 'Domain boundary is violated.',
            },
          ],
        }
      );

      const result = await runGovernanceDrift({
        output: 'json',
        baseline: baselinePath,
        current: currentPath,
      });
      const cliResult = await runGovernanceDrift({
        output: 'cli',
        baseline: baselinePath,
        current: currentPath,
      });
      const rendered = JSON.parse(result.rendered) as {
        summary: Record<string, unknown>;
      };

      expect(result.comparison?.healthDelta).toEqual({
        baselineScore: 80,
        currentScore: 74,
        scoreDelta: -6,
        baselineStatus: 'warning',
        currentStatus: 'warning',
        baselineGrade: 'B',
        currentGrade: 'C',
      });
      expect(result.comparison?.metricFamilyDeltas).toContainEqual({
        family: 'architecture',
        baseline: 84,
        current: 79,
        delta: -5,
      });
      expect(
        result.signals.some((signal) => signal.kind === 'metric-family')
      ).toBe(true);
      expect(result.summary.overallTrend).toBe('worsening');
      expect(rendered.summary['overallTrend']).toBe('worsening');
      expect(cliResult.rendered).toContain('Overall trend: Worsening');
      expect(cliResult.rendered).toContain('Top Worsening:');
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });

  it('passes structured drift summaries through AI drift metadata', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const snapshotDir = mkdtempSync(
      path.join(tmpdir(), 'nx-governance-ai-drift-')
    );

    try {
      const baselinePath = writeSnapshotFile(
        snapshotDir,
        '2026-03-01T10-00-00.json',
        {
          timestamp: '2026-03-01T10:00:00Z',
          repo: 'anarchitecture-plugins',
          branch: 'main',
          commitSha: 'abc123',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.1',
          metrics: {
            'architectural-entropy': 0.2,
          },
          scores: {
            workspaceHealth: 78,
          },
          violations: [],
          health: {
            score: 78,
            status: 'warning',
            grade: 'B',
          },
          signalBreakdown: {
            total: 2,
            bySource: [
              { source: 'graph', count: 1 },
              { source: 'conformance', count: 0 },
              { source: 'policy', count: 1 },
            ],
            byType: [
              { type: 'structural-dependency', count: 1 },
              { type: 'domain-boundary-violation', count: 1 },
            ],
            bySeverity: [
              { severity: 'info', count: 1 },
              { severity: 'warning', count: 0 },
              { severity: 'error', count: 1 },
            ],
          },
          metricBreakdown: {
            families: [
              {
                family: 'architecture',
                score: 80,
                measurements: [],
              },
            ],
          },
          topIssues: [
            {
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 1,
              projects: ['libs/orders/data-access'],
              ruleId: 'domain-boundary',
              message: 'Domain boundary is violated.',
            },
          ],
        }
      );
      const currentPath = writeSnapshotFile(
        snapshotDir,
        '2026-03-13T10-00-00.json',
        {
          timestamp: '2026-03-13T10:00:00Z',
          repo: 'anarchitecture-plugins',
          branch: 'main',
          commitSha: 'def456',
          pluginVersion: '0.1.0',
          metricSchemaVersion: '1.1',
          metrics: {
            'architectural-entropy': 0.28,
          },
          scores: {
            workspaceHealth: 70,
          },
          violations: [
            {
              type: 'domain-boundary',
              source: 'libs/orders/data-access',
              target: 'libs/shared/data-access',
              severity: 'error',
            },
          ],
          health: {
            score: 70,
            status: 'warning',
            grade: 'C',
          },
          signalBreakdown: {
            total: 4,
            bySource: [
              { source: 'graph', count: 2 },
              { source: 'conformance', count: 0 },
              { source: 'policy', count: 2 },
            ],
            byType: [
              { type: 'structural-dependency', count: 2 },
              { type: 'domain-boundary-violation', count: 2 },
            ],
            bySeverity: [
              { severity: 'info', count: 1 },
              { severity: 'warning', count: 1 },
              { severity: 'error', count: 2 },
            ],
          },
          metricBreakdown: {
            families: [
              {
                family: 'architecture',
                score: 72,
                measurements: [],
              },
            ],
          },
          topIssues: [
            {
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 2,
              projects: ['libs/orders/data-access', 'libs/shared/data-access'],
              ruleId: 'domain-boundary',
              message: 'Domain boundary is violated.',
            },
          ],
        }
      );

      const result = await runGovernanceAiDrift({
        output: 'json',
        baseline: baselinePath,
        current: currentPath,
      });

      expect(result.summary.overallTrend).toBe('worsening');
      expect(result.request.inputs.metadata?.['driftSummary']).toEqual(
        result.summary
      );
      expect(result.analysis.metadata?.trend).toBe('worsening');
      expect(result.analysis.metadata?.topWorsening).toEqual(
        result.summary.topWorsening
      );
      expect(result.rendered).toContain('"summary"');
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  });
});
