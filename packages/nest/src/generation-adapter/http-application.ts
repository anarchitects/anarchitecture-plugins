// SPDX-License-Identifier: MIT
import * as ts from 'typescript';
import { satisfies } from 'semver';
import type { TreeSnapshot } from './tree-snapshot';
import {
  httpPlatforms,
  httpRuntimeVersion,
  type HttpPlatform,
} from '../utils/http-platform';

function nodes<T extends ts.Node>(
  source: ts.Node,
  predicate: (node: ts.Node) => node is T
): T[] {
  const found: T[] = [];
  function visit(node: ts.Node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

/** Fastify must finish registering routes before native Supertest assertions. */
function fastifyReadiness(
  source: ts.SourceFile,
  creation: ts.CallExpression,
  fail: () => never
): { start: number; end: number; text: string } | undefined {
  const assignment = creation.parent;
  if (
    !ts.isBinaryExpression(assignment) ||
    assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    assignment.right !== creation ||
    !ts.isIdentifier(assignment.left) ||
    !ts.isExpressionStatement(assignment.parent) ||
    !ts.isBlock(assignment.parent.parent)
  )
    return fail();
  const name = assignment.left.text;
  const bindings = nodes(source, ts.isIdentifier).filter(
    (node) =>
      node.text === name &&
      (ts.isVariableDeclaration(node.parent) ||
        ts.isParameter(node.parent) ||
        ts.isFunctionDeclaration(node.parent) ||
        ts.isClassDeclaration(node.parent) ||
        ts.isImportSpecifier(node.parent)) &&
      node.parent.name === node
  );
  if (bindings.length !== 1) return fail();
  const calls = nodes(source, ts.isCallExpression);
  const init = calls.filter(
    (node) =>
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === name &&
      node.expression.name.text === 'init'
  );
  if (
    init.length !== 1 ||
    init[0].arguments.length ||
    !ts.isAwaitExpression(init[0].parent) ||
    !ts.isExpressionStatement(init[0].parent.parent)
  )
    return fail();
  const statement = init[0].parent.parent;
  const block = assignment.parent.parent;
  if (
    statement.parent !== block ||
    block.statements.indexOf(statement) !==
      block.statements.indexOf(assignment.parent) + 1
  )
    return fail();
  const ready = `${name}.getHttpAdapter().getInstance().ready`;
  const existing = calls.filter(
    (node) => node.expression.getText(source).replace(/\s/g, '') === ready
  );
  if (existing.length) {
    const call = existing[0];
    if (
      existing.length !== 1 ||
      call.arguments.length ||
      !ts.isAwaitExpression(call.parent) ||
      !ts.isExpressionStatement(call.parent.parent) ||
      call.parent.parent.parent !== block ||
      block.statements.indexOf(call.parent.parent) !==
        block.statements.indexOf(statement) + 1
    )
      return fail();
    return undefined;
  }
  const start = statement.end;
  const lineStart =
    source.text.lastIndexOf('\n', statement.getStart(source)) + 1;
  const indent =
    source.text
      .slice(lineStart, statement.getStart(source))
      .match(/^[\t ]*/)?.[0] ?? '';
  const newline = source.text.includes('\r\n') ? '\r\n' : '\n';
  return { start, end: start, text: `${newline}${indent}await ${ready}();` };
}

/** A bounded edit of native HTTP entry points; never a migration of user source. */
export function httpSource(
  content: string,
  path: string,
  kind: 'bootstrap' | 'test',
  platform: HttpPlatform = 'node'
): string {
  const {
    packageName: adapterPackage,
    adapter: adapterName,
    application: applicationType,
    requiresReady,
  } = httpPlatforms[platform];
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const fail = (): never => {
    throw new Error(
      `Cannot safely select ${adapterName} in ${path}: expected an unambiguous native Nest HTTP ${kind}. Restore native output or use a fresh destination.`
    );
  };
  const imports = nodes(source, ts.isImportDeclaration);
  function binding(module: string, exported: string) {
    const matches = imports.flatMap((statement) => {
      const named = statement.importClause?.namedBindings;
      return ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === module &&
        named &&
        ts.isNamedImports(named)
        ? named.elements
            .filter(
              (entry) =>
                (entry.propertyName?.text ?? entry.name.text) === exported
            )
            .map((entry) => ({ statement, entry }))
        : [];
    });
    if (matches.length > 1) fail();
    return matches[0];
  }
  const factory =
    kind === 'bootstrap'
      ? binding('@nestjs/core', 'NestFactory')
      : binding('@nestjs/testing', 'TestingModule');
  if (!factory) return fail();
  let receiver = factory.entry.name.text;
  if (kind === 'test') {
    const fixtures = nodes(source, ts.isVariableDeclaration).filter(
      (node) =>
        node.type &&
        ts.isTypeReferenceNode(node.type) &&
        node.type.typeName.getText(source) === receiver
    );
    if (fixtures.length !== 1 || !ts.isIdentifier(fixtures[0].name))
      return fail();
    receiver = fixtures[0].name.text;
  }
  // A local binding must not shadow the imported factory or typed test fixture.
  const declarations = nodes(source, ts.isIdentifier).filter(
    (node) =>
      node.text === receiver &&
      (ts.isVariableDeclaration(node.parent) ||
        ts.isParameter(node.parent) ||
        ts.isFunctionDeclaration(node.parent) ||
        ts.isClassDeclaration(node.parent) ||
        ts.isImportSpecifier(node.parent)) &&
      node.parent.name === node
  );
  if (declarations.length !== 1) return fail();
  const calls = nodes(source, ts.isCallExpression).filter(
    (node) =>
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === receiver &&
      node.expression.name.text ===
        (kind === 'bootstrap' ? 'create' : 'createNestApplication')
  );
  if (calls.length !== 1) return fail();
  const call = calls[0];
  const readyEdit =
    kind === 'test' && requiresReady
      ? fastifyReadiness(source, call, fail)
      : undefined;
  const adapter = binding(adapterPackage, adapterName);
  const appType = binding(adapterPackage, applicationType);
  const adapterIndex = kind === 'bootstrap' ? 1 : 0;
  const explicit = call.arguments[adapterIndex];
  if (adapter || appType) {
    if (
      !adapter ||
      !appType ||
      adapter.entry.name.text !== adapterName ||
      appType.entry.name.text !== applicationType ||
      adapter.statement.importClause?.isTypeOnly ||
      adapter.entry.isTypeOnly ||
      !(
        appType.statement.importClause?.isTypeOnly || appType.entry.isTypeOnly
      ) ||
      !explicit ||
      !ts.isNewExpression(explicit) ||
      explicit.expression.getText(source) !== adapterName ||
      explicit.arguments?.length !== 0 ||
      call.typeArguments?.length !== 1 ||
      call.typeArguments[0].getText(source) !== applicationType ||
      binding('@nestjs/common', 'INestApplication') ||
      readyEdit
    )
      return fail();
    return content;
  }
  if (
    nodes(source, ts.isIdentifier).some(
      (node) => node.text === adapterName || node.text === applicationType
    )
  )
    return fail();
  if (
    call.typeArguments?.length ||
    (kind === 'bootstrap'
      ? call.arguments.length < 1 ||
        call.arguments.length > 2 ||
        (call.arguments[1] && !ts.isObjectLiteralExpression(call.arguments[1]))
      : call.arguments.length !== 0)
  )
    return fail();

  const edits: { start: number; end: number; text: string }[] = readyEdit
    ? [readyEdit]
    : [];
  const replace = (node: ts.Node, text: string) =>
    edits.push({ start: node.getStart(source), end: node.end, text });
  edits.push({
    start: call.expression.end,
    end: call.expression.end,
    text: `<${applicationType}>`,
  });
  const insertion = kind === 'bootstrap' ? call.arguments[0].end : call.end - 1;
  edits.push({
    start: insertion,
    end: insertion,
    text: `${kind === 'bootstrap' ? ', ' : ''}new ${adapterName}()`,
  });
  if (kind === 'test') {
    const oldType = binding('@nestjs/common', 'INestApplication');
    if (!oldType) return fail();
    const refs = nodes(source, ts.isTypeReferenceNode).filter(
      (node) => node.typeName.getText(source) === oldType.entry.name.text
    );
    if (refs.length !== 1 || refs[0].typeArguments?.length !== 1) return fail();
    const supertest =
      binding('supertest/types.js', 'App') ?? binding('supertest/types', 'App');
    if (
      !supertest ||
      refs[0].typeArguments[0].getText(source) !== supertest.entry.name.text
    )
      return fail();
    for (const old of [oldType, supertest]) {
      const named = old.statement.importClause?.namedBindings;
      // Remove only sole imports used exclusively by the replaced annotation.
      if (
        !named ||
        !ts.isNamedImports(named) ||
        named.elements.length !== 1 ||
        old.statement.importClause?.name ||
        nodes(source, ts.isIdentifier).filter(
          (node) => node.text === old.entry.name.text
        ).length !== 2
      )
        return fail();
      replace(old.statement, '');
    }
    replace(refs[0], applicationType);
  }
  const importEnd = imports.at(-1)?.end;
  if (importEnd === undefined) return fail();
  edits.push({
    start: importEnd,
    end: importEnd,
    text: `\nimport { ${adapterName} } from '${adapterPackage}';\nimport type { ${applicationType} } from '${adapterPackage}';`,
  });
  for (const edit of edits.sort((a, b) => b.start - a.start))
    content =
      content.slice(0, edit.start) + edit.text + content.slice(edit.end);
  return content;
}

/** Transform only the fresh native application snapshot, before conflict checks. */
export function transformHttpApplication(
  snapshot: TreeSnapshot,
  root: string,
  schematicVersion: string,
  platform: HttpPlatform = 'node'
): void {
  const { packageName: adapterPackage, label } = httpPlatforms[platform];
  if (schematicVersion !== '12.0.6')
    throw new Error(
      `${label} application generation requires audited @nestjs/schematics 12.0.6; found ${schematicVersion}. Reinstall the plugin's pinned dependencies.`
    );
  const manifestPath = `${root}/package.json`;
  const bytes = snapshot.get(manifestPath);
  if (!bytes)
    throw new Error(`Missing native application manifest: ${manifestPath}`);
  const manifest = JSON.parse(bytes.toString());
  for (const [section, names] of [
    [
      'dependencies',
      [
        '@nestjs/common',
        '@nestjs/core',
        ...(platform !== 'node' ? ['@nestjs/platform-express'] : []),
      ],
    ],
    ['devDependencies', ['@nestjs/testing']],
  ] as const) {
    for (const name of names) {
      const range = manifest[section]?.[name];
      if (typeof range !== 'string' || !satisfies(httpRuntimeVersion, range))
        throw new Error(
          `${manifestPath}: ${name}@${String(
            range
          )} does not admit the audited ${label} runtime ${httpRuntimeVersion}.`
        );
      manifest[section][name] = httpRuntimeVersion;
    }
  }
  manifest.dependencies[adapterPackage] = httpRuntimeVersion;
  // Yarn normalizes dependency order on install. Emit that order up front so
  // installation alone does not turn a repeated generation into a conflict.
  manifest.dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b))
  );
  const updates = new Map<string, Buffer>();
  const main = `${root}/src/main.ts`;
  const mainContent = snapshot.get(main);
  if (!mainContent)
    throw new Error(
      `${label} generation requires TypeScript: missing ${main}.`
    );
  updates.set(
    main,
    Buffer.from(httpSource(mainContent.toString(), main, 'bootstrap', platform))
  );
  for (const [path, content] of snapshot) {
    if (path.startsWith(`${root}/test/`) && /\/app\.e2e-.+\.ts$/.test(path))
      updates.set(
        path,
        Buffer.from(httpSource(content.toString(), path, 'test', platform))
      );
  }
  updates.set(
    manifestPath,
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
  );
  for (const [path, content] of updates) snapshot.set(path, content);
}
