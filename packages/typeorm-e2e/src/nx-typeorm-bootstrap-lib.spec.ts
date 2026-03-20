import {
  captureWorkspaceSnapshot,
  createProject,
  projectFileExists,
  readProjectFile,
  resetWorkspaceState,
  runNx,
  showProject,
} from './test-utils';

describe('nx-typeorm bootstrap library', () => {
  const sandboxProjects = ['packages/typeorm-e2e-temp-lib'];
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

  it('bootstraps a library with overridden persistence paths', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const libraryName = 'typeorm-e2e-temp-lib';
    const libraryRoot = 'packages/typeorm-e2e-temp-lib';
    createProject(
      libraryRoot,
      {
        name: libraryName,
        root: libraryRoot,
        sourceRoot: `${libraryRoot}/src`,
        projectType: 'library',
        targets: {},
      },
      {
        'src/index.ts': 'export {};\n',
      }
    );

    runNx(
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${libraryName} --domain=Customer --schemaPath=src/persistence/schema.ts --migrationsDir=src/persistence/migrations --skipInstall --no-interactive`
    );

    expect(projectFileExists(libraryRoot, 'src/persistence/schema.ts')).toBe(true);
    expect(
      projectFileExists(
        libraryRoot,
        'src/persistence/migrations/1700000000000_init_schema.ts'
      )
    ).toBe(true);

    const projectJson = JSON.parse(readProjectFile(libraryRoot, 'project.json'));
    expect(projectJson.metadata?.typeorm).toEqual({
      schema: 'customer',
      domain: 'Customer',
      schemaPath: 'src/persistence/schema.ts',
      migrationsDir: 'src/persistence/migrations',
    });

    const libProject = showProject(libraryName);
    expect(libProject.targets['db:ensure-schema']).toBeDefined();
  });
});
