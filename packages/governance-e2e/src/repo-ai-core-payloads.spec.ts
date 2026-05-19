import { join } from 'path';
import {
  cleanupTestProject,
  createInitializedGovernanceWorkspace,
  expectAiPayloadArtifacts,
  expectProfileExists,
  runGovernanceCommand,
} from './test-utils';

describe('nx-governance AI core payload commands', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createInitializedGovernanceWorkspace(
      'test-governance-project-ai-core-payloads'
    );
  });

  afterAll(() => {
    cleanupTestProject(projectDirectory);
  });

  it.each([
    ['repo-ai-root-cause', 'root-cause', '--topViolations=5'],
    ['repo-ai-drift', 'drift', ''],
    ['repo-ai-pr-impact', 'pr-impact', ''],
    ['repo-ai-scorecard', 'scorecard', ''],
  ] as const)(
    'runs %s and persists deterministic payload artifacts',
    (target, kind, args) => {
      expectProfileExists(projectDirectory);

      const outputPath = join(projectDirectory, `${target}.json`);
      const json = runGovernanceCommand(projectDirectory, target, outputPath, args);

      expect(json.request?.kind).toBe(kind);
      expect(json.analysis?.kind).toBe(kind);
      expect(typeof json.analysis?.summary).toBe('string');
      expect(Array.isArray(json.analysis?.findings)).toBe(true);
      expect(Array.isArray(json.analysis?.recommendations)).toBe(true);

      expectAiPayloadArtifacts(projectDirectory, kind);
    }
  );
});
