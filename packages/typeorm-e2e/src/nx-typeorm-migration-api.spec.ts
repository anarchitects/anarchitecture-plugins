import {
  captureWorkspaceSnapshot,
  createProject,
  projectFileExists,
  readProjectFile,
  resetWorkspaceState,
  runNx,
  runNxExpectFailure,
  workspaceRoot,
} from './test-utils';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

describe('nx-typeorm migration-api generator', () => {
  const sandboxProjects = [
    'packages/typeorm-e2e-temp-migration-lib',
    'packages/typeorm-e2e-temp-migration-app',
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

  it('generates migration-api artifacts for a bootstrapped library', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const libraryName = 'typeorm-e2e-temp-migration-lib';
    const libraryRoot = 'packages/typeorm-e2e-temp-migration-lib';
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
      `yarn nx g @anarchitects/nx-typeorm:bootstrap --project=${libraryName} --domain=Catalog --skipInstall --no-interactive`
    );

    const entityPath = join(
      workspaceRoot,
      libraryRoot,
      'src/infrastructure-persistence/entities/user.entity.ts'
    );
    mkdirSync(dirname(entityPath), { recursive: true });
    writeFileSync(
      entityPath,
      `import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users', schema: 'catalog' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: '255' })
  email!: string;
}
`
    );

    runNx(
      `yarn nx g @anarchitects/nx-typeorm:migration-api --project=${libraryName} --name="init users" --timestamp=1700000000100 --no-interactive`
    );

    expect(
      projectFileExists(
        libraryRoot,
        'src/infrastructure-persistence/migrations/1700000000100_init-users.ts'
      )
    ).toBe(true);
    expect(
      projectFileExists(
        libraryRoot,
        'src/infrastructure-persistence/migrations/.nx-typeorm-migration-manifest.json'
      )
    ).toBe(true);

    const migrationSource = readProjectFile(
      libraryRoot,
      'src/infrastructure-persistence/migrations/1700000000100_init-users.ts'
    );
    expect(migrationSource).toContain('queryRunner.createTable');
    expect(migrationSource).not.toContain('queryRunner.query(');
  });

  it('rejects migration-api generation for application projects', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const appName = 'typeorm-e2e-temp-migration-app';
    const appRoot = 'packages/typeorm-e2e-temp-migration-app';
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
        'src/main.ts': 'export {};\n',
      }
    );

    const output = runNxExpectFailure(
      `yarn nx g @anarchitects/nx-typeorm:migration-api --project=${appName} --name="should fail" --timestamp=1700000000200 --no-interactive`
    );

    expect(output).toContain('only supports library projects');
  });
});
