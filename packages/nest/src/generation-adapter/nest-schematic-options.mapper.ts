export type NestModuleSystem = 'esm' | 'cjs';

export interface NxNestApplicationOptions {
  name: string;
  directory?: string;
  moduleSystem?: NestModuleSystem;
  strict?: boolean;
  spec?: boolean;
  skipInstall?: boolean;
  skipGit?: boolean;
  packageManager?: 'yarn' | 'npm' | 'pnpm';
}

export interface NxNestLibraryOptions {
  name: string;
  directory?: string;
  rootDir?: string;
  prefix?: string;
  strict?: boolean;
}

export interface NxNestResourceOptions {
  name: string;
  sourceRoot?: string;
  path?: string;
  type?:
    | 'rest'
    | 'graphql-code-first'
    | 'graphql-schema-first'
    | 'microservice'
    | 'ws';
  crud?: boolean;
  spec?: boolean;
  flat?: boolean;
}

export function mapApplicationOptionsToNestSchematicOptions(
  options: NxNestApplicationOptions
): Record<string, unknown> {
  const name = assertNonEmptyName(options.name, 'application');
  const mapped: Record<string, unknown> = { name };

  assignIfDefined(mapped, 'directory', options.directory);
  assignIfDefined(mapped, 'type', options.moduleSystem);
  assignIfDefined(mapped, 'strict', options.strict);
  assignIfDefined(mapped, 'packageManager', options.packageManager);
  assignIfDefined(mapped, 'spec', options.spec);

  return mapped;
}

export function mapLibraryOptionsToNestSchematicOptions(
  options: NxNestLibraryOptions
): Record<string, unknown> {
  const name = assertNonEmptyName(options.name, 'library');
  const mapped: Record<string, unknown> = { name };

  assignIfDefined(mapped, 'path', options.directory);
  assignIfDefined(mapped, 'rootDir', options.rootDir);
  assignIfDefined(mapped, 'prefix', options.prefix);

  return mapped;
}

export function mapResourceOptionsToNestSchematicOptions(
  options: NxNestResourceOptions
): Record<string, unknown> {
  const name = assertNonEmptyName(options.name, 'resource');
  const mapped: Record<string, unknown> = { name };

  assignIfDefined(mapped, 'path', options.path);
  assignIfDefined(mapped, 'sourceRoot', options.sourceRoot);
  assignIfDefined(mapped, 'type', options.type);
  assignIfDefined(mapped, 'crud', options.crud);
  assignIfDefined(mapped, 'spec', options.spec);
  assignIfDefined(mapped, 'flat', options.flat);

  return mapped;
}

function assertNonEmptyName(name: string, schematicName: string): string {
  const normalized = name.trim();

  if (normalized.length === 0) {
    throw new Error(
      `Nest ${schematicName} schematic options require a non-empty "name".`
    );
  }

  return normalized;
}

function assignIfDefined(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
