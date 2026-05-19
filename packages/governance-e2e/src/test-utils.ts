import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';

export const defaultProfileName = 'frontend-layered';

export function createInitializedGovernanceWorkspace(
  projectName: string
): string {
  const projectDirectory = createTestProject(projectName);
  const workspaceRoot = join(__dirname, '../../..');
  const governancePackagePath = join(workspaceRoot, 'packages/governance');

  execSync(
    `yarn add -D @anarchitects/nx-governance@file:${governancePackagePath}`,
    {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: createChildWorkspaceEnv(),
    }
  );

  execSync(
    `yarn nx g @anarchitects/nx-governance:init --no-interactive --targetPreset=full --profile=${defaultProfileName}`,
    {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: createChildWorkspaceEnv(),
    }
  );

  return projectDirectory;
}

export function cleanupTestProject(projectDirectory: string | undefined): void {
  if (!projectDirectory) {
    return;
  }

  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
}

export function expectProfileExists(projectDirectory: string): void {
  const profilePath = join(
    projectDirectory,
    `tools/governance/profiles/${defaultProfileName}.json`
  );
  expect(existsSync(profilePath)).toBe(true);
}

export function runGovernanceCommand(
  projectDirectory: string,
  command: string,
  outputPath: string,
  args = ''
): any {
  execSync(
    `yarn nx ${command} --profile=${defaultProfileName} --output=json --skip-nx-cache${
      args ? ' ' + args : ''
    } > ${outputPath}`,
    {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: createChildWorkspaceEnv(),
    }
  );

  return readJsonFromCommandOutput(outputPath);
}

export function expectAiPayloadArtifacts(
  projectDirectory: string,
  useCase: string
): void {
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

  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8')) as {
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
    payload.payloadScope ?? payload.request?.inputs?.metadata?.payloadScope;
  expect(scopeMetadata).toBeDefined();
}

function readJsonFromCommandOutput(filePath: string): any {
  const raw = readFileSync(filePath, 'utf-8');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return JSON.parse(raw.slice(start, end + 1));
}

function createTestProject(projectName: string): string {
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
      env: createChildWorkspaceEnv(),
    }
  );

  return projectDirectory;
}

function createChildWorkspaceEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NX_DAEMON: 'false',
    // Temp e2e workspaces need to generate their own lockfile during setup.
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  };
}
