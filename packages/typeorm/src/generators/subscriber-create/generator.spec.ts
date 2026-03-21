import { addProjectConfiguration, type Tree } from '@nx/devkit';
import subscriberCreateExecutor from '../../executors/subscriber-create/executor.js';
import subscriberCreateGenerator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];

jest.mock('../../executors/subscriber-create/executor.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('subscriber-create generator', () => {
  let tree: Tree;
  let executorMock: jest.MockedFunction<typeof subscriberCreateExecutor>;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
    executorMock = jest.mocked(subscriberCreateExecutor);
    executorMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses application subscriber defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
      targets: {},
    });

    await subscriberCreateGenerator(tree, {
      project: 'api',
      name: 'user subscriber',
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'apps/api',
        path: 'src/subscribers/UserSubscriber',
        args: undefined,
      },
      expect.objectContaining({ projectName: 'api' })
    );
  });

  it('uses library subscriber defaults when directory is omitted', async () => {
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      projectType: 'library',
      targets: {},
    });

    await subscriberCreateGenerator(tree, {
      project: 'data-access',
      name: 'audit subscriber',
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'libs/data-access',
        path: 'src/infrastructure-persistence/subscribers/AuditSubscriber',
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

    await subscriberCreateGenerator(tree, {
      project: 'api',
      name: 'order subscriber',
      directory: 'src/domain/subscribers',
      args: ['--foo'],
    });

    expect(executorMock).toHaveBeenCalledWith(
      {
        projectRoot: 'apps/api',
        path: 'src/domain/subscribers/OrderSubscriber',
        args: ['--foo'],
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
      subscriberCreateGenerator(tree, {
        project: '   ',
        name: 'valid',
      })
    ).rejects.toThrow('project');

    await expect(
      subscriberCreateGenerator(tree, {
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
      subscriberCreateGenerator(tree, {
        project: 'api',
        name: 'user subscriber',
      })
    ).rejects.toThrow('TypeORM subscriber:create failed.');
  });
});

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
