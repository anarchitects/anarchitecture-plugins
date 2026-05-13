import { readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('./shared.js', () => ({
  runGovernanceExecutor: jest.fn(),
}));

import repoArchitectureExecutor from './repo-architecture/executor.js';
import repoBoundariesExecutor from './repo-boundaries/executor.js';
import repoHealthExecutor from './repo-health/executor.js';
import repoOwnershipExecutor from './repo-ownership/executor.js';
import { runGovernanceExecutor } from './shared.js';

const reportExecutors = [
  ['repo-health', repoHealthExecutor, 'health'],
  ['repo-boundaries', repoBoundariesExecutor, 'boundaries'],
  ['repo-ownership', repoOwnershipExecutor, 'ownership'],
  ['repo-architecture', repoArchitectureExecutor, 'architecture'],
] as const;

describe('report executors', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it.each(reportExecutors)(
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

  it('keeps public executor registration and schema defaults stable for report targets', () => {
    const config = JSON.parse(
      readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8')
    ) as {
      executors: Record<string, { implementation: string; schema: string }>;
    };

    for (const [targetName] of reportExecutors) {
      const registration = config.executors[targetName];

      expect(registration).toEqual({
        implementation: `./executors/${targetName}/executor`,
        schema: `./executors/${targetName}/schema.json`,
      });

      const schema = JSON.parse(
        readFileSync(path.join(__dirname, targetName, 'schema.json'), 'utf8')
      ) as {
        additionalProperties: boolean;
        properties: {
          profile: { default: string; type: string };
          output: { default: string; enum: string[]; type: string };
          failOnViolation: { default: boolean; type: string };
          conformanceJson: { type: string };
        };
      };

      expect(schema.properties.profile).toMatchObject({
        type: 'string',
        default: 'frontend-layered',
      });
      expect(schema.properties.output).toMatchObject({
        type: 'string',
        enum: ['cli', 'json'],
        default: 'cli',
      });
      expect(schema.properties.failOnViolation).toMatchObject({
        type: 'boolean',
        default: false,
      });
      expect(schema.properties.conformanceJson).toMatchObject({
        type: 'string',
      });
      expect(schema.additionalProperties).toBe(false);
    }
  });
});
