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

  it('scaffolds application assets and patches app.module.ts', async () => {
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
    expect(tree.exists('apps/api/src/typeorm.datasource.ts')).toBe(true);
    expect(tree.exists('apps/api/tools/typeorm/datasource.migrations.ts')).toBe(
      true
    );
    expect(tree.exists('apps/api/docker-compose.yml')).toBe(false);

    const moduleSource = tree.read('apps/api/src/app.module.ts', 'utf-8');
    expect(moduleSource).toBeDefined();
    expect(moduleSource).toContain(
      'import { TypeOrmModule } from "@nestjs/typeorm"'
    );
    expect(moduleSource).toContain('TypeOrmModule.forRootAsync');
    expect(moduleSource).toContain('makeRuntimeDataSource');

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['typeorm']).toBe('^0.3.20');
    expect(packageJson.dependencies['pg']).toBe('^8.11.0');
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
