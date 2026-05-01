import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { NEST_CLI_BIN, NEST_CLI_PACKAGE_NAME } from '../utils/nest-version.js';
import { runNestCliFallback } from './nest-cli-runner.js';

describe('nest CLI runner', () => {
  const packagePathSegment = `/${NEST_CLI_PACKAGE_NAME}/`;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('constructs a safe command plan for a supported command', async () => {
    const spawnSpy = mockSpawnSuccess();

    const plan = await runNestCliFallback({
      command: 'generate',
      args: ['service', 'users', 'apps/api/src/users'],
      cwd: '/tmp/workspace',
    });

    expect(plan.executed).toBe(true);
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual([
      expect.stringContaining(packagePathSegment),
      'generate',
      'service',
      'users',
      'apps/api/src/users',
    ]);
    expect(basename(plan.args[0])).toBe(`${NEST_CLI_BIN}.js`);
    expect(spawnSpy).toHaveBeenCalledWith(
      process.execPath,
      [...plan.args],
      expect.objectContaining({
        cwd: '/tmp/workspace',
        shell: false,
      })
    );
  });

  it('does not execute any process in dry-run mode', async () => {
    const spawnSpy = jest.spyOn(childProcess, 'spawn');

    const plan = await runNestCliFallback({
      command: 'new',
      args: ['api'],
      cwd: '/tmp/workspace',
      dryRun: true,
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.executed).toBe(false);
    expect(plan.args).toContain('--dry-run');
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('disables install and git side effects by default for new', async () => {
    mockSpawnSuccess();

    const plan = await runNestCliFallback({
      command: 'new',
      args: ['api'],
      cwd: '/tmp/workspace',
    });

    expect(plan.args).toContain('--skip-install');
    expect(plan.args).toContain('--skip-git');
  });

  it('allows side-effect prevention to be relaxed explicitly', async () => {
    mockSpawnSuccess();

    const plan = await runNestCliFallback({
      command: 'new',
      args: ['api'],
      cwd: '/tmp/workspace',
      allowInstall: true,
      allowGit: true,
    });

    expect(plan.args).not.toContain('--skip-install');
    expect(plan.args).not.toContain('--skip-git');
  });

  it('requires an explicit cwd', async () => {
    await expect(
      runNestCliFallback({
        command: 'generate',
        args: ['service', 'users'],
        cwd: '   ',
      })
    ).rejects.toThrow(/requires a non-empty "cwd"/i);
  });

  it('throws a clear error for unsupported commands', async () => {
    await expect(
      runNestCliFallback({
        command: 'invalid-command' as never,
        args: [],
        cwd: '/tmp/workspace',
      })
    ).rejects.toThrow(/unsupported Nest CLI fallback command/i);
  });

  it('rejects joined shell-style argument strings and uses argv arrays', async () => {
    await expect(
      runNestCliFallback({
        command: 'new',
        args: ['api --skip-git'],
        cwd: '/tmp/workspace',
        dryRun: true,
      })
    ).rejects.toThrow(/separate argv entries/i);
  });

  it('uses centralized Nest CLI package and bin identifiers', () => {
    const source = readFileSync(
      new URL('./nest-cli-runner.ts', import.meta.url),
      'utf-8'
    );

    expect(source).toContain('NEST_CLI_PACKAGE_NAME');
    expect(source).toContain('NEST_CLI_PACKAGE');
    expect(source).toContain('NEST_CLI_BIN');
    expect(source).toContain('../utils/nest-version.js');
    expect(source).not.toContain(`'${NEST_CLI_PACKAGE_NAME}'`);
    expect(source).not.toContain(`'${NEST_CLI_BIN}'`);
  });

  it('does not execute schematics or mutate an Nx Tree', () => {
    const source = readFileSync(
      new URL('./nest-cli-runner.ts', import.meta.url),
      'utf-8'
    );

    expect(source).not.toContain('runNestSchematic');
    expect(source).not.toContain('@nx/devkit');
    expect(source).not.toContain('tree.write');
    expect(source).not.toContain('tree.delete');
  });
});

function mockSpawnSuccess(): jest.SpiedFunction<typeof childProcess.spawn> {
  return jest
    .spyOn(childProcess, 'spawn')
    .mockImplementation(() => createSuccessfulChildProcess());
}

function createSuccessfulChildProcess(): childProcess.ChildProcess {
  const child = new EventEmitter() as childProcess.ChildProcess;

  setImmediate(() => {
    child.emit('exit', 0, null);
  });

  return child;
}
