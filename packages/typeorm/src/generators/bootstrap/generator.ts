import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
  type GeneratorCallback,
} from '@nx/devkit';
import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ArrayLiteralExpression,
  CodeBlockWriter,
  Decorator,
  Expression,
  ImportSpecifier,
  Node,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

interface BootstrapGeneratorSchema {
  project: string;
  domain?: string;
  schema?: string;
  db?: string;
  withCompose?: boolean;
  skipInstall?: boolean;
  schemaPath?: string;
  migrationsDir?: string;
}

const generatorDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE = 'postgres';
const DEFAULT_SCHEMA_PATH = 'src/infrastructure-persistence/schema.ts';
const DEFAULT_MIGRATIONS_DIR = 'src/infrastructure-persistence/migrations';
const DEFAULT_MIGRATION_FILE = '1700000000000_init_schema.ts';
const runtimeImportPath = './data-source';

const DRIVER_DEPENDENCIES: Record<
  string,
  {
    packageName: string;
    version: string;
  }
> = {
  postgres: { packageName: 'pg', version: '^8.20.0' },
  postgresql: { packageName: 'pg', version: '^8.20.0' },
  mysql: { packageName: 'mysql2', version: '^3.20.0' },
  mariadb: { packageName: 'mariadb', version: '^3.5.2' },
  sqlite: { packageName: 'sqlite3', version: '^6.0.1' },
  'better-sqlite3': { packageName: 'better-sqlite3', version: '^12.8.0' },
  mssql: { packageName: 'mssql', version: '^12.2.1' },
};

export default async function bootstrapGenerator(
  tree: Tree,
  options: BootstrapGeneratorSchema
) {
  const project = readProjectConfiguration(tree, options.project);
  const isNestApplication =
    project.projectType === 'application' &&
    hasNestModuleFile(tree, project.root, project.sourceRoot);

  const tasks: GeneratorCallback[] = [];
  const dependencyTask = addDependenciesToPackageJson(
    tree,
    buildRuntimeDependencies(options.db, isNestApplication),
    {
      'ts-node': '^10.9.2',
      'typeorm-ts-node-commonjs': '^0.3.20',
      'typeorm-ts-node-esm': '^0.3.20',
    }
  );

  if (!options.skipInstall) {
    tasks.push(dependencyTask);
  }

  if (project.projectType === 'library') {
    prepareLibrary(tree, options.project, project.root, options);
  } else {
    prepareApplication(
      tree,
      project.root,
      project.sourceRoot,
      options,
      isNestApplication
    );
  }

  await formatFiles(tree);

  return tasks.length ? runTasksInSerial(...tasks) : () => undefined;
}

function buildRuntimeDependencies(
  database: string | undefined,
  isNestApplication: boolean
) {
  const resolvedDatabase = (database ?? DEFAULT_DATABASE).toLowerCase();
  const dependencies: Record<string, string> = {
    typeorm: '^0.3.28',
    'reflect-metadata': '^0.2.2',
  };

  const driverDependency = DRIVER_DEPENDENCIES[resolvedDatabase];
  if (driverDependency) {
    dependencies[driverDependency.packageName] = driverDependency.version;
  }

  if (isNestApplication) {
    dependencies['@nestjs/typeorm'] = '^11.0.0';
  }

  return dependencies;
}

