import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import revertMigrations from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('revert executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);
    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-revert-'));
    ensureRunnerPackage(tempDir, 'typeorm-ts-node-commonjs');
    ensureRunnerPackage(tempDir, 'typeorm-ts-node-esm');

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

    const pmCommands = {
      exec: 'pnpm exec',
    } as ReturnType<typeof devkit.getPackageManagerCommand>;

    getPmSpy = jest
      .spyOn(devkit, 'getPackageManagerCommand')
      .mockReturnValue(pmCommands);
  });

  afterEach(() => {
    getPmSpy.mockRestore();
    jest.clearAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
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
    expect(spawnMock).toHaveBeenCalledTimes(2);

    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm-ts-node-commonjs',
      'migration:revert',
      '-d',
      'apps/api/tools/typeorm/datasource.ts',
      '--log',
    ]);
    expect(options).toMatchObject({ cwd: tempDir });
  });

  it('omits count flag when not provided', async () => {
    await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toEqual([
      'exec',
      'typeorm-ts-node-commonjs',
      'migration:revert',
      '-d',
      'apps/api/tools/typeorm/datasource.ts',
    ]);
  });

  it('stops when one revert invocation fails', async () => {
    spawnMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const result = await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
        count: 3,
      },
      context
    );

    expect(result).toEqual({ success: false });
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it('uses ESM runner for module projects', async () => {
    mkdirSync(join(tempDir, 'apps/api'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args[1]).toBe('typeorm-ts-node-esm');
  });

  it('honors explicit moduleSystem override', async () => {
    mkdirSync(join(tempDir, 'apps/api'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    await revertMigrations(
      {
        dataSource: 'tools/typeorm/datasource.ts',
        moduleSystem: 'commonjs',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args[1]).toBe('typeorm-ts-node-commonjs');
  });
});

function ensureRunnerPackage(workspaceRoot: string, packageName: string) {
  const packageDirectory = join(workspaceRoot, 'node_modules', packageName);
  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify({ name: packageName, version: '0.0.0-test' }, null, 2)}\n`
  );
}
