import { readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('../../plugin/run-governance.js', () => ({
  runGovernanceDrift: jest.fn(),
}));

import { runGovernanceDrift } from '../../plugin/run-governance.js';

import repoDriftExecutor from './executor.js';

describe('repo-drift executor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('preserves drift option pass-through and success semantics', async () => {
    jest.mocked(runGovernanceDrift).mockResolvedValue({
      comparison: null,
      signals: [],
      summary: {
        overallTrend: 'stable',
        topImproving: [],
        topWorsening: [],
      } as never,
      rendered: '',
      success: true,
    });

    const result = await repoDriftExecutor({
      output: 'json',
      snapshotDir: '.governance-metrics/snapshots',
      baseline: 'baseline.json',
      current: 'current.json',
    });

    expect(runGovernanceDrift).toHaveBeenCalledWith({
      output: 'json',
      snapshotDir: '.governance-metrics/snapshots',
      baseline: 'baseline.json',
      current: 'current.json',
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
        output: { default: string; enum: string[] };
        snapshotDir: { default: string };
      };
    };

    expect(config.executors['repo-drift']).toEqual({
      implementation: './executors/repo-drift/executor',
      schema: './executors/repo-drift/schema.json',
    });
    expect(schema.properties.output).toMatchObject({
      default: 'cli',
      enum: ['cli', 'json'],
    });
    expect(schema.properties.snapshotDir.default).toBe(
      '.governance-metrics/snapshots'
    );
    expect(schema.additionalProperties).toBe(false);
  });
});
