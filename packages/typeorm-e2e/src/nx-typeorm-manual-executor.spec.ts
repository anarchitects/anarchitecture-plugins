import {
  captureWorkspaceSnapshot,
  createProject,
  resetWorkspaceState,
  runNx,
  showProject,
} from './test-utils';

describe('nx-typeorm manual-only executor wiring', () => {
  const sandboxProjects = ['packages/typeorm-e2e-temp-manual-executor'];
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

  it('keeps explicitly wired manual-only query targets', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const projectName = 'typeorm-e2e-temp-manual-executor';
    const projectRoot = 'packages/typeorm-e2e-temp-manual-executor';

    createProject(
      projectRoot,
      {
        name: projectName,
        root: projectRoot,
        sourceRoot: `${projectRoot}/src`,
        projectType: 'application',
        targets: {
          'typeorm:query': {
            executor: '@anarchitects/nx-typeorm:query',
            options: {
              query: 'SELECT 1',
            },
          },
        },
      },
      {
        'src/main.ts': 'export {};\n',
      }
    );

    const project = showProject(projectName);
    expect(project.targets['typeorm:query']).toEqual(
      expect.objectContaining({
        executor: '@anarchitects/nx-typeorm:query',
      })
    );
  });
});
