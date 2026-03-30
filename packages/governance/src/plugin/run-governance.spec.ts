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
import { runGovernance } from './run-governance.js';

describe('runGovernance', () => {
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
    };

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
      calculateHealthScore(health.assessment.measurements, resolvedWeights)
    );
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
});
