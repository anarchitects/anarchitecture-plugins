import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

describe('nx-governance', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createTestProject();

    const governancePackagePath = join(process.cwd(), 'packages/governance');

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

    const raw = readFileSync(reportPath, 'utf-8');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = JSON.parse(raw.slice(start, end + 1));

    expect(json.profile).toBe('angular-cleanup');
    expect(json.workspace).toBeDefined();
    expect(Array.isArray(json.measurements)).toBe(true);
    expect(json.health).toBeDefined();
  });
});

function createTestProject(projectName = 'test-governance-project') {
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

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
