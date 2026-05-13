import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  buildAiRootCauseHandoffPayload,
  buildGovernanceAssessment,
  buildMetricSnapshot,
  compareSnapshots,
  type GovernanceExceptionReport,
  type GovernanceProfile,
} from './index.js';
import {
  coreTestAdapterResult,
  coreTestWorkspace,
} from './testing/workspace.fixtures.js';
import { calculateHealthScore } from '../health-engine/calculate-health.js';
import { buildInventory } from '../inventory/build-inventory.js';
import { calculateMetrics } from '../metric-engine/calculate-metrics.js';
import { evaluatePolicies } from '../policy-engine/evaluate-policies.js';
import { buildPolicySignals } from '../signal-engine/index.js';

describe('Core no-Nx confidence', () => {
  it('loads and exercises the Core-facing pipeline without Nx workspace setup', () => {
    const profile: GovernanceProfile = {
      name: 'no-nx-test-profile',
      boundaryPolicySource: 'profile',
      layers: ['app', 'domain', 'ui'],
      allowedDomainDependencies: {
        booking: ['booking'],
        platform: ['platform'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {
        'architectural-entropy': 1,
        'dependency-complexity': 1,
        'domain-integrity': 1,
        'ownership-coverage': 1,
        'documentation-completeness': 1,
        'layer-integrity': 1,
      },
    };
    const exceptions: GovernanceExceptionReport = {
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
    };

    const inventory = buildInventory(coreTestAdapterResult, {
      projectOverrides: {},
    });
    const violations = evaluatePolicies(coreTestWorkspace, profile);
    const signals = buildPolicySignals(violations, {
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    const measurements = calculateMetrics({
      workspace: coreTestWorkspace,
      signals,
    });
    const health = calculateHealthScore(measurements, profile.metrics);
    const assessment = buildGovernanceAssessment({
      workspace: coreTestWorkspace,
      profile: profile.name,
      exceptions,
      violations,
      signals,
      measurements,
      health,
      recommendations: [],
    });
    const snapshot = buildMetricSnapshot(assessment, {
      timestamp: '2026-05-13T00:00:00.000Z',
      repo: 'test-repo',
      branch: 'main',
      commitSha: 'abc123',
      pluginVersion: '0.8.0',
      metricSchemaVersion: '1.1',
    });
    const payload = buildAiRootCauseHandoffPayload({
      request: {
        kind: 'root-cause',
        generatedAt: '2026-05-13T00:00:00.000Z',
        profile: profile.name,
        inputs: {
          snapshot,
          dependencies: coreTestWorkspace.dependencies,
          topViolations: snapshot.violations,
        },
      },
      analysis: {
        kind: 'root-cause',
        summary: 'Test analysis.',
        findings: [],
        recommendations: [],
      },
      metadata: {
        source: 'no-nx-confidence',
      },
    });

    expect(inventory.root).toBe('/virtual/workspace');
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'domain-boundary',
          project: 'platform-shell',
        }),
      ])
    );
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'domain-boundary-violation',
          source: 'policy',
        }),
      ])
    );
    expect(measurements.map((measurement) => measurement.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
    expect(assessment.signalBreakdown.total).toBe(signals.length);
    expect(compareSnapshots(snapshot, snapshot).newViolations).toEqual([]);
    expect(payload).toEqual(
      expect.objectContaining({
        useCase: 'root-cause',
        metadata: {
          source: 'no-nx-confidence',
        },
      })
    );
  });

  it('keeps Core-facing implementation files inside the #241 guardrail', () => {
    const coreFacingRoots = [
      path.resolve(__dirname),
      path.resolve(__dirname, '../policy-engine'),
      path.resolve(__dirname, '../metric-engine'),
      path.resolve(__dirname, '../health-engine'),
      path.resolve(__dirname, '../inventory'),
    ];
    const hostForbiddenPatterns = [
      /from ['"]nx['"]/,
      /from ['"]@nx\//,
      /from ['"]\.\.\/plugin(?:\/|['"])/,
      /from ['"]\.\.\/executors(?:\/|['"])/,
      /from ['"]\.\.\/generators(?:\/|['"])/,
    ];
    const adapterForbiddenPatterns = [
      /from ['"]\.\.\/nx-adapter(?:\/|['"])/,
      /from ['"]\.\.\/conformance-adapter(?:\/|['"])/,
    ];

    for (const filePath of coreFacingRoots.flatMap(
      collectImplementationFiles
    )) {
      const source = readFileSync(filePath, 'utf8');
      const relativePath = path.relative(
        path.resolve(__dirname, '..', '..'),
        filePath
      );

      for (const pattern of hostForbiddenPatterns) {
        expect(source).not.toMatch(pattern);
      }

      if (!relativePath.startsWith(`inventory${path.sep}`)) {
        for (const pattern of adapterForbiddenPatterns) {
          expect(source).not.toMatch(pattern);
        }
      } else {
        expect(source).not.toMatch(/from ['"]\.\.\/nx-adapter(?:\/|['"])/);
      }
    }
  });
});

function collectImplementationFiles(directory: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collected.push(...collectImplementationFiles(resolved));
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.fixtures.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}
