import * as childProcess from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import {
  NEST_CLI_BIN,
  NEST_CLI_PACKAGE,
  NEST_CLI_PACKAGE_NAME,
} from '../utils/nest-version.js';

const require = createRequire(import.meta.url);

const SUPPORTED_COMMANDS = new Set<NestCliCommand>(['generate', 'new']);
const DRY_RUN_FLAG = '--dry-run';
const SKIP_GIT_FLAG = '--skip-git';
const SKIP_INSTALL_FLAG = '--skip-install';
const SHELL_METACHARACTER_PATTERN = /[|&;<>`]/;
const CONTROL_CHARACTER_PATTERN = /[\0\r\n]/;

interface NestCliPackageJson {
  bin?: Record<string, string> | string;
}

export type NestCliCommand = 'generate' | 'new';

export interface RunNestCliOptions {
  command: NestCliCommand;
  args: readonly string[];
  cwd: string;
  dryRun?: boolean;
  allowInstall?: boolean;
  allowGit?: boolean;
}

export interface NestCliCommandPlan {
  command: string;
  args: readonly string[];
  cwd: string;
  dryRun: boolean;
  executed: boolean;
}

export async function runNestCliFallback(
  options: RunNestCliOptions
): Promise<NestCliCommandPlan> {
  const command = normalizeCommand(options.command);
  const cwd = normalizeCwd(options.cwd);
  const args = buildCommandArgs(
    command,
    options.args,
    options.dryRun === true,
    options.allowInstall === true,
    options.allowGit === true
  );

  const plan: NestCliCommandPlan = {
    command: process.execPath,
    args: [resolveNestCliBinaryPath(), command, ...args],
    cwd,
    dryRun: options.dryRun === true,
    executed: false,
  };

  if (plan.dryRun) {
    return plan;
  }

  await executeCommandPlan(plan);

  return {
    ...plan,
    executed: true,
  };
}

function normalizeCommand(command: string): NestCliCommand {
  if (!SUPPORTED_COMMANDS.has(command as NestCliCommand)) {
    throw new Error(
      `Unsupported Nest CLI fallback command "${command}". Supported commands: generate, new.`
    );
  }

  return command as NestCliCommand;
}

function normalizeCwd(cwd: string): string {
  if (cwd.trim().length === 0) {
    throw new Error('Nest CLI fallback requires a non-empty "cwd".');
  }

  return cwd;
}

function buildCommandArgs(
  command: NestCliCommand,
  inputArgs: readonly string[],
  dryRun: boolean,
  allowInstall: boolean,
  allowGit: boolean
): string[] {
  const args = inputArgs.map((arg) => sanitizeArg(arg));

  if (dryRun && !args.includes(DRY_RUN_FLAG)) {
    args.push(DRY_RUN_FLAG);
  }

  if (command !== 'new') {
    return args;
  }

  if (!allowInstall && !args.includes(SKIP_INSTALL_FLAG)) {
    args.push(SKIP_INSTALL_FLAG);
  }

  if (!allowGit && !args.includes(SKIP_GIT_FLAG)) {
    args.push(SKIP_GIT_FLAG);
  }

  return args;
}

function sanitizeArg(arg: string): string {
  if (typeof arg !== 'string' || arg.length === 0) {
    throw new Error(
      'Nest CLI fallback arguments must be non-empty argv entries.'
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(arg)) {
    throw new Error(
      `Unsafe Nest CLI fallback argument "${arg}" contains control characters.`
    );
  }

  if (SHELL_METACHARACTER_PATTERN.test(arg)) {
    throw new Error(
      `Unsafe Nest CLI fallback argument "${arg}" contains shell metacharacters.`
    );
  }

  if (looksLikeJoinedArgv(arg)) {
    throw new Error(
      `Unsafe Nest CLI fallback argument "${arg}". Pass CLI tokens as separate argv entries instead of one joined shell string.`
    );
  }

  return arg;
}

function looksLikeJoinedArgv(arg: string): boolean {
  const tokens = arg.trim().split(/\s+/);

  return (
    tokens.length > 1 &&
    (tokens[0] === 'new' ||
      tokens[0] === 'generate' ||
      tokens.some((token) => token.startsWith('-')))
  );
}

function resolveNestCliBinaryPath(): string {
  const packageJsonPath = require.resolve(
    `${NEST_CLI_PACKAGE_NAME}/package.json`
  );
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8')
  ) as NestCliPackageJson;
  const binField = packageJson.bin;
  const binPath =
    typeof binField === 'string' ? binField : binField?.[NEST_CLI_BIN];

  if (!binPath) {
    throw new Error(
      `Resolved ${NEST_CLI_PACKAGE}, but its package metadata does not define the "${NEST_CLI_BIN}" executable.`
    );
  }

  return resolve(dirname(packageJsonPath), binPath);
}

async function executeCommandPlan(plan: NestCliCommandPlan): Promise<void> {
  await new Promise<void>((resolveExecution, rejectExecution) => {
    const child = childProcess.spawn(plan.command, [...plan.args], {
      cwd: plan.cwd,
      shell: false,
      stdio: 'ignore',
    });

    child.once('error', (error) => {
      rejectExecution(
        new Error(`Nest CLI fallback execution failed: ${error.message}`)
      );
    });

    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveExecution();
        return;
      }

      const signalSuffix =
        signal === null ? '' : ` (terminated by signal ${signal})`;

      rejectExecution(
        new Error(
          `Nest CLI fallback exited with code ${
            code ?? 'unknown'
          }${signalSuffix}.`
        )
      );
    });
  });
}
