import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import runMigrations from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('run executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);
    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-run-'));
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
    expect(options).toMatchObject({ cwd: tempDir });
  });

  it('defaults to tools/typeorm/datasource.migrations.ts when dataSource is omitted', async () => {
    const projectRoot = join(tempDir, 'apps/api');
    mkdirSync(join(projectRoot, 'tools/typeorm'), { recursive: true });
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'tools/typeorm/datasource.migrations.ts'),
      'export default {};\n'
    );
    writeFileSync(
      join(projectRoot, 'src/data-source.ts'),
      'export default {};\n'
    );

    await runMigrations({}, context);

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toContain('apps/api/tools/typeorm/datasource.migrations.ts');
  });

  it('honors explicit dataSource override over inferred defaults', async () => {
    const projectRoot = join(tempDir, 'apps/api');
    mkdirSync(join(projectRoot, 'tools/typeorm'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'tools/typeorm/datasource.migrations.ts'),
      'export default {};\n'
    );

    await runMigrations(
      {
        dataSource: 'src/override.datasource.ts',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toContain('apps/api/src/override.datasource.ts');
  });

  it('uses ESM runner for module projects', async () => {
    mkdirSync(join(tempDir, 'apps/api'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    await runMigrations(
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

    await runMigrations(
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
