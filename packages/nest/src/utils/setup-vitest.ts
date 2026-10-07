// SPDX-License-Identifier: MIT
import {
  addDependenciesToPackageJson,
  logger,
  NX_VERSION,
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { posix } from 'node:path';
import { dependencyState } from './dependency-install';
import * as ts from 'typescript';
import { includeNestOwnerFiles } from './include-nest-owner-files';

/** Use Nest's documented SWC integration and delegate task inference to Nx. */
export function setupVitest(tree: Tree, ownerRoot: string): boolean {
  const before = dependencyState(tree, ['', ownerRoot]);
  const at = (file: string) => posix.join(ownerRoot, file);
  const configs = ['vitest.config.ts', 'vitest.config.e2e.ts'].filter((file) =>
    tree.exists(at(file))
  );
  if (!configs.length) return false;
  // A converted Nest root is a TS solution (files: [], app references only).
  // Give path resolution a test-wide config that also includes library specs.
  if (!tree.exists(at('tsconfig.spec.json'))) {
    writeJson(tree, at('tsconfig.spec.json'), {
      extends: './tsconfig.json',
      compilerOptions: { noEmit: true, types: ['vitest/globals', 'node'] },
      include: ['**/*.ts'],
      exclude: ['node_modules', 'dist'],
    });
  }
  for (const file of configs) {
    const source = tree.read(at(file), 'utf8');
    if (source === null) continue;
    const updated = addNestTransform(source);
    if (updated === undefined) {
      logger.warn(
        `Preserved custom ${at(
          file
        )}. Configure SWC with legacyDecorator and decoratorMetadata for Nest tests: https://docs.nestjs.com/recipes/swc#vitest`
      );
    } else if (source !== updated) tree.write(at(file), updated);
  }
  const manifest = readJson(tree, at('package.json'));
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  addDependenciesToPackageJson(
    tree,
    {},
    { '@swc/core': '^1.16.13', 'unplugin-swc': '^2.0.0' },
    at('package.json'),
    true
  );
  // Nx loads its inference plugin from the workspace root. Declare its peers
  // there too, including when the package manager keeps owner dependencies local.
  addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/vitest': NX_VERSION,
      vite: declared.vite ?? '^8.0.0',
      vitest: declared.vitest ?? '^4.0.0',
    },
    'package.json',
    true
  );
  const nxJson = readNxJson(tree);
  includeNestOwnerFiles(tree, ownerRoot);
  if (
    nxJson &&
    !nxJson.plugins?.some(
      (entry) =>
        (typeof entry === 'string' ? entry : entry.plugin) === '@nx/vitest'
    )
  ) {
    nxJson.plugins ??= [];
    // Keep Nest's package-script targets intact. This is also an alternate
    // target name used by Nx's own init generator when `test` already exists.
    nxJson.plugins.push({
      plugin: '@nx/vitest',
      options: { testTargetName: 'vitest:test', testMode: 'run' },
    });
    updateNxJson(tree, nxJson);
  }
  return before !== dependencyState(tree, ['', ownerRoot]);
}

/** Edit only a statically identifiable plugins array; preserve custom settings. */
export function addNestTransform(source: string): string | undefined {
  const file = ts.createSourceFile(
    'vitest.config.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  if (
    file.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === 'unplugin-swc'
    )
  )
    return source;
  const exported = file.statements.find(ts.isExportAssignment);
  if (!exported || !ts.isCallExpression(exported.expression)) return undefined;
  const config = exported.expression.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) return undefined;
  const plugins = config.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(file).replace(/['"]/g, '') === 'plugins'
  );
  if (
    !plugins ||
    !ts.isPropertyAssignment(plugins) ||
    !ts.isArrayLiteralExpression(plugins.initializer)
  )
    return undefined;
  const pathsImport = file.statements.find(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'vite-tsconfig-paths'
  );
  const pathsName =
    pathsImport && ts.isImportDeclaration(pathsImport)
      ? pathsImport.importClause?.name?.text
      : undefined;
  const pathsCall = plugins.initializer.elements.find(
    (element) =>
      ts.isCallExpression(element) &&
      element.expression.getText(file) === pathsName &&
      !element.arguments.length
  );
  if (pathsCall) {
    const end = pathsCall.end - 1;
    source =
      source.slice(0, end) +
      "{ projects: [import.meta.dirname + '/tsconfig.spec.json'] }" +
      source.slice(end);
  }
  let name = 'nestSwc';
  while (new RegExp(`\\b${name}\\b`).test(source)) name += '_';
  const position = plugins.initializer.getStart() + 1;
  const transform = `${name}.vite({
    tsconfigFile: false,
    swcrc: false,
    module: { type: 'es6' },
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  })`;
  return (
    `import ${name} from 'unplugin-swc';\n` +
    source.slice(0, position) +
    transform +
    (plugins.initializer.elements.length ? ', ' : '') +
    source.slice(position)
  );
}
