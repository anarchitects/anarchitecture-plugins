import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export const workspaceRoot = join(__dirname, '../../..');

export type WorkspaceSnapshot = {
  nxJson: string;
  packageJson: string;
};

export function captureWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    nxJson: readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    packageJson: readFileSync(join(workspaceRoot, 'package.json'), 'utf-8'),
  };
}

export function resetWorkspaceState(
  snapshot: WorkspaceSnapshot,
  sandboxProjects: readonly string[]
) {
  writeFileSync(join(workspaceRoot, 'nx.json'), snapshot.nxJson);
  writeFileSync(join(workspaceRoot, 'package.json'), snapshot.packageJson);

  for (const projectRoot of sandboxProjects) {
    rmSync(join(workspaceRoot, projectRoot), {
      recursive: true,
      force: true,
    });
  }
}

export function runNx(command: string) {
  execSync(command, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_CACHE_PROJECT_GRAPH: 'false',
    },
  });
}

export function runNxExpectFailure(command: string): string {
  try {
    execSync(command, {
      cwd: workspaceRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_CACHE_PROJECT_GRAPH: 'false',
      },
    });
  } catch (error) {
    const executionError = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };

    const stdout =
      typeof executionError.stdout === 'string'
        ? executionError.stdout
        : executionError.stdout?.toString('utf-8') ?? '';
    const stderr =
      typeof executionError.stderr === 'string'
        ? executionError.stderr
        : executionError.stderr?.toString('utf-8') ?? '';

    return `${stdout}\n${stderr}\n${executionError.message ?? ''}`;
  }

  throw new Error(`Expected command to fail, but it succeeded: ${command}`);
}

export function createProject(
  projectRoot: string,
  projectJson: Record<string, unknown>,
  files: Record<string, string>
) {
  const fullProjectRoot = join(workspaceRoot, projectRoot);
  mkdirSync(fullProjectRoot, { recursive: true });
  writeFileSync(
    join(fullProjectRoot, 'project.json'),
    `${JSON.stringify(projectJson, null, 2)}\n`
  );

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(fullProjectRoot, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
  }
}

export function showProject(projectName: string) {
  const output = execSync(`yarn nx show project ${projectName} --json`, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NX_DAEMON: 'false',
      NX_CACHE_PROJECT_GRAPH: 'false',
    },
    encoding: 'utf-8',
  });

  return JSON.parse(output) as {
    targets: Record<string, unknown>;
  };
}

export function readProjectFile(projectRoot: string, relativePath: string) {
  return readFileSync(join(workspaceRoot, projectRoot, relativePath), 'utf-8');
}

export function projectFileExists(projectRoot: string, relativePath: string) {
  return existsSync(join(workspaceRoot, projectRoot, relativePath));
}
