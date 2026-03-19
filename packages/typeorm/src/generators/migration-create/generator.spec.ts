import { addProjectConfiguration, type Tree } from '@nx/devkit';
import migrationCreateExecutor from '../../executors/migration-create/executor.js';
import migrationCreateGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

jest.mock('../../executors/migration-create/executor.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('migration-create generator', () => {
  let tree: Tree;
  let executorMock: jest.MockedFunction<typeof migrationCreateExecutor>;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
    executorMock = jest.mocked(migrationCreateExecutor);
    executorMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses application migration defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await migrationCreateGenerator(tree, {
      project: 'api',
      name: 'add users',
    });

    expect(executorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'apps/api/tools/typeorm/migrations/add-users',
      }),
      expect.objectContaining({ projectName: 'api' })
    );
  });

  it('uses library migration defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      projectType: 'library',
      targets: {},
    });

    await migrationCreateGenerator(tree, {
      project: 'data-access',
      name: 'init schema',
    });

    expect(executorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'libs/data-access/src/infrastructure-persistence/migrations/init-schema',
      }),
      expect.objectContaining({ projectName: 'data-access' })
    );
  });

  it('applies directory override and forwards flags and args', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await migrationCreateGenerator(tree, {
      project: 'api',
      name: 'add users',
      directory: 'tools/db/migrations',
      outputJs: true,
      esm: true,
      timestamp: 1700000000000,
      args: ['--drift-safe'],
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        path: 'apps/api/tools/db/migrations/add-users',
        outputJs: true,
        esm: true,
        timestamp: 1700000000000,
        args: ['--drift-safe'],
      },
      expect.objectContaining({ projectName: 'api' })
    );
  });

  it('validates required project and name options', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await expect(
      migrationCreateGenerator(tree, {
        project: '   ',
        name: 'valid',
      })
    ).rejects.toThrow('project');

    await expect(
      migrationCreateGenerator(tree, {
        project: 'api',
        name: '   ',
      })
    ).rejects.toThrow('name');
  });

  it('fails when wrapped executor reports unsuccessful execution', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });
    executorMock.mockResolvedValueOnce({ success: false });

    await expect(
      migrationCreateGenerator(tree, {
        project: 'api',
        name: 'add users',
      })
    ).rejects.toThrow('TypeORM migration:create failed.');
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
