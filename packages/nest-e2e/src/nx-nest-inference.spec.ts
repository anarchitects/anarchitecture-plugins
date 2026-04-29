import {
  captureWorkspaceSnapshot,
  createProject,
  projectFileExists,
  readProjectFile,
  registerNestPlugin,
  resetWorkspaceState,
  showProject,
} from './test-utils';

describe('nx-nest foundation e2e', () => {
  const projectName = 'nest-e2e-temp-api';
  const projectRoot = 'packages/nest-e2e-temp-api';
  const sandboxProjects = [projectRoot];
  const snapshot = captureWorkspaceSnapshot();

  beforeAll(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  afterEach(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  afterAll(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  it('loads the plugin and infers Nest targets from a minimal fixture', () => {
    registerNestPlugin();

    createProject(
      projectRoot,
      {
        name: projectName,
        root: projectRoot,
        sourceRoot: `${projectRoot}/src`,
        projectType: 'application',
        targets: {},
      },
      {
        'package.json': JSON.stringify(
          {
            name: projectName,
            dependencies: {
              '@nestjs/core': '0.0.0',
            },
          },
          null,
          2
        ),
        'nest-cli.json': JSON.stringify(
          {
            sourceRoot: 'src',
          },
          null,
          2
        ),
        'src/main.ts': `import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  void NestFactory;
}

void bootstrap();
`,
        'jest.config.ts': 'export default {};\n',
        'eslint.config.mjs': 'export default [];\n',
      }
    );

    expect(projectFileExists(projectRoot, 'project.json')).toBe(true);

    const rawProjectJson = JSON.parse(
      readProjectFile(projectRoot, 'project.json')
    ) as {
      targets?: Record<string, unknown>;
    };
    expect(rawProjectJson.targets).toEqual({});

    const project = showProject(projectName);
    const buildTarget = project.targets['build'] as {
      command?: string;
      executor?: string;
      cache?: boolean;
      outputs?: string[];
      options?: { cwd?: string; command?: string };
      metadata?: { technologies?: string[]; description?: string };
    };
    const serveTarget = project.targets['serve'] as {
      command?: string;
      executor?: string;
      continuous?: boolean;
      cache?: boolean;
      options?: { cwd?: string; command?: string };
      metadata?: { technologies?: string[]; description?: string };
    };
    const testTarget = project.targets['test'] as {
      command?: string;
      executor?: string;
      cache?: boolean;
      options?: { cwd?: string; command?: string };
      metadata?: { technologies?: string[]; description?: string };
    };
    const lintTarget = project.targets['lint'] as {
      command?: string;
      executor?: string;
      cache?: boolean;
      options?: { cwd?: string; command?: string };
      metadata?: { technologies?: string[]; description?: string };
    };

    expect(project.root).toBe(projectRoot);
    expect(buildTarget).toEqual(
      expect.objectContaining({
        executor: 'nx:run-commands',
        cache: true,
        outputs: ['{workspaceRoot}/dist/{projectRoot}'],
        options: expect.objectContaining({
          command: 'nest build',
          cwd: projectRoot,
        }),
        metadata: expect.objectContaining({
          technologies: expect.arrayContaining(['nest']),
          description: 'Build Nest project',
        }),
      })
    );
    expect(serveTarget).toEqual(
      expect.objectContaining({
        executor: 'nx:run-commands',
        continuous: true,
        cache: false,
        options: expect.objectContaining({
          command: 'nest start',
          cwd: projectRoot,
        }),
        metadata: expect.objectContaining({
          technologies: expect.arrayContaining(['nest']),
          description: 'Start Nest application',
        }),
      })
    );
    expect(testTarget).toEqual(
      expect.objectContaining({
        executor: 'nx:run-commands',
        cache: true,
        options: expect.objectContaining({
          command: 'jest',
          cwd: projectRoot,
        }),
        metadata: expect.objectContaining({
          technologies: expect.arrayContaining(['nest', 'jest']),
          description: 'Run Nest tests',
        }),
      })
    );
    expect(lintTarget).toEqual(
      expect.objectContaining({
        executor: 'nx:run-commands',
        cache: true,
        options: expect.objectContaining({
          command: 'eslint .',
          cwd: projectRoot,
        }),
        metadata: expect.objectContaining({
          technologies: expect.arrayContaining(['nest', 'eslint']),
          description: 'Lint Nest project',
        }),
      })
    );
  });
});
