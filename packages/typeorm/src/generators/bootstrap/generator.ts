import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  type GeneratorCallback,
} from '@nx/devkit';
import { dirname, join } from 'node:path';
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
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE = 'postgres';
const runtimeImportPath = './typeorm.datasource';

export default async function bootstrapGenerator(
  tree: Tree,
  options: BootstrapGeneratorSchema
) {
  const project = readProjectConfiguration(tree, options.project);
  const tasks: GeneratorCallback[] = [];

  const dependencyTask = addDependenciesToPackageJson(
    tree,
    {
      typeorm: '^0.3.20',
      pg: '^8.11.0',
      'reflect-metadata': '^0.1.13',
      '@nestjs/typeorm': '^10.0.0',
    },
    {
      'ts-node': '^10.9.2',
      'typeorm-ts-node-commonjs': '^0.0.8',
    }
  );

  if (!options.skipInstall) {
    tasks.push(dependencyTask);
  }

  if (project.projectType === 'library') {
    prepareLibrary(tree, project.root, options);
  } else {
    prepareApplication(tree, project.root, project.sourceRoot, options);
  }

  await formatFiles(tree);

  return tasks.length ? runTasksInSerial(...tasks) : () => {};
}

function prepareLibrary(
  tree: Tree,
  projectRoot: string,
  options: BootstrapGeneratorSchema
) {
  if (!options.domain) {
    throw new Error('Domain option is required when targeting a library.');
  }

  const schemaName = (options.schema ?? options.domain).toLowerCase();
  const templateOptions = {
    tmpl: '',
    schema: schemaName,
    domain: options.domain,
    ...names(options.domain),
  };

  generateFiles(
    tree,
    join(__dirname, 'files', 'lib'),
    projectRoot,
    templateOptions
  );

  const tempPartialPath = joinPathFragments(
    projectRoot,
    'project.json.partial'
  );
  if (tree.exists(tempPartialPath)) {
    tree.delete(tempPartialPath);
  }

  const projectJsonPath = joinPathFragments(projectRoot, 'project.json');
  if (tree.exists(projectJsonPath)) {
    updateJson(tree, projectJsonPath, (json) => {
      json.metadata ??= {};
      json.metadata.typeorm = {
        schema: schemaName,
        domain: options.domain,
      };
      return json;
    });
  }
}

function prepareApplication(
  tree: Tree,
  projectRoot: string,
  sourceRoot: string | undefined,
  options: BootstrapGeneratorSchema
) {
  const database = options.db ?? DEFAULT_DATABASE;
  const projectName = names(options.project).fileName.replace(/-/g, '_');

  generateFiles(tree, join(__dirname, 'files', 'app'), projectRoot, {
    tmpl: '',
    database,
    appDatabase: projectName,
  });

  if (!options.withCompose) {
    const composePath = joinPathFragments(projectRoot, 'docker-compose.yml');
    if (tree.exists(composePath)) {
      tree.delete(composePath);
    }
  }

  patchAppModule(tree, projectRoot, sourceRoot);
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
