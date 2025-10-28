import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import runMigrations from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('run executor', () => {
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

  it('runs migrations with provided flags', async () => {
    const result = await runMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
        transaction: 'each',
        fake: true,
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
      'migration:run',
      '-d',
      'apps/api/tools/typeorm/datasource.ts',
      '--transaction',
      'each',
      '--fake',
      '--log',
    ]);
    expect(options).toMatchObject({ cwd: '/tmp/workspace' });
  });
});