function prepareLibrary(
  tree: Tree,
  projectName: string,
  projectRoot: string,
  options: BootstrapGeneratorSchema
) {
  if (!options.domain) {
    throw new Error('Domain option is required when targeting a library.');
  }

  const schemaName = (options.schema ?? options.domain).toLowerCase();
  const schemaPathRelative = normalizeProjectRelative(
    options.schemaPath ?? DEFAULT_SCHEMA_PATH
  );
  const migrationsDirRelative = normalizeProjectRelative(
    options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR
  );
  const templateOptions = {
    tmpl: '',
    schema: schemaName,
    domain: options.domain,
    schemaPath: schemaPathRelative,
    migrationsDir: migrationsDirRelative,
    ...names(options.domain),
  };

  generateFiles(
    tree,
    joinPathFragments(generatorDir, 'files', 'lib'),
    projectRoot,
    templateOptions
  );

  const defaultSchemaPath = joinPathFragments(projectRoot, DEFAULT_SCHEMA_PATH);
  const defaultMigrationPath = joinPathFragments(
    projectRoot,
    DEFAULT_MIGRATIONS_DIR,
    DEFAULT_MIGRATION_FILE
  );
  const targetSchemaPath = joinPathFragments(projectRoot, schemaPathRelative);
  const targetMigrationPath = joinPathFragments(
    projectRoot,
    migrationsDirRelative,
    DEFAULT_MIGRATION_FILE
  );

  moveGeneratedFile(tree, defaultSchemaPath, targetSchemaPath);
  moveGeneratedFile(tree, defaultMigrationPath, targetMigrationPath);
  patchMigrationSchemaImport(tree, targetSchemaPath, targetMigrationPath);

  const partial = consumeProjectJsonPartial(tree, projectRoot);
  const projectConfig = readProjectConfiguration(tree, projectName);
  updateProjectConfiguration(tree, projectName, {
    ...projectConfig,
    metadata: {
      ...(projectConfig.metadata ?? {}),
      ...(partial.metadata ?? {}),
      typeorm: {
        ...((projectConfig.metadata as { typeorm?: Record<string, unknown> })
          ?.typeorm ?? {}),
        ...((partial.metadata as { typeorm?: Record<string, unknown> })
          ?.typeorm ?? {}),
        schema: schemaName,
        domain: options.domain,
        schemaPath: schemaPathRelative,
        migrationsDir: migrationsDirRelative,
      },
    },
  });
}

function prepareApplication(
  tree: Tree,
  projectRoot: string,
  sourceRoot: string | undefined,
  options: BootstrapGeneratorSchema,
  isNestApplication: boolean
) {
  const database = options.db ?? DEFAULT_DATABASE;
  const projectName = names(options.project).fileName.replace(/-/g, '_');

  generateFiles(
    tree,
    joinPathFragments(generatorDir, 'files', 'app'),
    projectRoot,
    {
      tmpl: '',
      database,
      appDatabase: projectName,
    }
  );

  if (!options.withCompose) {
    const composePath = joinPathFragments(projectRoot, 'docker-compose.yml');
    if (tree.exists(composePath)) {
      tree.delete(composePath);
    }
  }

  if (isNestApplication) {
    patchAppModule(tree, projectRoot, sourceRoot);
  }
}

function consumeProjectJsonPartial(
  tree: Tree,
  projectRoot: string
): {
  metadata?: Record<string, unknown>;
} {
  const tempPartialPath = joinPathFragments(
    projectRoot,
    'project.json.partial'
  );
  if (!tree.exists(tempPartialPath)) {
    return {};
  }

  const contents = tree.read(tempPartialPath, 'utf-8');
  tree.delete(tempPartialPath);

  if (!contents) {
    return {};
  }

  try {
    return JSON.parse(contents) as { metadata?: Record<string, unknown> };
  } catch {
    return {};
  }
}

function moveGeneratedFile(tree: Tree, from: string, to: string) {
  if (from === to || !tree.exists(from)) {
    return;
  }

  const contents = tree.read(from);
  if (!contents) {
    return;
  }

  tree.write(to, contents);
  tree.delete(from);
}

function patchMigrationSchemaImport(
  tree: Tree,
  schemaPath: string,
  migrationPath: string
) {
  if (!tree.exists(schemaPath) || !tree.exists(migrationPath)) {
    return;
  }

  const migrationContents = tree.read(migrationPath, 'utf-8');
  if (!migrationContents) {
    return;
  }

  const schemaImportPath = importPathFrom(migrationPath, schemaPath);
  const updatedContents = migrationContents.replace(
    /from\s+['"][^'"]+['"];/,
    `from '${schemaImportPath}';`
  );

  tree.write(migrationPath, updatedContents);
}

function importPathFrom(fromFile: string, targetFile: string): string {
  const relativePath = relative(dirname(fromFile), targetFile).replace(
    /\\/g,
    '/'
  );
  const withoutExtension = relativePath.replace(/\.ts$/, '');
  if (withoutExtension.startsWith('.')) {
    return withoutExtension;
  }
  return `./${withoutExtension}`;
}

