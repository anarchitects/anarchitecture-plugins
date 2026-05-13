jest.mock('./shared.js', () => ({
  runGovernanceExecutor: jest.fn(),
}));

import repoArchitectureExecutor from './repo-architecture/executor.js';
import repoBoundariesExecutor from './repo-boundaries/executor.js';
import repoHealthExecutor from './repo-health/executor.js';
import repoOwnershipExecutor from './repo-ownership/executor.js';
import { runGovernanceExecutor } from './shared.js';

describe('report executors', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    ['repo-health', repoHealthExecutor, 'health'],
    ['repo-boundaries', repoBoundariesExecutor, 'boundaries'],
    ['repo-ownership', repoOwnershipExecutor, 'ownership'],
    ['repo-architecture', repoArchitectureExecutor, 'architecture'],
  ] as const)(
    '%s preserves its public report routing',
    async (_name, executor, reportType) => {
      jest.mocked(runGovernanceExecutor).mockResolvedValue({ success: true });
      const options = {
        profile: 'frontend-layered',
        output: 'cli' as const,
        failOnViolation: true,
        conformanceJson: 'dist/conformance.json',
      };
      const context = {} as never;

      const result = await executor(options, context);

      expect(runGovernanceExecutor).toHaveBeenCalledWith(
        options,
        context,
        reportType
      );
      expect(result).toEqual({ success: true });
    }
  );
});
