import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CreateNodesContextV2, CreateNodesResult } from '@nx/devkit';
import { createNodesV2 } from './index.js';

describe('typeorm plugin inference', () => {
  let workspaceRoot: string;
  let context: CreateNodesContextV2;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-typeorm-plugin-'));
    context = {
      workspaceRoot,
      nxJsonConfiguration: {},
    } as CreateNodesContextV2;
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('infers targets for Nest-style applications', async () => {
    writeFile(
      'apps/api/src/app.module.ts',
      `import { Module } from '@nestjs/common';
@Module({})
export class AppModule {}
`
    );
    writeFile(
      'apps/api/tools/typeorm/datasource.migrations.ts',
      'export default {};\n'
    );
    writeFile('apps/api/src/data-source.ts', 'export const dataSource = {};\n');

    const results = await createNodes([
      'apps/api/src/app.module.ts',
      'apps/api/tools/typeorm/datasource.migrations.ts',
      'apps/api/src/data-source.ts',
    ]);
    const projects = mergeProjects(results);

    const api = projects['apps/api'];
    expect(api?.targets?.['db:migrate:generate']).toBeDefined();
    expect(api?.targets?.['db:migrate:run']).toBeDefined();
    expect(api?.targets?.['db:migrate:revert']).toBeDefined();
    expect(api?.targets?.['db:seed']).toBeDefined();
    expect(api?.targets?.['typeorm:generate']).toBeDefined();
    expect(api?.targets?.['typeorm:run']).toBeDefined();
  });

  it('supports legacy runtime datasource names', async () => {
    writeFile(
      'apps/api/tools/typeorm/datasource.migrations.ts',
      'export default {};\n'
    );
    writeFile(
      'apps/api/src/typeorm.datasource.ts',
      'export const dataSource = {};\n'
    );

    const results = await createNodes(['apps/api/src/typeorm.datasource.ts']);
    const projects = mergeProjects(results);

    const dataSource =
      projects['apps/api']?.targets?.['db:migrate:run']?.options?.dataSource;
    expect(dataSource).toBe('apps/api/tools/typeorm/datasource.migrations.ts');
  });

  it('infers schema-oriented targets for libraries', async () => {
    writeFile(
      'libs/data-access/src/infrastructure-persistence/schema.ts',
      "export const Catalog_SCHEMA = 'catalog';\n"
    );

    const results = await createNodes([
      'libs/data-access/src/infrastructure-persistence/schema.ts',
    ]);
    const projects = mergeProjects(results);

    const library = projects['libs/data-access'];
    expect(library?.targets?.['db:ensure-schema']).toBeDefined();
    expect(library?.targets?.['typeorm:ensure-schema']).toBeDefined();
    expect(library?.targets?.['db:migrate:generate']).toBeUndefined();
  });

  async function createNodes(configFiles: string[]) {
    const [, createNodesFn] = createNodesV2;
    return createNodesFn(configFiles, undefined, context);
  }

  function writeFile(path: string, contents: string) {
    const target = join(workspaceRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
});

function mergeProjects(
  results: readonly (readonly [string, CreateNodesResult])[]
) {
  const projects: Record<string, { targets?: Record<string, unknown> }> = {};
  for (const [, result] of results) {
    Object.assign(projects, result.projects ?? {});
  }
  return projects;
}
