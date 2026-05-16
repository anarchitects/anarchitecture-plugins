import { readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('../../plugin/run-governance.js', () => ({
  runGovernanceManagementInsights: jest.fn(),
}));

import { runGovernanceManagementInsights } from '../../plugin/run-governance.js';

import repoManagementInsightsExecutor from './executor.js';

describe('repo-management-insights executor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('preserves management insights option pass-through and success semantics', async () => {
    jest.mocked(runGovernanceManagementInsights).mockResolvedValue({
      assessment: {} as never,
      deliveryImpact: {} as never,
      comparison: undefined,
      rendered: '',
      success: true,
    });

    const result = await repoManagementInsightsExecutor({
      profile: 'frontend-layered',
      output: 'json',
      snapshotDir: '.governance-metrics/snapshots',
      baseline: '.governance-metrics/snapshots/2026-05-15.json',
      current: '.governance-metrics/snapshots/2026-05-16.json',
      failOnViolation: true,
    });

    expect(runGovernanceManagementInsights).toHaveBeenCalledWith({
      profile: 'frontend-layered',
      output: 'json',
      snapshotDir: '.governance-metrics/snapshots',
      baseline: '.governance-metrics/snapshots/2026-05-15.json',
      current: '.governance-metrics/snapshots/2026-05-16.json',
      failOnViolation: true,
    });
    expect(result).toEqual({ success: true });
  });

  it('keeps public registration and schema defaults stable', () => {
    const config = JSON.parse(
      readFileSync(path.join(__dirname, '..', '..', 'index.json'), 'utf8')
    ) as {
      executors: Record<string, { implementation: string; schema: string }>;
    };
    const schema = JSON.parse(
      readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
    ) as {
      additionalProperties: boolean;
      properties: {
        profile: { default: string };
        output: { default: string; enum: string[] };
        snapshotDir: { default: string };
        baseline: { type: string };
        current: { type: string };
        failOnViolation: { default: boolean };
      };
    };

    expect(config.executors['repo-management-insights']).toEqual({
      implementation: './executors/repo-management-insights/executor',
      schema: './executors/repo-management-insights/schema.json',
    });
    expect(schema.properties.profile.default).toBe('frontend-layered');
    expect(schema.properties.output).toMatchObject({
      default: 'cli',
      enum: ['cli', 'json'],
    });
    expect(schema.properties.snapshotDir.default).toBe(
      '.governance-metrics/snapshots'
    );
    expect(schema.properties.baseline.type).toBe('string');
    expect(schema.properties.current.type).toBe('string');
    expect(schema.properties.failOnViolation.default).toBe(false);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps management insights orchestration in the Nx host layer', () => {
    const runGovernanceSource = readFileSync(
      path.join(__dirname, '..', '..', 'plugin', 'run-governance.ts'),
      'utf8'
    );

    expect(runGovernanceSource).toContain(
      'export async function runGovernanceManagementInsights'
    );
    expect(runGovernanceSource).toContain('buildDeliveryImpactAssessment({');
    expect(runGovernanceSource).toContain(
      'renderManagementReport(deliveryImpact)'
    );
    expect(runGovernanceSource).toContain('process.stdout.write');
    expect(runGovernanceSource).toContain('logger.info');
    expect(runGovernanceSource).toContain(
      'resolveOptionalSnapshotComparison(options)'
    );
  });
});
