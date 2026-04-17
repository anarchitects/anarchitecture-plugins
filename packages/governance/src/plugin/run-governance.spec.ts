import * as fs from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { logger, workspaceRoot } from '@nx/devkit';

import { calculateHealthScore } from '../health-engine/calculate-health.js';
import {
  angularCleanupProfile,
  loadProfileOverrides,
} from '../presets/angular-cleanup/profile.js';
import {
  runGovernance,
  runGovernanceAiDrift,
  runGovernanceDrift,
  runGovernanceSnapshot,
} from './run-governance.js';

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
  });

  it('keeps report measurement ids stable across report types after signal-based metric wiring', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const profileName = 'angular-cleanup';
    const overrides = await loadProfileOverrides(workspaceRoot, profileName);
    const resolvedWeights = {
      'architectural-entropy':
        overrides.metrics?.architecturalEntropyWeight ??
        angularCleanupProfile.metrics.architecturalEntropyWeight,
      'dependency-complexity':
        overrides.metrics?.dependencyComplexityWeight ??
        angularCleanupProfile.metrics.dependencyComplexityWeight,
      'domain-integrity':
        overrides.metrics?.domainIntegrityWeight ??
        angularCleanupProfile.metrics.domainIntegrityWeight,
      'ownership-coverage':
        overrides.metrics?.ownershipCoverageWeight ??
        angularCleanupProfile.metrics.ownershipCoverageWeight,
      'documentation-completeness':
        overrides.metrics?.documentationCompletenessWeight ??
        angularCleanupProfile.metrics.documentationCompletenessWeight,
      'layer-integrity':
        overrides.metrics?.layerIntegrityWeight ??
        angularCleanupProfile.metrics.layerIntegrityWeight,
    };
    const resolvedStatusThresholds =
      overrides.health?.statusThresholds ??
      angularCleanupProfile.health.statusThresholds;

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
    ).toEqual(['architectural-entropy', 'domain-integrity', 'layer-integrity']);
    expect(
      ownership.assessment.measurements.map((metric) => metric.id)
    ).toEqual(['ownership-coverage']);
    expect(
      architecture.assessment.measurements.map((metric) => metric.id)
    ).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
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
    ).toEqual(['architecture', 'boundaries']);
    expect(
      ownership.assessment.metricBreakdown.families.map((entry) => entry.family)
    ).toEqual(['ownership']);
    expect(health.assessment.topIssues.length).toBeGreaterThan(0);
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

      expect(result.snapshot.metricSchemaVersion).toBe('1.1');
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
