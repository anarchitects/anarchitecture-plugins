import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  cleanupTestProject,
  createInitializedGovernanceWorkspace,
  defaultProfileName,
  expectProfileExists,
} from './test-utils';

describe('nx-governance repo-health', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createInitializedGovernanceWorkspace(
      'test-governance-project-repo-health'
    );
  });

  afterAll(() => {
    cleanupTestProject(projectDirectory);
  });

  it('initializes governance and runs repo-health', () => {
    expectProfileExists(projectDirectory);

    execSync('yarn nx workspace-graph --skip-nx-cache > workspace-graph.txt', {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
      },
    });

    const workspaceGraphPath = join(projectDirectory, 'workspace-graph.txt');
    expect(existsSync(workspaceGraphPath)).toBe(true);

    const workspaceGraph = readFileSync(workspaceGraphPath, 'utf-8');
    expect(workspaceGraph).toMatch(/Projects:\s+\d+/);
    expect(workspaceGraph).toMatch(/Dependencies:\s+\d+/);

    execSync(
      `yarn nx repo-health --profile=${defaultProfileName} --output=json > governance-report.json`,
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
        },
      }
    );

    const reportPath = join(projectDirectory, 'governance-report.json');
    expect(existsSync(reportPath)).toBe(true);

    const raw = readFileSync(reportPath, 'utf-8');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = JSON.parse(raw.slice(start, end + 1)) as {
      profile?: string;
      workspace?: unknown;
      measurements?: unknown[];
      health?: unknown;
    };

    expect(json.profile).toBe(defaultProfileName);
    expect(json.workspace).toBeDefined();
    expect(Array.isArray(json.measurements)).toBe(true);
    expect(json.health).toBeDefined();
  });
});
