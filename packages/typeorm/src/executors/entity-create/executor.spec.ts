import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import createEntity from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('entity-create executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);
    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-entity-create-'));
    context = {
      root: tempDir,
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
      .mockReturnValue({ exec: 'pnpm exec' } as ReturnType<
        typeof devkit.getPackageManagerCommand
      >);
  });

  afterEach(() => {
    getPmSpy.mockRestore();
    jest.clearAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('invokes entity:create with project-root scoped path', async () => {
    await createEntity(
      {
        path: 'src/entities/User',
      },
      context
    );

    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm',
      'entity:create',
      'apps/api/src/entities/User',
    ]);
  });

  it('throws when path is missing', async () => {
    await expect(
      createEntity(
        {
          path: '   ',
        },
        context
      )
    ).rejects.toThrow('Provide an entity path');
  });
});
