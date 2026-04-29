import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export const workspaceRoot = join(__dirname, '../../..');

export type WorkspaceSnapshot = {
  nxJson: string;
};

export function captureWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    nxJson: readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
  };
}

export function resetWorkspaceState(
  snapshot: WorkspaceSnapshot,
  sandboxProjects: readonly string[]
) {
  writeFileSync(join(workspaceRoot, 'nx.json'), snapshot.nxJson);

  for (const projectRoot of sandboxProjects) {
    rmSync(join(workspaceRoot, projectRoot), {
      recursive: true,
      force: true,
    });
  }
}

export function registerNestPlugin() {
  const nxJsonPath = join(workspaceRoot, 'nx.json');
  const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8')) as {
    plugins?: Array<Record<string, unknown>>;
  };

  nxJson.plugins ??= [];
  nxJson.plugins = nxJson.plugins.filter(
    (entry) =>
      !(
        typeof entry?.plugin === 'string' &&
        entry.plugin === '@anarchitects/nest'
      )
  );
  nxJson.plugins.push({
    plugin: '@anarchitects/nest',
    options: {
      buildTargetName: 'build',
      serveTargetName: 'serve',
      testTargetName: 'test',
      lintTargetName: 'lint',
    },
  });

  writeFileSync(nxJsonPath, `${JSON.stringify(nxJson, null, 2)}\n`);
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
    name: string;
    root: string;
    targets: Record<string, unknown>;
  };
}

export function readProjectFile(projectRoot: string, relativePath: string) {
  return readFileSync(join(workspaceRoot, projectRoot, relativePath), 'utf-8');
}

export function projectFileExists(projectRoot: string, relativePath: string) {
  return existsSync(join(workspaceRoot, projectRoot, relativePath));
}
