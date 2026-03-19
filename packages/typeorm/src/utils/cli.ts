import { relative } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { getPackageManagerCommand } from '@nx/devkit';
import { ensureProjectRoot, resolveTypeormCliRunner } from './shared.js';
import { spawn } from './spawn.js';

type CliOptions = {
  args?: string[];
};

type DataSourceCliOptions = CliOptions & {
  projectRoot?: string;
  dataSource?: string;
  moduleSystem?: 'auto' | 'commonjs' | 'esm';
};

export interface DataSourceCommandArgs {
  beforeDataSourceArgs?: string[];
  afterDataSourceArgs?: string[];
}

function splitCommand(command: string): [string, string[]] {
  const [cmd, ...rest] = command.split(' ');
  return [cmd, rest];
}

function relativeToWorkspace(root: string, filePath: string): string {
  return relative(root, filePath) || '.';
}

function ensureArgs(options?: string[]): string[] {
  return options?.filter((arg) => arg.trim().length > 0) ?? [];
}

function packageManagerCommand(): [string, string[]] {
  const pmc = getPackageManagerCommand();
  const execCommand = pmc.exec ?? pmc.dlx ?? 'npx';
  return splitCommand(execCommand);
}

export async function runTypeormCommand(
  subcommand: string,
  options: CliOptions,
  context: ExecutorContext,
  commandArgs: string[] = []
): Promise<number> {
  const [command, baseArgs] = packageManagerCommand();
  const args = [
    ...baseArgs,
    'typeorm',
    subcommand,
    ...commandArgs,
    ...ensureArgs(options.args),
  ];

  return spawn(command, args, { cwd: context.root });
}

export async function runDataSourceTypeormCommand(
  subcommand: string,
  options: DataSourceCliOptions,
  context: ExecutorContext,
  commandArgsOrConfig: string[] | DataSourceCommandArgs = []
): Promise<number> {
  const commandArgs = Array.isArray(commandArgsOrConfig)
    ? {
        beforeDataSourceArgs: commandArgsOrConfig,
        afterDataSourceArgs: [],
      }
    : {
        beforeDataSourceArgs: commandArgsOrConfig.beforeDataSourceArgs ?? [],
        afterDataSourceArgs: commandArgsOrConfig.afterDataSourceArgs ?? [],
      };
  const paths = ensureProjectRoot(options, context);
  const runner = resolveTypeormCliRunner(
    options,
    context,
    paths.absoluteProjectRoot
  );
  const [command, baseArgs] = packageManagerCommand();
  const args = [
    ...baseArgs,
    runner,
    subcommand,
    ...commandArgs.beforeDataSourceArgs,
    '-d',
    relativeToWorkspace(context.root, paths.dataSource),
    ...commandArgs.afterDataSourceArgs,
    ...ensureArgs(options.args),
  ];

  return spawn(command, args, { cwd: context.root });
}
