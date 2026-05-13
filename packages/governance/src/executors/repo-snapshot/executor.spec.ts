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
});
