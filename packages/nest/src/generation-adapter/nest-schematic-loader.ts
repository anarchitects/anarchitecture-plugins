import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { NestSchematicName } from './nest-schematic-options.js';
import {
  NEST_SCHEMATICS_PACKAGE,
  NEST_SCHEMATICS_PACKAGE_NAME,
} from '../utils/nest-version.js';

const require = createRequire(import.meta.url);

export type RequiredNestSchematicName = NestSchematicName;

export interface NestSchematicCollectionInfo {
  collectionPath: string;
  availableSchematics: readonly string[];
}

interface NestSchematicsPackageManifest {
  schematics?: string;
}

interface NestSchematicsCollectionFile {
  schematics?: Record<string, unknown>;
}

const REQUIRED_NEST_SCHEMATIC_NAMES: readonly RequiredNestSchematicName[] = [
  'application',
  'library',
  'resource',
];

export function resolveNestSchematicsCollectionPath(): string {
  const packageJsonPath = resolveNestSchematicsPackageJsonPath();
  const packageJson = parseJsonFile<NestSchematicsPackageManifest>(
    packageJsonPath,
    `Nest schematics package manifest for "${NEST_SCHEMATICS_PACKAGE_NAME}"`
  );

  if (!packageJson.schematics) {
    throw new Error(
      `Nest schematics package "${NEST_SCHEMATICS_PACKAGE_NAME}" does not declare a schematics collection path.`
    );
  }

  const collectionPath = resolve(
    dirname(packageJsonPath),
    packageJson.schematics
  );
  if (!existsSync(collectionPath)) {
    throw new Error(
      `Nest schematics collection "${collectionPath}" does not exist. ` +
        `Check that "${NEST_SCHEMATICS_PACKAGE}" is installed correctly.`
    );
  }

  return collectionPath;
}

export function loadNestSchematicsCollectionInfo(): NestSchematicCollectionInfo {
  const collectionPath = resolveNestSchematicsCollectionPath();
  const collection = parseJsonFile<NestSchematicsCollectionFile>(
    collectionPath,
    `Nest schematics collection "${collectionPath}"`
  );

  if (!collection.schematics || typeof collection.schematics !== 'object') {
    throw new Error(
      `Nest schematics collection "${collectionPath}" does not expose a valid "schematics" object.`
    );
  }

  return {
    collectionPath,
    availableSchematics: Object.keys(collection.schematics),
  };
}

export function assertRequiredNestSchematicsAvailable(
  availableSchematics: readonly string[]
): void {
  const missingSchematics = REQUIRED_NEST_SCHEMATIC_NAMES.filter(
    (schematicName) => !availableSchematics.includes(schematicName)
  );

  if (missingSchematics.length === 0) {
    return;
  }

  throw new Error(
    `Nest schematics collection is missing required schematics: ${missingSchematics.join(
      ', '
    )}.`
  );
}

function resolveNestSchematicsPackageJsonPath(): string {
  try {
    return require.resolve(`${NEST_SCHEMATICS_PACKAGE_NAME}/package.json`);
  } catch (error) {
    throw new Error(
      `Unable to resolve Nest schematics package "${NEST_SCHEMATICS_PACKAGE_NAME}". ` +
        `Install "${NEST_SCHEMATICS_PACKAGE}" before loading schematics.`,
      { cause: error }
    );
  }
}

function parseJsonFile<T>(path: string, description: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse ${description}: ${(error as Error).message}`,
      { cause: error }
    );
  }
}
