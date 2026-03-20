import {
  captureWorkspaceSnapshot,
  createProject,
  resetWorkspaceState,
  runNx,
  showProject,
} from './test-utils';

describe('nx-typeorm inferred targets matrix', () => {
  const sandboxProjects = [
    'packages/typeorm-e2e-temp-matrix-app',
    'packages/typeorm-e2e-temp-matrix-lib',
  ];
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

  it('infers the expected app and library target families', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const appName = 'typeorm-e2e-temp-matrix-app';
    const appRoot = 'packages/typeorm-e2e-temp-matrix-app';
    createProject(
      appRoot,
      {
        name: appName,
        root: appRoot,
        sourceRoot: `${appRoot}/src`,
        projectType: 'application',
        targets: {},
      },
      {
        'src/app.module.ts': `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`,
      }
    );

    const libraryName = 'typeorm-e2e-temp-matrix-lib';
    const libraryRoot = 'packages/typeorm-e2e-temp-matrix-lib';
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
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${appName} --skipInstall --no-interactive`
    );
    runNx(
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${libraryName} --domain=Catalog --skipInstall --no-interactive`
    );

    const appProject = showProject(appName);
    expect(appProject.targets['db:migrate:generate']).toBeDefined();
    expect(appProject.targets['db:migrate:run']).toBeDefined();
    expect(appProject.targets['db:migrate:revert']).toBeDefined();
    expect(appProject.targets['db:migrate:show']).toBeDefined();
    expect(appProject.targets['db:schema:sync']).toBeDefined();
    expect(appProject.targets['db:schema:log']).toBeDefined();
    expect(appProject.targets['db:cache:clear']).toBeDefined();
    expect(appProject.targets['db:seed']).toBeDefined();

    expect(appProject.targets['typeorm:generate']).toBeDefined();
    expect(appProject.targets['typeorm:run']).toBeDefined();
    expect(appProject.targets['typeorm:revert']).toBeDefined();
    expect(appProject.targets['typeorm:show']).toBeDefined();
    expect(appProject.targets['typeorm:schema:sync']).toBeDefined();
    expect(appProject.targets['typeorm:schema:log']).toBeDefined();
    expect(appProject.targets['typeorm:cache:clear']).toBeDefined();
    expect(appProject.targets['typeorm:seed']).toBeDefined();

    expect(appProject.targets['db:query']).toBeUndefined();
    expect(appProject.targets['db:schema:drop']).toBeUndefined();

    const libraryProject = showProject(libraryName);
    expect(libraryProject.targets['db:ensure-schema']).toBeDefined();
    expect(libraryProject.targets['typeorm:ensure-schema']).toBeDefined();
    expect(libraryProject.targets['db:migrate:generate']).toBeUndefined();
    expect(libraryProject.targets['db:seed']).toBeUndefined();
  });
});
