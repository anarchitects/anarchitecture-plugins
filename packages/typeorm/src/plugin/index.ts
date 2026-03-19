import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  CreateNodesContextV2,
  CreateNodesResultV2,
  CreateNodesV2,
  TargetConfiguration,
} from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import {
  defaultMigrationsDirectory,
  schemaFilePath,
  schemaNameFrom,
} from '../executors/shared.js';

const FILE_PATTERN =
  '**/{project.json,app.module.ts,data-source.ts,data-source.js,typeorm.datasource.ts,typeorm.datasource.js,datasource.migrations.ts,datasource.migrations.js,schema.ts}';

interface TypeormMetadata {
  projectType?: 'application' | 'library';
  schema?: string;
  schemaPath?: string;
  migrationsDirectory?: string;
}

const APP_DATASOURCE_CANDIDATES = [
  'tools/typeorm/datasource.migrations.ts',
  'tools/typeorm/datasource.migrations.js',
  'src/data-source.ts',
  'src/data-source.js',
  'src/typeorm.datasource.ts',
  'src/typeorm.datasource.js',
];

const LIB_DATASOURCE_CANDIDATES = [
  'src/data-source.ts',
  'src/data-source.js',
  'src/typeorm.datasource.ts',
  'src/typeorm.datasource.js',
  'tools/typeorm/datasource.migrations.ts',
  'tools/typeorm/datasource.migrations.js',
];

function isRelevantFile(file: string): boolean {
  return (
    file.endsWith('/project.json') ||
    file.endsWith('/src/app.module.ts') ||
    file.endsWith('/src/data-source.ts') ||
    file.endsWith('/src/data-source.js') ||
    file.endsWith('/src/typeorm.datasource.ts') ||
    file.endsWith('/src/typeorm.datasource.js') ||
    file.endsWith('/tools/typeorm/datasource.migrations.ts') ||
    file.endsWith('/tools/typeorm/datasource.migrations.js') ||
    file.endsWith('/src/infrastructure-persistence/schema.ts')
  );
}

function projectRootOf(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.endsWith('/project.json')) {
    return dirname(normalized);
  }
  const toolsIndex = normalized.indexOf('/tools/');
  if (toolsIndex !== -1) {
    return normalized.substring(0, toolsIndex);
  }

  const srcIndex = normalized.indexOf('/src/');
  if (srcIndex !== -1) {
    return normalized.substring(0, srcIndex);
  }

  return dirname(normalized);
}

function detectProjectType(file: string): 'application' | 'library' {
  if (file.endsWith('/src/infrastructure-persistence/schema.ts')) {
    return 'library';
  }
  return 'application';
}

function inferDataSource(
  workspaceRoot: string,
  projectRoot: string,
  type: 'application' | 'library'
): string | undefined {
  const candidates =
    type === 'application'
      ? APP_DATASOURCE_CANDIDATES
      : LIB_DATASOURCE_CANDIDATES;

  for (const candidate of candidates) {
    const workspaceCandidate = join(workspaceRoot, projectRoot, candidate);
    if (existsSync(workspaceCandidate)) {
      return join(projectRoot, candidate);
    }
  }

  return undefined;
}

function inferSchema(
  workspaceRoot: string,
  projectRoot: string,
  schemaPath?: string
): string | undefined {
  const file = schemaPath
    ? join(workspaceRoot, projectRoot, schemaPath)
    : schemaFilePath(join(workspaceRoot, projectRoot));
  if (!existsSync(file)) {
    return undefined;
  }

  const contents = readFileSync(file, 'utf-8');
  return schemaNameFrom(contents);
}

function readTypeormMetadata(
  workspaceRoot: string,
  projectRoot: string
): TypeormMetadata {
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  if (!existsSync(projectJsonPath)) {
    return {};
  }

  try {
    const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8')) as {
      projectType?: 'application' | 'library';
      metadata?: {
        typeorm?: {
          schema?: string;
          schemaPath?: string;
          migrationsDir?: string;
        };
      };
    };

    const typeormMetadata = projectJson.metadata?.typeorm;
    const migrationsDir = toRelativePath(typeormMetadata?.migrationsDir);

    return {
      projectType: projectJson.projectType,
      schema: typeormMetadata?.schema,
      schemaPath: toRelativePath(typeormMetadata?.schemaPath),
      migrationsDirectory: migrationsDir
        ? join(projectRoot, migrationsDir)
        : undefined,
    };
  } catch {
    return {};
  }
}

