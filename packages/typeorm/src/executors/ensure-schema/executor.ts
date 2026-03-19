import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';
import type { DataSource } from 'typeorm';
import {
  ensureProjectRoot,
  schemaFilePath,
  schemaNameFrom,
} from '../../utils/shared.js';
import type { EnsureSchemaExecutorOptions } from './schema.js';

export default async function ensureSchema(
  options: EnsureSchemaExecutorOptions,
  context: ExecutorContext
) {
  const { absoluteProjectRoot, dataSource: dataSourcePath } = ensureProjectRoot(
    { projectRoot: options.projectRoot, dataSource: options.dataSource },
    context
  );

  let schemaName = options.schema?.trim();
  if (!schemaName) {
    const candidate = schemaFilePath(absoluteProjectRoot);
    if (existsSync(candidate)) {
      const contents = readFileSync(candidate, 'utf-8');
      schemaName = schemaNameFrom(contents);
    }
  }

  if (!schemaName) {
    throw new Error('Unable to infer schema name. Provide the schema option.');
  }

  const dataSource = await loadDataSource(
    dataSourcePath,
    absoluteProjectRoot,
    options.tsconfig
  );

  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();

    try {
      if (
        typeof (queryRunner as CreateSchemaCapable).createSchema === 'function'
      ) {
        await (queryRunner as CreateSchemaCapable).createSchema(
          schemaName,
          true
        );
        logger.info(`Ensured schema "${schemaName}" exists.`);
      } else if (
        dataSource.options.type === 'mysql' ||
        dataSource.options.type === 'mariadb'
      ) {
        await queryRunner.query('CREATE DATABASE IF NOT EXISTS ??', [
          schemaName,
        ]);
        logger.info(`Ensured database "${schemaName}" exists.`);
      } else if (
        dataSource.options.type === 'sqlite' ||
        dataSource.options.type === 'better-sqlite3'
      ) {
        logger.info(
          'SQLite does not support schemas; ensure-schema is a no-op.'
        );
      } else {
        logger.warn(
          'Current TypeORM driver does not expose createSchema; skipping ensure-schema.'
        );
      }
    } finally {
      await queryRunner.release().catch((err) => {
        logger.error(
          `Failed to release query runner: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
    }

    return { success: true };
  } finally {
    await dataSource.destroy().catch(() => undefined);
  }
}

async function loadDataSource(
  dataSourcePath: string,
  absoluteProjectRoot: string,
  tsconfig: string | undefined
): Promise<DataSource> {
  await registerTsNodeIfNeeded(dataSourcePath, absoluteProjectRoot, tsconfig);

  const moduleUrl = pathToFileURL(dataSourcePath).href;
  const imported = await import(moduleUrl);
  const instance =
    imported.default ?? imported.dataSource ?? imported.appDataSource;

  if (!instance || typeof instance.initialize !== 'function') {
    throw new Error(`TypeORM DataSource not found in ${dataSourcePath}.`);
  }

  return instance as DataSource;
}

async function registerTsNodeIfNeeded(
  dataSourcePath: string,
  projectRoot: string,
  tsconfig: string | undefined
) {
  if (!dataSourcePath.endsWith('.ts')) {
    return;
  }

  if (tsconfig) {
    process.env.TS_NODE_PROJECT = resolve(projectRoot, tsconfig);
  }

  try {
    await import('ts-node/register');
  } catch {
    throw new Error(
      'ts-node is required to load TypeScript data sources. Install it in your workspace.'
    );
  }
}

type CreateSchemaCapable = {
  createSchema(schemaPath: string, ifNotExist?: boolean): Promise<void>;
};
