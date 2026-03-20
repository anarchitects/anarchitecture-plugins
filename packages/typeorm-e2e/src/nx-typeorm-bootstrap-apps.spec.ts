import {
  captureWorkspaceSnapshot,
  createProject,
  projectFileExists,
  readProjectFile,
  resetWorkspaceState,
  runNx,
  showProject,
} from './test-utils';

describe('nx-typeorm bootstrap applications', () => {
  const sandboxProjects = [
    'packages/typeorm-e2e-temp-nest-api',
    'packages/typeorm-e2e-temp-plain-api',
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

  it('bootstraps Nest and non-Nest backend applications', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const nestProjectName = 'typeorm-e2e-temp-nest-api';
    const nestProjectRoot = 'packages/typeorm-e2e-temp-nest-api';
    createProject(
      nestProjectRoot,
      {
        name: nestProjectName,
        root: nestProjectRoot,
        sourceRoot: `${nestProjectRoot}/src`,
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

    const plainProjectName = 'typeorm-e2e-temp-plain-api';
    const plainProjectRoot = 'packages/typeorm-e2e-temp-plain-api';
    createProject(
      plainProjectRoot,
      {
        name: plainProjectName,
        root: plainProjectRoot,
        sourceRoot: `${plainProjectRoot}/src`,
        projectType: 'application',
        targets: {},
      },
      {
        'src/main.ts': `export function main() {
  return 'ok';
}
`,
      }
    );

    runNx(
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${nestProjectName} --skipInstall --no-interactive`
    );
    runNx(
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${plainProjectName} --db=sqlite --skipInstall --no-interactive`
    );

    const nestModule = readProjectFile(nestProjectRoot, 'src/app.module.ts');
    expect(nestModule).toContain('TypeOrmModule.forRootAsync');
    expect(nestModule).toContain('data-source');

    expect(projectFileExists(plainProjectRoot, 'src/data-source.ts')).toBe(true);
    expect(
      projectFileExists(plainProjectRoot, 'tools/typeorm/connection-options.ts')
    ).toBe(true);
    expect(
      projectFileExists(plainProjectRoot, 'tools/typeorm/datasource.migrations.ts')
    ).toBe(true);

    const plainConnectionOptions = readProjectFile(
      plainProjectRoot,
      'tools/typeorm/connection-options.ts'
    );
    expect(plainConnectionOptions).toContain("type: 'sqlite'");
    expect(plainConnectionOptions).toContain('TYPEORM_DATABASE');

    const plainEnvExample = readProjectFile(plainProjectRoot, 'env.example');
    expect(plainEnvExample).toContain('TYPEORM_DATABASE=');
    expect(plainEnvExample).toContain('Mixed mode is rejected.');
    expect(readProjectFile(plainProjectRoot, 'src/main.ts')).toContain("return 'ok';");

    const nestProject = showProject(nestProjectName);
    expect(nestProject.targets['db:migrate:run']).toBeDefined();
    expect(nestProject.targets['typeorm:run']).toBeDefined();

    const plainProject = showProject(plainProjectName);
    expect(plainProject.targets['db:migrate:run']).toBeDefined();
    expect(plainProject.targets['db:seed']).toBeDefined();
  });
});
