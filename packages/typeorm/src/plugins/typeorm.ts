import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  CreateNodesContextV2,
  CreateNodesResult,
  CreateNodesResultV2,
  TargetConfiguration,
} from '@nx/devkit';
import { createNodesFromFiles } from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes.js';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs.js';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory.js';
import {
  defaultMigrationsDirectory,
  schemaFilePath,
  schemaNameFrom,
} from '../executors/shared.js';

interface CacheEntry {
  [hash: string]: Record<string, TargetConfiguration>;
}

const FILE_PATTERN =
  '**/src/{app.module.ts,infrastructure-persistence/schema.ts}';
const CACHE_PATH = join(workspaceDataDirectory, 'nx-typeorm-targets.json');

function readCache(): CacheEntry {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as CacheEntry;
  } catch {
    return {};
  }
}

function writeCache(data: CacheEntry) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`);
  } catch {
    // ignore cache write failures
  }
}

function projectRootOf(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const marker = '/src/';
  const index = normalized.indexOf(marker);
  if (index === -1) {
    return dirname(normalized);
  }

  return normalized.substring(0, index);
}

function detectProjectType(file: string): 'application' | 'library' {
  return file.endsWith('app.module.ts') ? 'application' : 'library';
}

function inferDataSource(
  workspaceRoot: string,
  projectRoot: string,
  type: 'application' | 'library'
): string {
  const candidates = [
    join(projectRoot, 'tools/typeorm/datasource.migrations.ts'),
    join(projectRoot, 'tools/typeorm/datasource.migrations.js'),
    join(projectRoot, 'src/typeorm.datasource.ts'),
    join(projectRoot, 'src/typeorm.datasource.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(workspaceRoot, candidate))) {
      return candidate;
    }
  }

  return type === 'application'
    ? join(projectRoot, 'tools/typeorm/datasource.migrations.ts')
    : join(projectRoot, 'src/typeorm.datasource.ts');
}

function inferSchema(
  workspaceRoot: string,
  projectRoot: string
): string | undefined {
  const file = schemaFilePath(join(workspaceRoot, projectRoot));
  if (!existsSync(file)) {
    return undefined;
  }

  const contents = readFileSync(file, 'utf-8');
  return schemaNameFrom(contents);
}

function createTargets(
  projectRoot: string,
  type: 'application' | 'library',
  context: CreateNodesContextV2,
  facts: {
    migrationsDirectory: string;
    dataSource: string;
    schema?: string;
  }
): Record<string, TargetConfiguration> {
  const namedInputs = getNamedInputs(projectRoot, context);
  const defaultInputs = namedInputs?.default
    ? ['default', '^default']
    : undefined;

  const targets: Record<string, TargetConfiguration> = {
    'db:migrate:generate': {
      executor: '@anarchitects/nx-typeorm:generate',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
        outputPath: facts.migrationsDirectory,
      },
      outputs: [facts.migrationsDirectory],
    },
    'db:migrate:run': {
      executor: '@anarchitects/nx-typeorm:run',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
      },
    },
    'db:migrate:revert': {
      executor: '@anarchitects/nx-typeorm:revert',
      options: {
        projectRoot,
        dataSource: facts.dataSource,
      },
    },
    'db:ensure-schema': {
      executor: '@anarchitects/nx-typeorm:ensure-schema',
      options: {
        projectRoot,
        schema: facts.schema,
      },
    },
  };

  if (type === 'application') {
    targets['db:seed'] = {
      executor: '@anarchitects/nx-typeorm:seed',
      options: {
        projectRoot,
        file: 'tools/typeorm/seeds/index.ts',
      },
    };
  }

  if (defaultInputs) {
    for (const target of Object.values(targets)) {
      target.inputs = defaultInputs;
    }
  }

  return targets;
}

async function createNodesInternal(
  file: string,
  context: CreateNodesContextV2,
  cache: CacheEntry
): Promise<CreateNodesResult> {
  const projectRoot = projectRootOf(file);
  const projectType = detectProjectType(file);
  const migrationsDirectory = defaultMigrationsDirectory(
    projectRoot,
    projectType
  );
  const dataSource = inferDataSource(
    context.workspaceRoot,
    projectRoot,
    projectType
  );
  const schema = inferSchema(context.workspaceRoot, projectRoot);

  const candidateInputs = new Set<string>([
    file,
    dataSource,
    migrationsDirectory,
    join(projectRoot, 'tools/typeorm/migrations/**/*'),
    join(projectRoot, 'tools/typeorm/seeds/**/*'),
  ]);

  const additionalInputs = Array.from(candidateInputs).filter((entry) => {
    if (entry.includes('*')) {
      return true;
    }
    return existsSync(join(context.workspaceRoot, entry));
  });

  const [hashKey] = await calculateHashesForCreateNodes(
    [projectRoot],
    {},
    context,
    [additionalInputs.length ? additionalInputs : [file]]
  );

  if (cache[hashKey]) {
    return { projects: { [projectRoot]: { targets: cache[hashKey] } } };
  }

  const targets = createTargets(projectRoot, projectType, context, {
    migrationsDirectory,
    dataSource,
    schema,
  });
  cache[hashKey] = targets;
  return { projects: { [projectRoot]: { targets } } };
}

export default {
  name: '@anarchitects/nx-typeorm/inference',
  createNodesV2: [
    FILE_PATTERN,
    async (
      configFiles: readonly string[],
      _options: unknown,
      context: CreateNodesContextV2
    ) => {
      if (configFiles.length === 0) {
        return [];
      }

      const cache = readCache();
      const results = await createNodesFromFiles(
        (file) => createNodesInternal(file, context, cache),
        configFiles,
        {},
        context
      );
      writeCache(cache);
      return results as CreateNodesResultV2;
    },
  ],
};
