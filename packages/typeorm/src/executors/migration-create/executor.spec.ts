import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import createMigration from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('migration-create executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);

    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-migration-create-'));
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

  it('invokes typeorm migration:create with mapped options', async () => {
    const result = await createMigration(
      {
        path: 'tools/typeorm/migrations/add-users',
        outputJs: true,
        esm: true,
        timestamp: 1700000000000,
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
      'migration:create',
      'tools/typeorm/migrations/add-users',
      '--outputJs',
      '--esm',
      '--timestamp',
      '1700000000000',
      '--foo',
    ]);
  });

  it('throws when path is missing', async () => {
    await expect(
      createMigration(
        {
          path: '   ',
        },
        context
      )
    ).rejects.toThrow('Provide a migration path');

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns unsuccessful result on non-zero exit code', async () => {
    spawnMock.mockResolvedValueOnce(1);

    const result = await createMigration(
      {
        path: 'tools/typeorm/migrations/add-users',
      },
      context
    );

    expect(result).toEqual({ success: false });
  });
});
