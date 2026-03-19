import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import initTypeormProject from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('init executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);
    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-init-'));
    context = {
      root: tempDir,
    } as unknown as ExecutorContext;

    getPmSpy = jest
      .spyOn(devkit, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'pnpm exec' } as ReturnType<
        typeof devkit.getPackageManagerCommand
      >);
  });

  afterEach(() => {
    getPmSpy.mockRestore();
    jest.clearAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('invokes typeorm init with mapped options', async () => {
    const result = await initTypeormProject(
      {
        name: 'demo',
        database: 'postgres',
        express: true,
        docker: true,
        manager: 'yarn',
        module: 'esm',
        args: ['--foo'],
      },
      context
    );

    expect(result).toEqual({ success: true });
    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm',
      'init',
      '--name',
      'demo',
      '--database',
      'postgres',
      '--express',
      '--docker',
      '--manager',
      'yarn',
      '--module',
      'esm',
      '--foo',
    ]);
  });
});
