import { readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('../../plugin/run-governance.js', () => ({
  runGovernanceSnapshot: jest.fn(),
}));

import { runGovernanceSnapshot } from '../../plugin/run-governance.js';

import repoSnapshotExecutor from './executor.js';

describe('repo-snapshot executor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('preserves snapshot option pass-through and success semantics', async () => {
    jest.mocked(runGovernanceSnapshot).mockResolvedValue({
      assessment: {} as never,
      rendered: '',
      success: false,
      snapshot: {} as never,
      snapshotPath: '.governance-metrics/snapshots/2026-01-01.json',
    });

    const result = await repoSnapshotExecutor({
      profile: 'frontend-layered',
      output: 'json',
      failOnViolation: true,
      snapshotDir: '.governance-metrics/snapshots',
      metricSchemaVersion: '1.1',
    });

    expect(runGovernanceSnapshot).toHaveBeenCalledWith({
      profile: 'frontend-layered',
      output: 'json',
      failOnViolation: true,
      snapshotDir: '.governance-metrics/snapshots',
      metricSchemaVersion: '1.1',
    });
    expect(result).toEqual({ success: false });
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
        failOnViolation: { default: boolean };
        snapshotDir: { default: string };
        metricSchemaVersion: { default: string };
      };
    };

    expect(config.executors['repo-snapshot']).toEqual({
      implementation: './executors/repo-snapshot/executor',
      schema: './executors/repo-snapshot/schema.json',
    });
    expect(schema.properties.profile.default).toBe('frontend-layered');
    expect(schema.properties.output).toMatchObject({
      default: 'cli',
      enum: ['cli', 'json'],
    });
    expect(schema.properties.failOnViolation.default).toBe(false);
    expect(schema.properties.snapshotDir.default).toBe(
      '.governance-metrics/snapshots'
    );
    expect(schema.properties.metricSchemaVersion.default).toBe('1.1');
    expect(schema.additionalProperties).toBe(false);
  });
});
