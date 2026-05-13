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
});
