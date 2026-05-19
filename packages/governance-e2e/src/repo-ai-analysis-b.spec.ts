import { join } from 'path';
import {
  cleanupTestProject,
  createInitializedGovernanceWorkspace,
  expectProfileExists,
  runGovernanceCommand,
} from './test-utils';

describe('nx-governance AI analysis commands B', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createInitializedGovernanceWorkspace(
      'test-governance-project-ai-analysis-b'
    );
  });

  afterAll(() => {
    cleanupTestProject(projectDirectory);
  });

  it.each([
    [
      'repo-ai-refactoring-suggestions',
      'refactoring-suggestions',
      '--topViolations=5 --topProjects=3',
    ],
    ['repo-ai-onboarding', 'onboarding', '--topViolations=5 --topProjects=3'],
  ] as const)('runs %s and returns deterministic analysis', (target, kind, args) => {
    expectProfileExists(projectDirectory);

    const outputPath = join(projectDirectory, `${target}.json`);
    const json = runGovernanceCommand(projectDirectory, target, outputPath, args);

    expect(json.request?.kind).toBe(kind);
    expect(json.analysis?.kind).toBe(kind);
    expect(typeof json.analysis?.summary).toBe('string');
    expect(Array.isArray(json.analysis?.findings)).toBe(true);
    expect(Array.isArray(json.analysis?.recommendations)).toBe(true);
  });
});
