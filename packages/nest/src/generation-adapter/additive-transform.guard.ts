import { normalizePath, type Tree } from '@nx/devkit';

export interface OverrideOptions {
  allowOverwrite?: boolean;
  justification?: string;
}

export interface SafeCreateFileOptions extends OverrideOptions {
  path: string;
  content: string;
}

export type JsonUpdate<T extends object = Record<string, unknown>> = (
  value: T
) => T | void;

export interface AdditiveTransformGuardContext {
  readonly targetRoot: string;
  readonly touchedFiles: readonly string[];
}

export interface AdditiveTransformGuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

const PROTECTED_NEST_GENERATED_FILE_SUFFIXES = [
  'src/main.ts',
  'src/app.module.ts',
  'src/app.controller.ts',
  'src/app.service.ts',
  'src/app.controller.spec.ts',
] as const;

export function createFileIfMissing(
  tree: Tree,
  options: SafeCreateFileOptions
): void {
  const path = normalizePath(options.path);

  if (!tree.exists(path)) {
    tree.write(path, options.content);
    return;
  }

  assertCanOverwriteGeneratedNestFile(path, options);
  assertCanOverwriteExistingFile(path, options);

  const currentContents = tree.read(path, 'utf-8');
  if (currentContents === options.content) {
    return;
  }

  tree.write(path, options.content);
}

export function updateJsonConfig<T extends object = Record<string, unknown>>(
  tree: Tree,
  path: string,
  updater: JsonUpdate<T>,
  options?: OverrideOptions
): void {
  const normalizedPath = normalizePath(path);

  if (
    options?.allowOverwrite &&
    !hasNonEmptyJustification(options.justification)
  ) {
    throw new Error(
      `Cannot apply override for JSON config "${normalizedPath}" without a non-empty justification.`
    );
  }

  const currentContents = tree.exists(normalizedPath)
    ? tree.read(normalizedPath, 'utf-8')
    : undefined;
  const draft = currentContents
    ? parseJsonObject<T>(currentContents, normalizedPath)
    : ({} as T);
  const updatedValue = updater(draft) ?? draft;

  assertJsonObject(updatedValue, normalizedPath);

  const nextContents = `${JSON.stringify(updatedValue, null, 2)}\n`;
  if (currentContents === nextContents) {
    return;
  }

  tree.write(normalizedPath, nextContents);
}

export function assertCanOverwriteGeneratedNestFile(
  path: string,
  options?: OverrideOptions
): void {
  const normalizedPath = normalizePath(path);

  if (!isProtectedNestGeneratedFile(normalizedPath)) {
    return;
  }

  if (!options?.allowOverwrite) {
    throw new Error(
      `Refusing to overwrite protected Nest-generated file "${normalizedPath}". ` +
        'Pass allowOverwrite: true with a non-empty justification if the change is intentional.'
    );
  }

  if (!hasNonEmptyJustification(options.justification)) {
    throw new Error(
      `Cannot overwrite protected Nest-generated file "${normalizedPath}" without a non-empty justification.`
    );
  }
}

function assertCanOverwriteExistingFile(
  path: string,
  options?: OverrideOptions
): void {
  if (!options?.allowOverwrite) {
    throw new Error(
      `Refusing to overwrite existing file "${path}". ` +
        'Pass allowOverwrite: true with a non-empty justification if the change is intentional.'
    );
  }

  if (!hasNonEmptyJustification(options.justification)) {
    throw new Error(
      `Cannot overwrite existing file "${path}" without a non-empty justification.`
    );
  }
}

function hasNonEmptyJustification(justification?: string): boolean {
  return (justification?.trim().length ?? 0) > 0;
}

function parseJsonObject<T extends object>(contents: string, path: string): T {
  let value: unknown;

  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON config "${path}": ${(error as Error).message}`
    );
  }

  assertJsonObject(value, path);
  return value as T;
}

function assertJsonObject(
  value: unknown,
  path: string
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`JSON config "${path}" must contain an object.`);
  }
}

function isProtectedNestGeneratedFile(path: string): boolean {
  return PROTECTED_NEST_GENERATED_FILE_SUFFIXES.some(
    (suffix) => path === suffix || path.endsWith(`/${suffix}`)
  );
}