function normalizeProjectRelative(pathValue: string): string {
  if (isAbsolute(pathValue)) {
    throw new Error(
      `Path "${pathValue}" must be relative to the project root.`
    );
  }

  const normalized = pathValue
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('Path options must not be empty.');
  }
  return normalized;
}

function hasNestModuleFile(
  tree: Tree,
  projectRoot: string,
  sourceRoot: string | undefined
): boolean {
  const resolvedSourceRoot =
    sourceRoot ?? joinPathFragments(projectRoot, 'src');
  return tree.exists(joinPathFragments(resolvedSourceRoot, 'app.module.ts'));
}

function patchAppModule(
  tree: Tree,
  projectRoot: string,
  sourceRoot: string | undefined
) {
  const resolvedSourceRoot =
    sourceRoot ?? joinPathFragments(projectRoot, 'src');
  const modulePath = joinPathFragments(resolvedSourceRoot, 'app.module.ts');

  if (!tree.exists(modulePath)) {
    return;
  }

  const sourceText = tree.read(modulePath, 'utf-8');
  if (!sourceText) {
    return;
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile(modulePath, sourceText, {
    overwrite: true,
  });

  ensureImport(sourceFile, '@nestjs/typeorm', 'TypeOrmModule');
  ensureImport(sourceFile, runtimeImportPath, 'makeRuntimeDataSource');

  const moduleDecorator = sourceFile
    .getDescendantsOfKind(SyntaxKind.Decorator)
    .find((decorator: Decorator) => decorator.getName() === 'Module');

  if (!moduleDecorator) {
    tree.write(modulePath, sourceFile.getFullText());
    return;
  }

  const callExpression = moduleDecorator.getCallExpression();
  if (!callExpression) {
    tree.write(modulePath, sourceFile.getFullText());
    return;
  }

  let moduleLiteral = callExpression.getArguments()[0] as
    | ObjectLiteralExpression
    | undefined;

  if (
    !moduleLiteral ||
    moduleLiteral.getKind() !== SyntaxKind.ObjectLiteralExpression
  ) {
    moduleLiteral = callExpression.addArgument('{}') as ObjectLiteralExpression;
  }

  const importsArray = ensureImportsArray(moduleLiteral);
  const hasTypeOrm = importsArray
    .getElements()
    .some((element: Expression) =>
      element.getText().includes('TypeOrmModule.forRoot')
    );

  if (!hasTypeOrm) {
    importsArray.addElement((writer: CodeBlockWriter) => {
      writer.write('TypeOrmModule.forRootAsync({');
      writer.indent(() => {
        writer.writeLine('useFactory: async () => ({');
        writer.indent(() => {
          writer.writeLine('...makeRuntimeDataSource().options,');
          writer.writeLine('autoLoadEntities: true,');
        });
        writer.writeLine('}),');
        writer.writeLine(
          'dataSourceFactory: async () => makeRuntimeDataSource().initialize(),'
        );
      });
      writer.write('})');
    });
  }

  tree.write(modulePath, sourceFile.getFullText());
}

function ensureImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  importName: string
) {
  const existing = sourceFile.getImportDeclaration(moduleSpecifier);
  if (!existing) {
    sourceFile.addImportDeclaration({
      moduleSpecifier,
      namedImports: [importName],
    });
    return;
  }

  const hasImport = existing
    .getNamedImports()
    .some(
      (namedImport: ImportSpecifier) => namedImport.getName() === importName
    );

  if (!hasImport) {
    existing.addNamedImport(importName);
  }
}

function ensureImportsArray(
  moduleLiteral: ObjectLiteralExpression
): ArrayLiteralExpression {
  const existing = moduleLiteral.getProperty('imports');

  if (existing && Node.isPropertyAssignment(existing)) {
    const initializer = existing.getInitializerIfKind(
      SyntaxKind.ArrayLiteralExpression
    );

    if (initializer) {
      return initializer;
    }

    existing.setInitializer('[]');
    return existing.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression
    );
  }

  if (existing) {
    existing.remove();
  }

  const property = moduleLiteral.addPropertyAssignment({
    name: 'imports',
    initializer: '[]',
  }) as PropertyAssignment;

  return property.getInitializerIfKindOrThrow(
    SyntaxKind.ArrayLiteralExpression
  );
}
