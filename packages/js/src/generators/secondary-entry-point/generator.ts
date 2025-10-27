import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  names,
  normalizePath,
  ProjectConfiguration,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import * as ts from 'typescript';
import type { SecondaryEntryPointGeneratorSchema } from './schema';

interface NormalizedOptions {
  projectName: string;
  projectConfiguration: ProjectConfiguration;
  projectRoot: string;
  sourceRoot: string;
  entryPointSegments: string[];
  entryPointPath: string;
  entryFileName: string;
  entryFolder: string;
  entryIndexPath: string;
  buildTargetName: string;
  entrySourceRelativeToProjectRoot: string;
  viteEntryKey: string;
}

export async function secondaryEntryPointGenerator(
  tree: Tree,
  schema: SecondaryEntryPointGeneratorSchema
) {
  const options = normalizeOptions(tree, schema);

  if (tree.exists(options.entryIndexPath)) {
    throw new Error(
      `Secondary entry point "${options.entryPointPath}" already exists for project "${options.projectName}".`
    );
  }

  createEntryPointFiles(tree, options);
  updateBuildTargetOptions(tree, options);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default secondaryEntryPointGenerator;

function normalizeOptions(
  tree: Tree,
  schema: SecondaryEntryPointGeneratorSchema
): NormalizedOptions {
  if (!schema.project) {
    throw new Error('The "--project" option is required.');
  }
  if (!schema.name) {
    throw new Error('The "--name" option is required.');
  }

  const projectConfiguration = readProjectConfiguration(tree, schema.project);
  const projectRoot = projectConfiguration.root;
  const sourceRoot =
    projectConfiguration.sourceRoot ?? joinPathFragments(projectRoot, 'src');

  const entryPointSegments = sanitizePathSegments(schema.name);
  if (!entryPointSegments.length) {
    throw new Error(
      `The provided entry point name "${schema.name}" did not produce a valid path.`
    );
  }

  const entryPointPath = entryPointSegments.join('/');
  const entryFileName = entryPointSegments[entryPointSegments.length - 1];
  const entryFolder = joinPathFragments(sourceRoot, entryPointPath);
  const entryIndexPath = joinPathFragments(entryFolder, 'index.ts');
  const entrySourceRelativeToProjectRoot = normalizePath(
    joinPathFragments('src', entryPointPath, 'index.ts')
  );
  const viteEntryKey = `${entryPointPath}/index`;

  return {
    projectName: schema.project,
    projectConfiguration,
    projectRoot,
    sourceRoot,
    entryPointSegments,
    entryPointPath,
    entryFileName,
    entryFolder,
    entryIndexPath,
    buildTargetName: schema.buildTarget ?? 'build',
    entrySourceRelativeToProjectRoot,
    viteEntryKey,
  };
}

function sanitizePathSegments(input: string): string[] {
  return input
    .split(/[\\/]/g)
    .map((segment) => names(segment).fileName)
    .filter((segment) => !!segment);
}

function createEntryPointFiles(tree: Tree, options: NormalizedOptions) {
  const templateOptions = {
    tmpl: '',
    ...names(options.entryFileName),
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    options.entryFolder,
    templateOptions
  );
}

function updateBuildTargetOptions(tree: Tree, options: NormalizedOptions) {
  const projectConfiguration = options.projectConfiguration;
  const buildTarget = projectConfiguration.targets?.[options.buildTargetName];

  if (!buildTarget) {
    throw new Error(
      `Project "${options.projectName}" does not define a "${options.buildTargetName}" target.`
    );
  }

  const executor = buildTarget.executor ?? '';

  if (GENERATE_EXPORTS_EXECUTORS.has(executor)) {
    const updated = configureAdditionalEntryPoints(
      projectConfiguration,
      buildTarget,
      options
    );

    if (updated) {
      updateProjectConfiguration(
        tree,
        options.projectName,
        projectConfiguration
      );
    }

    return;
  }

  if (isViteExecutor(executor)) {
    updateViteConfig(tree, options);
    return;
  }

  logger.warn(
    `Skipping automatic configuration for secondary entry point "${options.entryPointPath}" on project "${options.projectName}" because the build executor "${executor}" is not supported yet. Please update the configuration manually.`
  );
}

const GENERATE_EXPORTS_EXECUTORS = new Set<string>([
  '@nx/js:tsc',
  '@nx/js:swc',
  '@nx/rollup:rollup',
]);

function isViteExecutor(executor: string): boolean {
  return executor === '@nx/vite:build';
}

function configureAdditionalEntryPoints(
  projectConfiguration: ProjectConfiguration,
  buildTarget: TargetConfiguration,
  options: NormalizedOptions
): boolean {
  buildTarget.options ??= {};
  const targetOptions = buildTarget.options as {
    additionalEntryPoints?: string[];
    generateExportsField?: boolean;
  };

  const entryAbsolutePath = normalizePath(
    joinPathFragments(
      projectConfiguration.root,
      options.entrySourceRelativeToProjectRoot
    )
  );

  const existingEntries = Array.isArray(targetOptions.additionalEntryPoints)
    ? targetOptions.additionalEntryPoints.map((value) => normalizePath(value))
    : [];

  const initialList = Array.from(new Set(existingEntries)).sort();
  const updatedSet = new Set(initialList);
  updatedSet.add(entryAbsolutePath);
  const updatedList = Array.from(updatedSet).sort();

  let changed = !arraysEqual(initialList, updatedList);

  if (changed) {
    targetOptions.additionalEntryPoints = updatedList;
  }

  if (targetOptions.generateExportsField !== true) {
    targetOptions.generateExportsField = true;
    changed = true;
  }

  return changed;
}

function updateViteConfig(tree: Tree, options: NormalizedOptions) {
  const configPath = findViteConfigPath(tree, options.projectRoot);

  if (!configPath) {
    throw new Error(
      `Unable to locate a Vite configuration for project "${options.projectName}". Expected one of vite.config.ts|js|mts|mjs|cjs inside "${options.projectRoot}".`
    );
  }

  const buffer = tree.read(configPath);
  if (!buffer) {
    throw new Error(`Unable to read "${configPath}".`);
  }

  const originalContent = buffer.toString();
  const sourceFile = ts.createSourceFile(
    configPath,
    originalContent,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  let updated = false;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        getPropertyNameText(node.name) === 'lib' &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        const updatedInitializer = ensureLibEntryHasSecondary(
          node.initializer,
          options
        );

        if (updatedInitializer !== node.initializer) {
          updated = true;
          return ts.factory.updatePropertyAssignment(
            node,
            node.name,
            updatedInitializer
          );
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);

  try {
    if (!updated) {
      logger.warn(
        `Skipped updating "${configPath}" for project "${options.projectName}". Ensure the Vite configuration defines a build.lib.entry option so secondary entry points can be registered automatically.`
      );
      return;
    }

    const printer = ts.createPrinter({
      newLine: originalContent.includes('\r\n')
        ? ts.NewLineKind.CarriageReturnLineFeed
        : ts.NewLineKind.LineFeed,
    });
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;
    const updatedContent = printer.printFile(transformedSourceFile);
    tree.write(configPath, updatedContent);
  } finally {
    result.dispose();
  }
}

function findViteConfigPath(tree: Tree, projectRoot: string): string | null {
  const candidates = [
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ];

  for (const candidate of candidates) {
    const possiblePath = joinPathFragments(projectRoot, candidate);
    if (tree.exists(possiblePath)) {
      return possiblePath;
    }
  }

  return null;
}

function ensureLibEntryHasSecondary(
  libObject: ts.ObjectLiteralExpression,
  options: NormalizedOptions
): ts.ObjectLiteralExpression {
  const entryPropIndex = libObject.properties.findIndex(
    (prop) =>
      ts.isPropertyAssignment(prop) &&
      getPropertyNameText(prop.name) === 'entry'
  );

  const entryExpression = ts.factory.createStringLiteral(
    options.entrySourceRelativeToProjectRoot
  );

  if (entryPropIndex === -1) {
    const initializer = createEntryObjectLiteral(
      undefined,
      options.viteEntryKey,
      entryExpression
    );

    const entryProperty = ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier('entry'),
      initializer
    );

    return ts.factory.updateObjectLiteralExpression(libObject, [
      ...libObject.properties,
      entryProperty,
    ]);
  }

  const entryProp = libObject.properties[entryPropIndex];

  if (!ts.isPropertyAssignment(entryProp)) {
    return libObject;
  }

  const updatedInitializer = createEntryObjectLiteral(
    entryProp.initializer,
    options.viteEntryKey,
    entryExpression
  );

  if (updatedInitializer === entryProp.initializer) {
    return libObject;
  }

  const updatedEntryProp = ts.factory.updatePropertyAssignment(
    entryProp,
    entryProp.name,
    updatedInitializer
  );

  const updatedProperties = [...libObject.properties];
  updatedProperties[entryPropIndex] = updatedEntryProp;

  return ts.factory.updateObjectLiteralExpression(libObject, updatedProperties);
}

function createEntryObjectLiteral(
  existingInitializer: ts.Expression | undefined,
  entryKey: string,
  entryExpression: ts.Expression
): ts.ObjectLiteralExpression {
  if (
    existingInitializer &&
    ts.isObjectLiteralExpression(existingInitializer)
  ) {
    if (objectHasProperty(existingInitializer, entryKey)) {
      return existingInitializer;
    }

    const newProperty = ts.factory.createPropertyAssignment(
      createPropertyName(entryKey),
      entryExpression
    );

    return ts.factory.updateObjectLiteralExpression(existingInitializer, [
      ...existingInitializer.properties,
      newProperty,
    ]);
  }

  const indexProperty = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier('index'),
    existingInitializer ?? ts.factory.createStringLiteral('src/index.ts')
  );
  const newProperty = ts.factory.createPropertyAssignment(
    createPropertyName(entryKey),
    entryExpression
  );

  return ts.factory.createObjectLiteralExpression(
    [indexProperty, newProperty],
    true
  );
}

function objectHasProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  name: string
): boolean {
  return objectLiteral.properties.some(
    (prop) =>
      ts.isPropertyAssignment(prop) && getPropertyNameText(prop.name) === name
  );
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNumericLiteral(name.expression))
  ) {
    return name.expression.text;
  }

  return null;
}

function createPropertyName(name: string): ts.PropertyName {
  if (isSupportedIdentifier(name)) {
    return ts.factory.createIdentifier(name);
  }

  return ts.factory.createStringLiteral(name);
}

function isSupportedIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}
