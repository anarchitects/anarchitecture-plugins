jest.mock('../../plugin/run-governance.js', () => ({
  runGovernanceAiPrImpact: jest.fn(),
}));

import { runGovernanceAiPrImpact } from '../../plugin/run-governance.js';

import repoAiPrImpactExecutor from './executor.js';

describe('repo-ai-pr-impact executor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('preserves AI handoff option pass-through and success semantics', async () => {
    jest.mocked(runGovernanceAiPrImpact).mockResolvedValue({
      request: {} as never,
      analysis: {} as never,
      handoffPayloadPath: '.governance-metrics/ai/pr-impact.payload.json',
      handoffPromptPath: '.governance-metrics/ai/pr-impact.prompt.md',
      rendered: '',
      success: true,
    });

    const result = await repoAiPrImpactExecutor({
      profile: 'frontend-layered',
      output: 'json',
      failOnViolation: false,
      baseRef: 'origin/main',
      headRef: 'HEAD',
    });

    expect(runGovernanceAiPrImpact).toHaveBeenCalledWith({
      profile: 'frontend-layered',
      output: 'json',
      failOnViolation: false,
      baseRef: 'origin/main',
      headRef: 'HEAD',
    });
    expect(result).toEqual({ success: true });
  });
});
