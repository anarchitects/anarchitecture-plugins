import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';

describe('nx-typeorm', () => {
  const workspaceRoot = join(__dirname, '../../..');
  const sandboxProjects = [
    'packages/typeorm-e2e-temp-nest-api',
    'packages/typeorm-e2e-temp-plain-api',
    'packages/typeorm-e2e-temp-lib',
  ];
  let originalNxJson = '';
  let originalPackageJson = '';

  beforeAll(() => {
    originalNxJson = readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8');
    originalPackageJson = readFileSync(
      join(workspaceRoot, 'package.json'),
      'utf-8'
    );
    resetWorkspaceState();
  });

  afterEach(() => {
    resetWorkspaceState();
  });

  afterAll(() => {
    resetWorkspaceState();
  });

  it('runs init generator and registers plugin metadata', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const nxJson = JSON.parse(
      readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8')
    );
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([{ plugin: '@anarchitects/nx-typeorm' }])
    );

    const packageJson = JSON.parse(
      readFileSync(join(workspaceRoot, 'package.json'), 'utf-8')
    );
    const typeormVersion =
      packageJson.dependencies?.typeorm ?? packageJson.devDependencies?.typeorm;
    const reflectMetadataVersion =
      packageJson.dependencies?.['reflect-metadata'] ??
      packageJson.devDependencies?.['reflect-metadata'];
    expect(typeormVersion).toBeDefined();
    expect(reflectMetadataVersion).toBeDefined();
  });

  it('bootstraps Nest and non-Nest backend applications', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const nestProjectName = 'typeorm-e2e-temp-nest-api';
    const nestProjectRoot = 'packages/typeorm-e2e-temp-nest-api';
    createProject(
      workspaceRoot,
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
      workspaceRoot,
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

    const nestModule = readFileSync(
      join(workspaceRoot, nestProjectRoot, 'src/app.module.ts'),
      'utf-8'
    );
    expect(nestModule).toContain('TypeOrmModule.forRootAsync');
    expect(nestModule).toContain('data-source');

    expect(
      existsSync(join(workspaceRoot, plainProjectRoot, 'src/data-source.ts'))
    ).toBe(true);
    expect(
      existsSync(
        join(
          workspaceRoot,
          plainProjectRoot,
          'tools/typeorm/connection-options.ts'
        )
      )
    ).toBe(true);
    expect(
      existsSync(
        join(
          workspaceRoot,
          plainProjectRoot,
          'tools/typeorm/datasource.migrations.ts'
        )
      )
    ).toBe(true);

    const plainConnectionOptions = readFileSync(
      join(workspaceRoot, plainProjectRoot, 'tools/typeorm/connection-options.ts'),
      'utf-8'
    );
    expect(plainConnectionOptions).toContain("type: 'sqlite'");
    expect(plainConnectionOptions).toContain('TYPEORM_DATABASE');

    const plainEnvExample = readFileSync(
      join(workspaceRoot, plainProjectRoot, 'env.example'),
      'utf-8'
    );
    expect(plainEnvExample).toContain('TYPEORM_DATABASE=');
    expect(plainEnvExample).toContain('Mixed mode is rejected.');
    expect(
      readFileSync(
        join(workspaceRoot, plainProjectRoot, 'src/main.ts'),
        'utf-8'
      )
    ).toContain("return 'ok';");

    const nestProject = showProject(workspaceRoot, nestProjectName);
    expect(nestProject.targets['db:migrate:run']).toBeDefined();
    expect(nestProject.targets['typeorm:run']).toBeDefined();

    const plainProject = showProject(workspaceRoot, plainProjectName);
    expect(plainProject.targets['db:migrate:run']).toBeDefined();
    expect(plainProject.targets['db:seed']).toBeDefined();
  });

  it('bootstraps a library with overridden persistence paths', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const libraryName = 'typeorm-e2e-temp-lib';
    const libraryRoot = 'packages/typeorm-e2e-temp-lib';
    createProject(
      workspaceRoot,
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

    const schemaPath = join(
      workspaceRoot,
      libraryRoot,
      'src/persistence/schema.ts'
    );
    expect(existsSync(schemaPath)).toBe(true);

    const migrationPath = join(
      workspaceRoot,
      libraryRoot,
      'src/persistence/migrations/1700000000000_init_schema.ts'
    );
    expect(existsSync(migrationPath)).toBe(true);

    const projectJson = JSON.parse(
      readFileSync(join(workspaceRoot, libraryRoot, 'project.json'), {
        encoding: 'utf-8',
      })
    );
    expect(projectJson.metadata?.typeorm).toEqual({
      schema: 'customer',
      domain: 'Customer',
      schemaPath: 'src/persistence/schema.ts',
      migrationsDir: 'src/persistence/migrations',
    });

    const libProject = showProject(workspaceRoot, libraryName);
    expect(libProject.targets['db:ensure-schema']).toBeDefined();
  });

  function runNx(command: string) {
    execSync(command, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
      },
    });
  }

  function resetWorkspaceState() {
    writeFileSync(join(workspaceRoot, 'nx.json'), originalNxJson);
    writeFileSync(join(workspaceRoot, 'package.json'), originalPackageJson);
    for (const projectRoot of sandboxProjects) {
      rmSync(join(workspaceRoot, projectRoot), {
        recursive: true,
        force: true,
      });
    }
  }
});

function createProject(
  workspaceRoot: string,
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

function showProject(workspaceRoot: string, projectName: string) {
  const output = execSync(`yarn nx show project ${projectName} --json`, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
    encoding: 'utf-8',
  });
  return JSON.parse(output) as {
    targets: Record<string, unknown>;
  };
}
