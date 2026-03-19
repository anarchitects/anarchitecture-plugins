import { addProjectConfiguration, type Tree } from '@nx/devkit';
import entityCreateExecutor from '../../executors/entity-create/executor.js';
import entityCreateGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

jest.mock('../../executors/entity-create/executor.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('entity-create generator', () => {
  let tree: Tree;
  let executorMock: jest.MockedFunction<typeof entityCreateExecutor>;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
    executorMock = jest.mocked(entityCreateExecutor);
    executorMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses application entity defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await entityCreateGenerator(tree, {
      project: 'api',
      name: 'user profile',
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'apps/api',
        path: 'src/entities/user-profile',
        args: undefined,
      },
      expect.objectContaining({ projectName: 'api' })
    );
  });

  it('uses library entity defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      projectType: 'library',
      targets: {},
    });

    await entityCreateGenerator(tree, {
      project: 'data-access',
      name: 'audit log',
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'libs/data-access',
        path: 'src/infrastructure-persistence/entities/audit-log',
        args: undefined,
      },
      expect.objectContaining({ projectName: 'data-access' })
    );
  });

  it('applies directory override and forwards args', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await entityCreateGenerator(tree, {
      project: 'api',
      name: 'order item',
      directory: 'src/domain/entities',
      args: ['--bar'],
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'apps/api',
        path: 'src/domain/entities/order-item',
        args: ['--bar'],
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
      entityCreateGenerator(tree, {
        project: '',
        name: 'valid',
      })
    ).rejects.toThrow('project');

    await expect(
      entityCreateGenerator(tree, {
        project: 'api',
        name: '',
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
      entityCreateGenerator(tree, {
        project: 'api',
        name: 'user profile',
      })
    ).rejects.toThrow('TypeORM entity:create failed.');
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
