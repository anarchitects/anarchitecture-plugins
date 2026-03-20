import { addProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import migrationApiGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

describe('migration-api generator', () => {
  let tree: Tree;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fails for application projects', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    });

    await expect(
      migrationApiGenerator(tree, {
        project: 'api',
        name: 'init',
        timestamp: 1700000000001,
      })
    ).rejects.toThrow('only supports library projects');
  });

  it('generates migration + manifest with TypeORM API operations', async () => {
    setupLibrary(tree);
    writeUserEntity(tree, 'email');

    await migrationApiGenerator(tree, {
      project: 'data-access',
      name: 'init users',
      timestamp: 1700000000001,
    });

    const migrationPath =
      'libs/data-access/src/infrastructure-persistence/migrations/1700000000001_init-users.ts';
    expect(tree.exists(migrationPath)).toBe(true);

    const migrationSource = tree.read(migrationPath, 'utf-8');
    expect(migrationSource).toContain('new Table(');
    expect(migrationSource).toContain('queryRunner.createTable');
    expect(migrationSource).not.toContain('queryRunner.query(');

    const manifestPath =
      'libs/data-access/src/infrastructure-persistence/migrations/.nx-typeorm-migration-manifest.json';
    expect(tree.exists(manifestPath)).toBe(true);

    const manifest = readJson(tree, manifestPath) as {
      schemaVersion: number;
      migrations: Array<{ file: string }>;
      snapshot: { entities: unknown[]; hash: string };
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.migrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: '1700000000001_init-users.ts',
        }),
      ])
    );
    expect(manifest.snapshot.entities.length).toBe(1);
    expect(typeof manifest.snapshot.hash).toBe('string');
  });

  it('is idempotent when entity model did not change', async () => {
    setupLibrary(tree);
    writeUserEntity(tree, 'email');

    await migrationApiGenerator(tree, {
      project: 'data-access',
      name: 'init users',
      timestamp: 1700000000001,
    });

    await migrationApiGenerator(tree, {
      project: 'data-access',
      name: 'no-op run',
      timestamp: 1700000000002,
    });

    const migrationFiles = listMigrationFiles(
      tree,
      'libs/data-access/src/infrastructure-persistence/migrations'
    );

    expect(migrationFiles).toEqual([
      '1700000000000_init_schema.ts',
      '1700000000001_init-users.ts',
    ]);
  });

  it('creates a delta migration when entities change', async () => {
    setupLibrary(tree);
    writeUserEntity(tree, 'email');

    await migrationApiGenerator(tree, {
      project: 'data-access',
      name: 'init users',
      timestamp: 1700000000001,
    });

    writeUserEntity(tree, 'phone');

    await migrationApiGenerator(tree, {
      project: 'data-access',
      name: 'add phone',
      timestamp: 1700000000002,
    });

    const deltaPath =
      'libs/data-access/src/infrastructure-persistence/migrations/1700000000002_add-phone.ts';
    expect(tree.exists(deltaPath)).toBe(true);

    const source = tree.read(deltaPath, 'utf-8');
    expect(source).toContain('queryRunner.addColumns');
  });

  it('fails on mixed migration sets unless allowMixedMigrations is enabled', async () => {
    setupLibrary(tree);
    writeUserEntity(tree, 'email');
    tree.write(
      'libs/data-access/src/infrastructure-persistence/migrations/1800000000000_manual.ts',
      'export {};' + '\n'
    );

    await expect(
      migrationApiGenerator(tree, {
        project: 'data-access',
        name: 'init users',
        timestamp: 1700000000001,
      })
    ).rejects.toThrow('allowMixedMigrations');

    await expect(
      migrationApiGenerator(tree, {
        project: 'data-access',
        name: 'init users',
        allowMixedMigrations: true,
        timestamp: 1700000000001,
      })
    ).resolves.toBeUndefined();
  });

  it('fails patch-init mode when delta migrations already exist in manifest', async () => {
    setupLibrary(tree);
    writeUserEntity(tree, 'email');

    tree.write(
      'libs/data-access/src/infrastructure-persistence/migrations/.nx-typeorm-migration-manifest.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedBy: '@anarchitects/nx-typeorm:migration-api',
          snapshot: { entities: [], hash: 'x' },
          migrations: [
            {
              file: '1700000000001_init-users.ts',
              className: 'InitUsers1700000000001',
              timestamp: 1700000000001,
              hash: 'x',
              mode: 'new',
            },
          ],
        },
        null,
        2
      )}\n`
    );

    await expect(
      migrationApiGenerator(tree, {
        project: 'data-access',
        fileMode: 'patch-init',
      })
    ).rejects.toThrow('only before generating any delta migration files');
  });

  it('fails when @Entity does not declare explicit table name', async () => {
    setupLibrary(tree);
    tree.write(
      'libs/data-access/src/infrastructure-persistence/entities/user.entity.ts',
      `import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
}
`
    );

    await expect(
      migrationApiGenerator(tree, {
        project: 'data-access',
        name: 'init users',
        timestamp: 1700000000001,
      })
    ).rejects.toThrow('explicit table name');
  });
});

function setupLibrary(tree: Tree) {
  addProjectConfiguration(tree, 'data-access', {
    root: 'libs/data-access',
    sourceRoot: 'libs/data-access/src',
    projectType: 'library',
    targets: {},
    metadata: {
      typeorm: {
        schema: 'catalog',
        migrationsDir: 'src/infrastructure-persistence/migrations',
      },
    },
  });

  tree.write(
    'libs/data-access/src/infrastructure-persistence/migrations/1700000000000_init_schema.ts',
    `import { MigrationInterface, QueryRunner, Table, TableCheck, TableColumn, TableExclusion, TableForeignKey, TableIndex, TableUnique } from 'typeorm';
import { Catalog_SCHEMA as SCHEMA } from '../schema';

export class InitCatalogSchema1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema(SCHEMA, true);
    // nx-typeorm:migration-api:up:start
    // nx-typeorm:migration-api:up:end
  }

  async down(): Promise<void> {
    // nx-typeorm:migration-api:down:start
    // nx-typeorm:migration-api:down:end
    // Schema intentionally kept
  }
}
`
  );

  tree.write(
    'libs/data-access/src/infrastructure-persistence/schema.ts',
    "export const Catalog_SCHEMA = 'catalog';\n"
  );
}

function writeUserEntity(tree: Tree, extraColumnName: string) {
  tree.write(
    'libs/data-access/src/infrastructure-persistence/entities/user.entity.ts',
    `import { Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'users', schema: 'catalog' })
@Index('IDX_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: '255' })
  email!: string;

  @Column({ type: 'varchar', length: '255', nullable: true })
  ${extraColumnName}?: string;
}
`
  );
}

function listMigrationFiles(tree: Tree, migrationsDirectory: string): string[] {
  const files: string[] = [];

  if (!tree.exists(migrationsDirectory)) {
    return files;
  }

  const stack = [migrationsDirectory];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const child of tree.children(current)) {
      const path = `${current}/${child}`.replace(/\\/g, '/');
      if (tree.isFile(path) && path.endsWith('.ts')) {
        files.push(path.split('/').pop() ?? path);
      } else if (!tree.isFile(path)) {
        stack.push(path);
      }
    }
  }

  return files.sort();
}

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
