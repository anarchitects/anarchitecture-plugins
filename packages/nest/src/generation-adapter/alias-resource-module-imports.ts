// SPDX-License-Identifier: MIT
import * as ts from 'typescript';
import type { TreeSnapshot } from './tree-snapshot';

function importsArray(
  source: ts.SourceFile
): ts.ArrayLiteralExpression | undefined {
  let result: ts.ArrayLiteralExpression | undefined;
  let found = false;
  function visit(node: ts.Node): void {
    if (found) return;
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text.toLowerCase() === 'module'
    ) {
      found = true;
      const metadata = node.expression.arguments[0];
      if (metadata && ts.isObjectLiteralExpression(metadata)) {
        const property = metadata.properties.find(
          (entry) =>
            ts.isPropertyAssignment(entry) &&
            (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) &&
            entry.name.text === 'imports'
        );
        if (
          property &&
          ts.isPropertyAssignment(property) &&
          ts.isArrayLiteralExpression(property.initializer)
        )
          result = property.initializer;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

function bindings(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  function add(name: ts.BindingName): void {
    if (ts.isIdentifier(name)) names.add(name.text);
    else
      for (const entry of name.elements)
        if (ts.isBindingElement(entry)) add(entry.name);
  }
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) add(clause.name);
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings))
          add(clause.namedBindings.name);
        else for (const entry of clause.namedBindings.elements) add(entry.name);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const entry of statement.declarationList.declarations)
        add(entry.name);
    } else if (
      (ts.isClassDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    )
      add(statement.name);
  }
  return names;
}

/** Repair only newly inserted native resource registrations in existing modules.
 * Templates, exported class names, and pre-existing references stay untouched.
 */
export function aliasResourceModuleImports(
  before: TreeSnapshot,
  after: TreeSnapshot
): void {
  for (const [path, previous] of before) {
    const next = after.get(path);
    if (!path.endsWith('.module.ts') || !next || previous.equals(next))
      continue;
    const oldSource = ts.createSourceFile(
      path,
      previous.toString(),
      ts.ScriptTarget.Latest,
      true
    );
    const source = ts.createSourceFile(
      path,
      next.toString(),
      ts.ScriptTarget.Latest,
      true
    );
    const oldBindings = bindings(oldSource);
    const occupied = bindings(source);
    const oldImports = new Set<string>();
    for (const statement of oldSource.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamedImports(named))
        for (const entry of named.elements)
          oldImports.add(
            `${statement.moduleSpecifier.text}:${
              entry.propertyName?.text ?? entry.name.text
            }:${entry.name.text}`
          );
    }
    const edits: { start: number; end: number; text: string }[] = [];
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !/^\.\.?\/.+\.module(?:\.js)?$/.test(statement.moduleSpecifier.text)
      )
        continue;
      const named = statement.importClause?.namedBindings;
      if (!named || !ts.isNamedImports(named)) continue;
      for (const entry of named.elements) {
        const symbol = entry.name.text;
        if (
          oldImports.has(
            `${statement.moduleSpecifier.text}:${
              entry.propertyName?.text ?? symbol
            }:${symbol}`
          )
        )
          continue;
        if (!oldBindings.has(symbol)) continue;
        const stem = symbol.replace(/Module$/, '') + 'ResourceModule';
        let alias = stem;
        for (let index = 2; occupied.has(alias); index++) alias = stem + index;
        occupied.add(alias);
        const oldArray = importsArray(oldSource);
        const array = importsArray(source);
        const oldElements =
          oldArray?.elements.map((item) => item.getText(oldSource)) ?? [];
        const elements = array?.elements.map((item) => item.getText(source));
        if (!array || !elements)
          throw new Error(
            `Cannot safely alias resource module registration in ${path}; use --skipImport and register it explicitly.`
          );
        if (
          elements.length === oldElements.length + 1 &&
          elements.at(-1) === symbol &&
          oldElements.every((item, index) => item === elements[index])
        ) {
          const inserted = array.elements[array.elements.length - 1];
          edits.push({
            start: inserted.getStart(source),
            end: inserted.end,
            text: alias,
          });
        } else if (
          oldElements.includes(symbol) &&
          JSON.stringify(elements) === JSON.stringify(oldElements)
        ) {
          // Nest deduplicates by symbol text, which here refers to the old binding.
          const last = array.elements[array.elements.length - 1];
          edits.push({ start: last.end, end: last.end, text: `, ${alias}` });
        } else
          throw new Error(
            `Cannot safely alias resource module registration in ${path}; use --skipImport and register it explicitly.`
          );
        edits.push({
          start: entry.getStart(source),
          end: entry.end,
          text: `${entry.propertyName?.text ?? symbol} as ${alias}`,
        });
      }
    }
    let content = next.toString();
    for (const edit of edits.sort((a, b) => b.start - a.start))
      content =
        content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    if (edits.length) after.set(path, Buffer.from(content));
  }
}
