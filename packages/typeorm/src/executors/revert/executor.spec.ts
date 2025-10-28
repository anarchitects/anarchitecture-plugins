import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import revertMigrations from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('revert executor', () => {
  let context: ExecutorContext;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);

    context = {
      root: '/tmp/workspace',
      projectName: 'api',
      projectsConfigurations: {
        version: 2,
        projects: {
          api: {
            root: 'apps/api',
            projectType: 'application',
          },
        },
      },
    } as unknown as ExecutorContext;

    getPmSpy = jest
      .spyOn(devkit, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'pnpm exec' } as any);
  });

  afterEach(() => {
    getPmSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('reverts migrations with count argument', async () => {
    const result = await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
        count: 2,
        args: ['--log'],
      },
      context
    );

    expect(result).toEqual({ success: true });
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm-ts-node-commonjs',
      'migration:revert',
      '-d',
      'apps/api/tools/typeorm/datasource.ts',
      '--revert',
      '2',
      '--log',
    ]);
    expect(options).toMatchObject({ cwd: '/tmp/workspace' });
  });

  it('omits count flag when not provided', async () => {
    await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args).not.toContain('--revert');
  });
});