function toRelativePath(pathValue?: string): string | undefined {
  if (!pathValue) {
    return undefined;
  }

  const normalized = pathValue.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('/')) {
    return undefined;
  }

  return normalized;
}

function cloneTarget(target: TargetConfiguration): TargetConfiguration {
  return {
    ...target,
    options: target.options ? { ...target.options } : undefined,
    inputs: target.inputs ? [...target.inputs] : undefined,
    outputs: target.outputs ? [...target.outputs] : undefined,
  };
}

function createTargets(
  projectRoot: string,
  type: 'application' | 'library',
  facts: {
    migrationsDirectory: string;
    dataSource?: string;
    schema?: string;
  }
): Record<string, TargetConfiguration> {
  if (!facts.dataSource && !facts.schema) {
    return {};
  }

  const targets: Record<string, TargetConfiguration> = {};

  if (facts.dataSource) {
    targets['db:migrate:generate'] = {
      executor: '@anarchitects/nx-typeorm:generate',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
        outputPath: facts.migrationsDirectory,
      },
      outputs: [facts.migrationsDirectory],
    };
    targets['db:migrate:run'] = {
      executor: '@anarchitects/nx-typeorm:run',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
      },
    };
    targets['db:migrate:revert'] = {
      executor: '@anarchitects/nx-typeorm:revert',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
      },
    };

    targets['typeorm:generate'] = cloneTarget(targets['db:migrate:generate']);
    targets['typeorm:run'] = cloneTarget(targets['db:migrate:run']);
    targets['typeorm:revert'] = cloneTarget(targets['db:migrate:revert']);
  }

  targets['db:ensure-schema'] = {
    executor: '@anarchitects/nx-typeorm:ensure-schema',
    options: {
      projectRoot,
      schema: facts.schema,
      dataSource: facts.dataSource,
    },
  };
  targets['typeorm:ensure-schema'] = cloneTarget(targets['db:ensure-schema']);

  if (type === 'application') {
    targets['db:seed'] = {
      executor: '@anarchitects/nx-typeorm:seed',
      options: {
        projectRoot,
        file: 'tools/typeorm/seeds/index.ts',
      },
    };
    targets['typeorm:seed'] = cloneTarget(targets['db:seed']);
  }

  return targets;
}

async function createNodesInternal(
  file: string,
  context: CreateNodesContextV2
) {
  if (!isRelevantFile(file)) {
    return { projects: {} };
  }

  const projectRoot = projectRootOf(file);
  const metadata = readTypeormMetadata(context.workspaceRoot, projectRoot);
  const projectType = metadata.projectType ?? detectProjectType(file);
  const migrationsDirectory =
    metadata.migrationsDirectory ??
    defaultMigrationsDirectory(projectRoot, projectType);
  const dataSource = inferDataSource(
    context.workspaceRoot,
    projectRoot,
    projectType
  );
  const schema =
    metadata.schema ??
    inferSchema(context.workspaceRoot, projectRoot, metadata.schemaPath);

  const targets = createTargets(projectRoot, projectType, {
    migrationsDirectory,
    dataSource,
    schema,
  });
  if (Object.keys(targets).length === 0) {
    return { projects: {} };
  }

  return {
    projects: {
      [projectRoot]: {
        targets,
      },
    },
  };
}

export const createNodesV2: CreateNodesV2 = [
  FILE_PATTERN,
  async (
    configFiles: readonly string[],
    _options,
    context
  ): Promise<CreateNodesResultV2> => {
    const results = await createNodesFromFiles(
      (file) => createNodesInternal(file, context),
      configFiles,
      {},
      context
    );

    return results as CreateNodesResultV2;
  },
];

export const name = '@anarchitects/nx-typeorm/inference';

export default {
  name,
  createNodesV2,
};
