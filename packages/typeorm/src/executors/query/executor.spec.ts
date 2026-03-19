import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import runQuery from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('query executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);
    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-query-'));
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

  it('invokes query command with datasource and query text', async () => {
    mkdirSync(join(tempDir, 'apps/api/tools/typeorm'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/tools/typeorm/datasource.migrations.ts'),
      'export default {};\n'
    );

    await runQuery(
      {
        query: 'SELECT 1',
      },
      context
    );

    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm-ts-node-commonjs',
      'query',
      'SELECT 1',
      '-d',
      'apps/api/tools/typeorm/datasource.migrations.ts',
    ]);
  });

  it('honors explicit datasource override', async () => {
    await runQuery(
      {
        query: 'SELECT 1',
        dataSource: 'src/custom.datasource.ts',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toContain('apps/api/src/custom.datasource.ts');
  });

  it('throws when query is missing', async () => {
    await expect(
      runQuery(
        {
          query: '   ',
        },
        context
      )
    ).rejects.toThrow('Provide a SQL query');

    expect(spawnMock).not.toHaveBeenCalled();
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
