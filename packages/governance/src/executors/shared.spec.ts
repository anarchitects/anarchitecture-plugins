jest.mock('../plugin/run-governance.js', () => ({
  runGovernance: jest.fn(),
}));

import { runGovernance } from '../plugin/run-governance.js';

import { runGovernanceExecutor } from './shared.js';

describe('shared governance executor orchestration', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it.each(['health', 'boundaries', 'ownership', 'architecture'] as const)(
    'delegates %s runs through the host governance entrypoint',
    async (reportType) => {
      jest.mocked(runGovernance).mockResolvedValue({
        assessment: {} as never,
        rendered: '',
        success: reportType !== 'ownership',
      });

      const result = await runGovernanceExecutor(
        {
          profile: 'frontend-layered',
          output: 'json',
          failOnViolation: true,
          conformanceJson: 'dist/conformance.json',
        },
        {} as never,
        reportType
      );

      expect(runGovernance).toHaveBeenCalledWith({
        profile: 'frontend-layered',
        output: 'json',
        failOnViolation: true,
        conformanceJson: 'dist/conformance.json',
        reportType,
      });
      expect(result).toEqual({ success: reportType !== 'ownership' });
    }
  );
});
