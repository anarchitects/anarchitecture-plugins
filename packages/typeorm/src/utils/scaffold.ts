import type { Tree } from '@nx/devkit';
import { normalizeName } from './shared.js';

export function scaffoldName(name: string): string {
  const normalized = normalizeName(name);
  if (!/^[A-Za-z_$][\w$-]*$/.test(normalized)) {
    throw new Error(
      'The name option must be an identifier or words separated by spaces or hyphens. Use directory for the destination.'
    );
  }
  return normalized;
}

export function writeNewScaffold(tree: Tree, path: string, content: string) {
  if (tree.exists(path)) {
    throw new Error(
      `File "${path}" already exists. Choose a different name or timestamp.`
    );
  }
  tree.write(path, content);
}

export function assertNoScaffoldArgs(args: string[] | undefined) {
  if (args?.length) {
    throw new Error(
      'Additional CLI args are not supported by this generator. Use the corresponding TypeORM executor for CLI passthrough.'
    );
  }
}

interface MigrationOptions {
  outputJs?: boolean;
  esm?: boolean;
  timestamp?: number;
  args?: string[];
}

// Keep the known migration:create flags without executing a filesystem-writing
// CLI. Trailing args retain their precedence over the named generator options.
export function migrationScaffoldOptions(options: MigrationOptions) {
  const result = { ...options };
  const args = options.args ?? [];
  for (let index = 0; index < args.length; index++) {
    const [flag, inlineValue] = args[index].split(/=(.*)/s);
    if (
      ['--outputJs', '-o', '--esm', '--no-outputJs', '--no-esm'].includes(flag)
    ) {
      const key = flag.includes('esm') ? 'esm' : 'outputJs';
      let value = inlineValue;
      if (value === undefined && ['true', 'false'].includes(args[index + 1])) {
        value = args[++index];
      }
      if (value !== undefined && value !== 'true' && value !== 'false') {
        throw new Error(`Invalid boolean value for ${flag}.`);
      }
      result[key] = !flag.startsWith('--no-') && value !== 'false';
    } else if (flag === '--timestamp' || flag === '-t') {
      const value = inlineValue ?? args[++index];
      if (!value?.trim()) {
        throw new Error('Provide a value for the timestamp option.');
      }
      result.timestamp = Number(value);
    } else {
      throw new Error(
        `Unsupported scaffold argument "${args[index]}". Use outputJs, esm or timestamp, or use the migration-create executor for CLI passthrough.`
      );
    }
  }

  const timestamp = result.timestamp ?? Date.now();
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    timestamp > 8640000000000000
  ) {
    throw new Error(
      'The timestamp option must be a non-negative integer within the JavaScript date range.'
    );
  }
  return { ...result, timestamp };
}

export function migrationScaffold(
  className: string,
  options: { outputJs?: boolean; esm?: boolean }
): string {
  if (options.outputJs) {
    return `${options.esm ? 'export' : 'module.exports ='} class ${className} {
  async up(queryRunner) {}

  async down(queryRunner) {}
}
`;
  }

  return `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
`;
}
