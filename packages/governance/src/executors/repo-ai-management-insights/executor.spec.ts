jest.mock('../../plugin/run-governance.js', () => ({
  runGovernanceAiManagementInsights: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { runGovernanceAiManagementInsights } from '../../plugin/run-governance.js';

import repoAiManagementInsightsExecutor from './executor.js';

describe('repo-ai-management-insights executor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('preserves management-insights AI handoff option pass-through and success semantics', async () => {
    jest.mocked(runGovernanceAiManagementInsights).mockResolvedValue({
      assessment: {} as never,
      deliveryImpact: {} as never,
      comparison: undefined,
      request: {} as never,
      analysis: {} as never,
      handoffPayloadPath:
        '.governance-metrics/ai/management-insights.payload.json',
      handoffPromptPath: '.governance-metrics/ai/management-insights.prompt.md',
      rendered: '',
      success: true,
    });

    const result = await repoAiManagementInsightsExecutor({
      profile: 'frontend-layered',
      output: 'json',
      snapshotDir: '.governance-metrics/snapshots',
      baseline: '.governance-metrics/snapshots/2026-05-15.json',
      current: '.governance-metrics/snapshots/2026-05-16.json',
      failOnViolation: true,
    });

    expect(runGovernanceAiManagementInsights).toHaveBeenCalledWith({
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

    expect(config.executors['repo-ai-management-insights']).toEqual({
      implementation: './executors/repo-ai-management-insights/executor',
      schema: './executors/repo-ai-management-insights/schema.json',
    });
    expect(schema.properties.profile.default).toBe('frontend-layered');
    expect(schema.properties.output).toMatchObject({
      default: 'json',
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
});
