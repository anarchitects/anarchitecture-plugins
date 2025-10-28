import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import ensureSchema from './executor.js';

describe('ensure-schema executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let projectRoot: string;
  let dataSourcePath: string;
  let mocks: EnsureSchemaMocks;

  beforeEach(() => {
    tempDir = mkdtempSync(join(process.cwd(), 'nx-typeorm-ensure-'));
    projectRoot = join(tempDir, 'libs/data');
    dataSourcePath = join(projectRoot, 'tools/typeorm/datasource.migrations.js');

    mocks = createMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__ensureSchemaMocks = mocks;

    mkdirSync(join(projectRoot, 'tools/typeorm'), { recursive: true });
    writeFileSync(
      dataSourcePath,
      `const mocks = globalThis.__ensureSchemaMocks;
module.exports = {
  default: {
    initialize: (...args) => mocks.initialize(...args),
    destroy: (...args) => mocks.destroy(...args),
    createQueryRunner: (...args) => mocks.createQueryRunner(...args),
  },
};
`
    );

    context = {
      root: tempDir,
      projectName: 'data',
      projectsConfigurations: {
        version: 2,
        projects: {
          data: {
            root: 'libs/data',
            projectType: 'library',
          },
        },
      },
    } as unknown as ExecutorContext;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__ensureSchemaMocks;
    jest.resetModules();
  });

  it('creates schema using provided name', async () => {
    const result = await ensureSchema(
      {
        projectRoot: 'libs/data',
        schema: 'catalog',
      },
      context
    );

    expect(result).toEqual({ success: true });
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.createSchema).toHaveBeenCalledWith('catalog', true);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
  });

  it('infers schema name from schema file when option absent', async () => {
    const schemaDir = join(projectRoot, 'src/infrastructure-persistence');
    mkdirSync(schemaDir, { recursive: true });
    const schemaPath = join(schemaDir, 'schema.ts');
    writeFileSync(schemaPath, "export const DATA_SCHEMA = 'inventory';\n");

    const result = await ensureSchema(
      {
        projectRoot: 'libs/data',
      },
      context
    );

    expect(result).toEqual({ success: true });
    expect(mocks.createSchema).toHaveBeenCalledWith('inventory', true);
  });

  it('throws when schema cannot be determined', async () => {
    await expect(
      ensureSchema(
        {
          projectRoot: 'libs/data',
        },
        context
      )
    ).rejects.toThrow(
      'Unable to infer schema name. Provide the schema option.'
    );
  });

  it('skips creation when driver lacks createSchema', async () => {
    mocks.createQueryRunner.mockReturnValueOnce({
      release: mocks.release,
    } as unknown as { createSchema(): Promise<void>; release(): Promise<void> });

    const result = await ensureSchema(
      {
        projectRoot: 'libs/data',
        schema: 'catalog',
      },
      context
    );

    expect(result).toEqual({ success: true });
    expect(mocks.createSchema).not.toHaveBeenCalled();
  });

  it('throws when data source is missing', async () => {
    rmSync(dataSourcePath, { force: true });

    await expect(
      ensureSchema(
        {
          projectRoot: 'libs/data',
          schema: 'catalog',
        },
        context
      )
    ).rejects.toThrow('TypeORM DataSource not found');
  });
});

type EnsureSchemaMocks = {
  initialize: jest.Mock;
  destroy: jest.Mock;
  createQueryRunner: jest.Mock;
  createSchema: jest.Mock;
  release: jest.Mock;
};

function createMocks(): EnsureSchemaMocks {
  const mocks: Partial<EnsureSchemaMocks> = {};
  mocks.initialize = jest.fn().mockResolvedValue(undefined);
  mocks.destroy = jest.fn().mockResolvedValue(undefined);
  mocks.createSchema = jest.fn().mockResolvedValue(undefined);
  mocks.release = jest.fn().mockResolvedValue(undefined);
  mocks.createQueryRunner = jest.fn(() => ({
    createSchema: mocks.createSchema,
    release: mocks.release,
  }));
  return mocks as EnsureSchemaMocks;
}
