import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

describe('nx-governance', () => {
  let projectDirectory: string;
  const workspaceRoot = join(__dirname, '../../..');

  beforeAll(() => {
    projectDirectory = createTestProject();

    const governancePackagePath = join(workspaceRoot, 'packages/governance');

    execSync(
      `yarn add -D @anarchitects/nx-governance@file:${governancePackagePath}`,
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: process.env,
      }
    );
  });

  afterAll(() => {
    if (projectDirectory) {
      rmSync(projectDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it('initializes governance and runs repo-health', () => {
    execSync('yarn nx g @anarchitects/nx-governance:init --no-interactive', {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
      },
    });

    const profilePath = join(
      projectDirectory,
      'tools/governance/profiles/angular-cleanup.json'
    );
    expect(existsSync(profilePath)).toBe(true);

    execSync('yarn nx workspace-graph --skip-nx-cache > workspace-graph.txt', {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
      },
    });

    const workspaceGraphPath = join(projectDirectory, 'workspace-graph.txt');
    expect(existsSync(workspaceGraphPath)).toBe(true);
    const workspaceGraph = readFileSync(workspaceGraphPath, 'utf-8');
    expect(workspaceGraph).toMatch(/Projects:\s+\d+/);
    expect(workspaceGraph).toMatch(/Dependencies:\s+\d+/);

    execSync(
      'yarn nx repo-health --profile=angular-cleanup --output=json > governance-report.json',
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
        },
      }
    );

    const reportPath = join(projectDirectory, 'governance-report.json');
    expect(existsSync(reportPath)).toBe(true);

    const json = readJsonFromCommandOutput(reportPath);

    expect(json.profile).toBe('angular-cleanup');
    expect(json.workspace).toBeDefined();
    expect(Array.isArray(json.measurements)).toBe(true);
    expect(json.health).toBeDefined();
  });

  it('runs deterministic AI commands and returns request/analysis payloads', () => {
    const aiCommands: Array<{ target: string; kind: string; args?: string }> = [
      {
        target: 'repo-ai-root-cause',
        kind: 'root-cause',
        args: '--topViolations=5',
      },
      { target: 'repo-ai-drift', kind: 'drift' },
      { target: 'repo-ai-pr-impact', kind: 'pr-impact' },
      {
        target: 'repo-ai-cognitive-load',
        kind: 'cognitive-load',
        args: '--topProjects=5',
      },
      {
        target: 'repo-ai-recommendations',
        kind: 'recommendations',
        args: '--topViolations=5',
      },
      {
        target: 'repo-ai-smell-clusters',
        kind: 'smell-clusters',
        args: '--topViolations=5',
      },
      {
        target: 'repo-ai-refactoring-suggestions',
        kind: 'refactoring-suggestions',
        args: '--topViolations=5 --topProjects=3',
      },
      { target: 'repo-ai-scorecard', kind: 'scorecard' },
      {
        target: 'repo-ai-onboarding',
        kind: 'onboarding',
        args: '--topViolations=5 --topProjects=3',
      },
    ];

    for (const command of aiCommands) {
      const outputPath = join(projectDirectory, `${command.target}.json`);
      const args = command.args ? ` ${command.args}` : '';

      execSync(
        `yarn nx ${command.target} --profile=angular-cleanup --output=json --skip-nx-cache${args} > ${outputPath}`,
        {
          cwd: projectDirectory,
          stdio: 'inherit',
          env: {
            ...process.env,
            NX_DAEMON: 'false',
          },
        }
      );

      const json = readJsonFromCommandOutput(outputPath);
      expect(json.request?.kind).toBe(command.kind);
      expect(json.analysis?.kind).toBe(command.kind);
      expect(typeof json.analysis?.summary).toBe('string');
      expect(Array.isArray(json.analysis?.findings)).toBe(true);
      expect(Array.isArray(json.analysis?.recommendations)).toBe(true);

      if (
        command.target === 'repo-ai-root-cause' ||
        command.target === 'repo-ai-drift' ||
        command.target === 'repo-ai-pr-impact' ||
        command.target === 'repo-ai-scorecard'
      ) {
        const useCase = command.kind;
        const payloadPath = join(
          projectDirectory,
          `.governance-metrics/ai/${useCase}.payload.json`
        );
        const promptPath = join(
          projectDirectory,
          `.governance-metrics/ai/${useCase}.prompt.md`
        );

        expect(existsSync(payloadPath)).toBe(true);
        expect(existsSync(promptPath)).toBe(true);

        const prompt = readFileSync(promptPath, 'utf-8');
        expect(prompt).toContain('## Grounding Constraints');

        const payloadRaw = readFileSync(payloadPath, 'utf-8');
        const payload = JSON.parse(payloadRaw) as {
          payloadScope?: Record<string, unknown>;
          request?: {
            inputs?: {
              metadata?: {
                payloadScope?: Record<string, unknown>;
              };
            };
          };
        };

        const scopeMetadata =
          payload.payloadScope ??
          payload.request?.inputs?.metadata?.payloadScope;
        expect(scopeMetadata).toBeDefined();
      }
    }
  });
});

function readJsonFromCommandOutput(filePath: string): any {
  const raw = readFileSync(filePath, 'utf-8');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return JSON.parse(raw.slice(start, end + 1));
}

function createTestProject(projectName = 'test-governance-project') {
  const workspaceRoot = join(__dirname, '../../..');
  const projectDirectory = join(workspaceRoot, 'tmp', projectName);

  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  execSync(
    `yarn dlx create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );

  return projectDirectory;
}
