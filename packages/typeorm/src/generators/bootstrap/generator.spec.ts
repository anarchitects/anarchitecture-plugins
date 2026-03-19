import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import bootstrapGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

describe('bootstrapGenerator', () => {
  let tree: Tree;
  let formatSpy: jest.SpyInstance;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }
    tree = createTreeWithEmptyWorkspace();
    formatSpy = jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(async () => undefined);
  });

  afterEach(() => {
    formatSpy.mockRestore();
  });

  it('scaffolds application assets and patches Nest app.module.ts', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });

    tree.write(
      'apps/api/src/app.module.ts',
      `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`
    );

    const task = await bootstrapGenerator(tree, {
      project: 'api',
      skipInstall: true,
    });

    expect(typeof task).toBe('function');
    expect(tree.exists('apps/api/src/data-source.ts')).toBe(true);
    expect(tree.exists('apps/api/src/typeorm.datasource.ts')).toBe(true);
    expect(tree.exists('apps/api/tools/typeorm/connection-options.ts')).toBe(
      true
    );
    expect(tree.exists('apps/api/tools/typeorm/datasource.migrations.ts')).toBe(
      true
    );
    expect(
      tree.read('apps/api/tools/typeorm/datasource.migrations.ts', 'utf-8')
    ).toContain('createMigrationDataSourceOptions');
    expect(tree.exists('apps/api/docker-compose.yml')).toBe(false);

    const moduleSource = tree.read('apps/api/src/app.module.ts', 'utf-8');
    expect(moduleSource).toBeDefined();
    expect(moduleSource).toContain(
      'import { TypeOrmModule } from "@nestjs/typeorm"'
    );
    expect(moduleSource).toContain('from "./data-source"');
    expect(moduleSource).toContain('TypeOrmModule.forRootAsync');
    expect(moduleSource).toContain('makeRuntimeDataSource');

    const runtimeDataSourceSource = tree.read('apps/api/src/data-source.ts', 'utf-8');
    expect(runtimeDataSourceSource).toContain(
      "from '../tools/typeorm/connection-options'"
    );
    expect(runtimeDataSourceSource).toContain('createRuntimeDataSourceOptions');

    const migrationDataSourceSource = tree.read(
      'apps/api/tools/typeorm/datasource.migrations.ts',
      'utf-8'
    );
    expect(migrationDataSourceSource).toContain("from './connection-options'");
    expect(migrationDataSourceSource).toContain(
      'createMigrationDataSourceOptions'
    );

    const connectionOptionsSource = tree.read(
      'apps/api/tools/typeorm/connection-options.ts',
      'utf-8'
    );
    expect(connectionOptionsSource).toContain(
      "migrations: ['dist/tools/typeorm/migrations/*.js']"
    );

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['typeorm']).toBe('^0.3.28');
    expect(packageJson.dependencies['reflect-metadata']).toBe('^0.2.2');
    expect(packageJson.dependencies['pg']).toBe('^8.20.0');
    expect(packageJson.dependencies['@nestjs/typeorm']).toBe('^11.0.0');
    expect(packageJson.devDependencies['typeorm-ts-node-commonjs']).toBe(
      '^0.3.20'
    );
    expect(packageJson.devDependencies['typeorm-ts-node-esm']).toBe('^0.3.20');
  });

  it('does not patch non-Nest applications', async () => {
    addProjectConfiguration(tree, 'worker', {
      root: 'apps/worker',
      sourceRoot: 'apps/worker/src',
      projectType: 'application',
      targets: {},
    });

    tree.write(
      'apps/worker/src/main.ts',
      `export async function bootstrap() {
  return 'ok';
}
`
    );

    await bootstrapGenerator(tree, {
      project: 'worker',
      skipInstall: true,
    });

    expect(tree.exists('apps/worker/src/data-source.ts')).toBe(true);
    expect(tree.exists('apps/worker/src/typeorm.datasource.ts')).toBe(true);
    expect(tree.exists('apps/worker/tools/typeorm/connection-options.ts')).toBe(
      true
    );
    expect(
      tree.exists('apps/worker/tools/typeorm/datasource.migrations.ts')
    ).toBe(true);
    expect(tree.read('apps/worker/src/main.ts', 'utf-8')).toContain(
      'bootstrap'
    );

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nestjs/typeorm']).toBeUndefined();
  });

  it('retains docker-compose when requested', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });

    tree.write(
      'apps/api/src/app.module.ts',
      `import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
`
    );

    await bootstrapGenerator(tree, {
      project: 'api',
      withCompose: true,
      skipInstall: true,
    });

    expect(tree.exists('apps/api/docker-compose.yml')).toBe(true);
  });

  it('preserves existing migration datasource for applications', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });

    tree.write(
      'apps/api/tools/typeorm/datasource.migrations.ts',
      "export default 'custom';\n"
    );

    await bootstrapGenerator(tree, {
      project: 'api',
      skipInstall: true,
    });
    await bootstrapGenerator(tree, {
      project: 'api',
      skipInstall: true,
    });

    expect(
      tree.read('apps/api/tools/typeorm/datasource.migrations.ts', 'utf-8')
    ).toBe("export default 'custom';\n");
  });

  it.each([
    {
      db: 'postgres',
      expectedType: "type: 'postgres'",
      helperSnippet: 'connectTimeoutMS',
      envSnippet: 'TYPEORM_CONNECT_TIMEOUT_MS=5000',
    },
    {
      db: 'postgresql',
      expectedType: "type: 'postgres'",
      helperSnippet: 'applicationName',
      envSnippet: 'TYPEORM_SCHEMA=public',
    },
    {
      db: 'mysql',
      expectedType: "type: 'mysql'",
      helperSnippet: 'socketPath',
      envSnippet: 'TYPEORM_SOCKET_PATH=',
    },
    {
      db: 'mariadb',
      expectedType: "type: 'mariadb'",
      helperSnippet: 'charset',
      envSnippet: 'TYPEORM_CHARSET=utf8mb4',
    },
    {
      db: 'sqlite',
      expectedType: "type: 'sqlite'",
      helperSnippet: 'busyTimeout',
      envSnippet: 'TYPEORM_BUSY_TIMEOUT=5000',
    },
    {
      db: 'better-sqlite3',
      expectedType: "type: 'better-sqlite3'",
      helperSnippet: 'statementCacheSize',
      envSnippet: 'TYPEORM_STATEMENT_CACHE_SIZE=100',
    },
    {
      db: 'mssql',
      expectedType: "type: 'mssql'",
      helperSnippet: 'trustServerCertificate',
      envSnippet: 'TYPEORM_TRUST_SERVER_CERTIFICATE=true',
    },
  ])(
    'generates database-specific connection templates for %s',
    async ({ db, expectedType, helperSnippet, envSnippet }) => {
      addProjectConfiguration(tree, 'api', {
        root: 'apps/api',
        sourceRoot: 'apps/api/src',
        projectType: 'application',
        targets: {},
      });

      await bootstrapGenerator(tree, {
        project: 'api',
        db,
        skipInstall: true,
      });

      const helperSource = tree.read(
        'apps/api/tools/typeorm/connection-options.ts',
        'utf-8'
      );
      expect(helperSource).toContain(expectedType);
      expect(helperSource).toContain(helperSnippet);

      const envSource = tree.read('apps/api/env.example', 'utf-8');
      expect(envSource).toContain(envSnippet);
      expect(envSource).toContain('DATABASE_URL=');
      expect(envSource).toContain('Mixed mode is rejected.');
    }
  );

  it('throws for unsupported db option', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });

    await expect(
      bootstrapGenerator(tree, {
        project: 'api',
        db: 'oracle' as unknown as 'postgres',
        skipInstall: true,
      })
    ).rejects.toThrow(
      'Unsupported database "oracle". Supported values: postgres, mysql, mariadb, sqlite, better-sqlite3, mssql, postgresql.'
    );
  });

  it('scaffolds library assets and metadata when domain provided', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      sourceRoot: 'libs/data-access/src',
      projectType: 'library',
      targets: {},
    });

    await bootstrapGenerator(tree, {
      project: 'data-access',
      domain: 'Catalog',
      schema: 'catalog',
      skipInstall: true,
    });

    expect(
      tree.exists('libs/data-access/src/infrastructure-persistence/schema.ts')
    ).toBe(true);
    expect(
      tree.exists(
        'libs/data-access/src/infrastructure-persistence/migrations/1700000000000_init_schema.ts'
      )
    ).toBe(true);

    const projectConfig = readProjectConfiguration(tree, 'data-access');
    expect(projectConfig.metadata?.typeorm).toEqual({
      schema: 'catalog',
      domain: 'Catalog',
      schemaPath: 'src/infrastructure-persistence/schema.ts',
      migrationsDir: 'src/infrastructure-persistence/migrations',
    });
  });

  it('supports overriding library schema and migrations paths', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      sourceRoot: 'libs/data-access/src',
      projectType: 'library',
      targets: {},
    });

    await bootstrapGenerator(tree, {
      project: 'data-access',
      domain: 'Billing',
      schemaPath: 'src/persistence/schema.ts',
      migrationsDir: 'src/persistence/migrations',
      skipInstall: true,
    });

    const schemaPath = 'libs/data-access/src/persistence/schema.ts';
    const migrationPath =
      'libs/data-access/src/persistence/migrations/1700000000000_init_schema.ts';
    expect(tree.exists(schemaPath)).toBe(true);
    expect(tree.exists(migrationPath)).toBe(true);

    const migrationSource = tree.read(migrationPath, 'utf-8');
    expect(migrationSource).toContain("from '../schema';");

    const projectConfig = readProjectConfiguration(tree, 'data-access');
    expect(projectConfig.metadata?.typeorm).toEqual({
      schema: 'billing',
      domain: 'Billing',
      schemaPath: 'src/persistence/schema.ts',
      migrationsDir: 'src/persistence/migrations',
    });
  });

  it('throws when library domain is omitted', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      sourceRoot: 'libs/data-access/src',
      projectType: 'library',
      targets: {},
    });

    await expect(
      bootstrapGenerator(tree, {
        project: 'data-access',
        skipInstall: true,
      })
    ).rejects.toThrow('Domain option is required when targeting a library.');
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
