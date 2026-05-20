import { writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  GenericWorkspaceLoadError,
  GenericWorkspaceValidationError,
} from '../manual-workspace/index.js';
import {
  StandaloneGovernanceProfileLoadError,
  StandaloneGovernanceProfileValidationError,
} from '../profile/load-standalone-profile.js';

import { runAgovCheck } from './check.js';
import {
  type AgovOutputFormat,
  renderAgovCheckReport,
} from './render-report.js';

export interface AgovCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface ParsedAgovCheckOptions {
  command: 'check';
  workspacePath: string;
  profilePath: string;
  format: AgovOutputFormat;
  outputPath?: string;
}

export class AgovCliUsageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'agov.cli.unknown_command'
      | 'agov.cli.missing_workspace'
      | 'agov.cli.missing_profile'
      | 'agov.cli.missing_output'
      | 'agov.cli.unsupported_format'
      | 'agov.cli.unknown_option'
  ) {
    super(message);
    this.name = 'AgovCliUsageError';
  }
}

export class AgovCliOutputError extends Error {
  constructor(
    message: string,
    public readonly code: 'agov.cli.output_write_failed',
    public readonly filePath: string
  ) {
    super(message);
    this.name = 'AgovCliOutputError';
  }
}

export function runAgovCli(
  argv: string[],
  io: AgovCliIo = defaultIo()
): number {
  try {
    const parsed = parseAgovCliArgs(argv);
    const result = runAgovCheck({
      workspacePath: parsed.workspacePath,
      profilePath: parsed.profilePath,
    });
    const rendered = renderAgovCheckReport(result, parsed.format);

    if (parsed.outputPath) {
      writeAgovOutput(parsed.outputPath, rendered);
    } else {
      io.stdout(rendered);
    }

    return result.success ? 0 : 1;
  } catch (error) {
    if (error instanceof AgovCliUsageError) {
      io.stderr(
        renderErrorPayload({
          code: error.code,
          message: error.message,
        })
      );
      return 1;
    }

    if (error instanceof AgovCliOutputError) {
      io.stderr(
        renderErrorPayload({
          code: error.code,
          message: error.message,
          details: {
            filePath: error.filePath,
          },
        })
      );
      return 1;
    }

    if (
      error instanceof GenericWorkspaceLoadError ||
      error instanceof GenericWorkspaceValidationError ||
      error instanceof StandaloneGovernanceProfileLoadError ||
      error instanceof StandaloneGovernanceProfileValidationError
    ) {
      io.stderr(renderStructuredError(error));
      return 1;
    }

    io.stderr(
      renderErrorPayload({
        code: 'agov.cli.unhandled_error',
        message:
          error instanceof Error ? error.message : 'Unknown agov CLI error.',
      })
    );
    return 1;
  }
}

export function parseAgovCliArgs(argv: string[]): ParsedAgovCheckOptions {
  const [command, ...args] = argv;

  if (command !== 'check') {
    throw new AgovCliUsageError(
      `Unsupported agov command "${
        command ?? ''
      }". Only "check" is implemented in this MVP.`,
      'agov.cli.unknown_command'
    );
  }

  let workspacePath: string | undefined;
  let profilePath: string | undefined;
  let outputPath: string | undefined;
  let format: AgovOutputFormat = 'json';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--workspace') {
      workspacePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--profile') {
      profilePath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--format') {
      const value = args[index + 1];
      index += 1;

      if (value !== 'json' && value !== 'markdown' && value !== 'table') {
        throw new AgovCliUsageError(
          'Unsupported agov check format. Supported formats are "json", "markdown", and "table".',
          'agov.cli.unsupported_format'
        );
      }

      format = value;
      continue;
    }

    if (arg === '--output') {
      const value = args[index + 1];
      index += 1;

      if (!value) {
        throw new AgovCliUsageError(
          'Missing required agov check option value for "--output".',
          'agov.cli.missing_output'
        );
      }

      outputPath = value;
      continue;
    }

    throw new AgovCliUsageError(
      `Unknown agov option "${arg}".`,
      'agov.cli.unknown_option'
    );
  }

  if (!workspacePath) {
    throw new AgovCliUsageError(
      'Missing required agov check option "--workspace".',
      'agov.cli.missing_workspace'
    );
  }

  if (!profilePath) {
    throw new AgovCliUsageError(
      'Missing required agov check option "--profile".',
      'agov.cli.missing_profile'
    );
  }

  return {
    command: 'check',
    workspacePath,
    profilePath,
    format,
    ...(outputPath ? { outputPath } : {}),
  };
}

function renderStructuredError(
  error:
    | GenericWorkspaceLoadError
    | GenericWorkspaceValidationError
    | StandaloneGovernanceProfileLoadError
    | StandaloneGovernanceProfileValidationError
): string {
  if (
    error instanceof GenericWorkspaceValidationError ||
    error instanceof StandaloneGovernanceProfileValidationError
  ) {
    return renderErrorPayload({
      code:
        error instanceof GenericWorkspaceValidationError
          ? 'agov.cli.invalid_workspace'
          : 'agov.cli.invalid_profile',
      message: error.message,
      details: {
        filePath: error.filePath,
        issues: error.issues,
      },
    });
  }

  return renderErrorPayload({
    code:
      error instanceof GenericWorkspaceLoadError
        ? 'agov.cli.workspace_load_failed'
        : 'agov.cli.profile_load_failed',
    message: error.message,
    details: {
      filePath: error.filePath,
      loaderCode: error.code,
    },
  });
}

function renderErrorPayload(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): string {
  return JSON.stringify(
    {
      error: {
        code: input.code,
        message: input.message,
        ...(input.details ? { details: input.details } : {}),
      },
    },
    null,
    2
  );
}

function defaultIo(): AgovCliIo {
  return {
    stdout(message: string) {
      process.stdout.write(`${message}\n`);
    },
    stderr(message: string) {
      process.stderr.write(`${message}\n`);
    },
  };
}

function writeAgovOutput(outputPath: string, content: string): void {
  const filePath = path.resolve(outputPath);

  try {
    writeFileSync(filePath, content, 'utf8');
  } catch {
    throw new AgovCliOutputError(
      `Failed to write agov report output to "${filePath}".`,
      'agov.cli.output_write_failed',
      filePath
    );
  }
}
