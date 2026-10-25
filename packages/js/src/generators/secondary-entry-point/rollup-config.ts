import { joinPathFragments, logger, type Tree } from '@nx/devkit';
import { parse } from 'node:path/posix';
import * as ts from 'typescript';

/** Update tool-owned inputs, without forwarding removed executor options to Rollup. */
export function updateRollupConfig(
  tree: Tree,
  root: string,
  entryName: string,
  entryPath: string
): void {
  const path = ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts']
    .map((extension) => joinPathFragments(root, `rollup.config.${extension}`))
    .find((candidate) => tree.exists(candidate));
  if (!path) return;
  const source = tree.read(path, 'utf8')!;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const property = (object: ts.ObjectLiteralExpression, name: string) =>
    object.properties.find(
      (item): item is ts.PropertyAssignment =>
        ts.isPropertyAssignment(item) &&
        (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
        item.name.text === name
    );
  let changed = false;
  const updateInput = (
    object: ts.ObjectLiteralExpression,
    fallback?: ts.Expression
  ): ts.ObjectLiteralExpression => {
    // A spread could override the primary input; leave dynamic configs intact.
    if (
      object.properties.some(
        (item) =>
          !ts.isPropertyAssignment(item) || ts.isComputedPropertyName(item.name)
      )
    )
      return object;
    const output = property(object, 'output')?.initializer;
    // Multiple inputs require output.dir; preserve a single-file output intact.
    if (
      output &&
      (!ts.isObjectLiteralExpression(output) ||
        property(output, 'file') ||
        output.properties.some(
          (item) =>
            !ts.isPropertyAssignment(item) ||
            ts.isComputedPropertyName(item.name)
        ))
    )
      return object;
    const input = property(object, 'input');
    const existing = input?.initializer ?? fallback;
    if (!existing) return object;
    let entries: readonly ts.ObjectLiteralElementLike[];
    if (ts.isObjectLiteralExpression(existing)) {
      if (
        existing.properties.some(
          (item) =>
            !ts.isPropertyAssignment(item) ||
            ts.isComputedPropertyName(item.name)
        )
      )
        return object;
      if (property(existing, entryName)) return object;
      entries = existing.properties;
    } else if (ts.isStringLiteral(existing)) {
      entries = [
        ts.factory.createPropertyAssignment(
          ts.factory.createStringLiteral(parse(existing.text).name),
          existing
        ),
      ];
    } else {
      return object;
    }
    changed = true;
    const updated = ts.factory.createPropertyAssignment(
      'input',
      ts.factory.createObjectLiteralExpression(
        [
          ...entries,
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral(entryName),
            ts.factory.createStringLiteral(entryPath)
          ),
        ],
        true
      )
    );
    return ts.factory.updateObjectLiteralExpression(
      object,
      input
        ? object.properties.map((item) => (item === input ? updated : item))
        : [...object.properties, updated]
    );
  };
  const updateExport = (expression: ts.Expression): ts.Expression => {
    if (ts.isObjectLiteralExpression(expression))
      return updateInput(expression);
    if (!ts.isCallExpression(expression)) return expression;
    const [options, config] = expression.arguments;
    // Nx's supported Rollup helper remains available in Nx 24. Its first
    // argument owns `main`; the second owns native Rollup `input` and outputs.
    if (
      expression.expression.getText(file) === 'withNx' &&
      expression.arguments.length <= 2 &&
      /(?:from\s*|require\s*\(\s*)['"]@nx\/rollup\/with-nx['"]/.test(source) &&
      options &&
      ts.isObjectLiteralExpression(options) &&
      !options.properties.some(ts.isSpreadAssignment) &&
      !property(options, 'additionalEntryPoints') &&
      !property(options, 'outputFileName') &&
      (!config || ts.isObjectLiteralExpression(config))
    ) {
      const original = config ?? ts.factory.createObjectLiteralExpression();
      const updated = updateInput(
        original as ts.ObjectLiteralExpression,
        property(options, 'main')?.initializer
      );
      if (updated !== original)
        return ts.factory.updateCallExpression(
          expression,
          expression.expression,
          expression.typeArguments,
          [options, updated]
        );
    }
    return expression;
  };
  const result = ts.transform(file, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isExportAssignment(node))
          return ts.factory.updateExportAssignment(
            node,
            node.modifiers,
            updateExport(node.expression)
          );
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          node.left.getText(file) === 'module.exports'
        ) {
          return ts.factory.updateBinaryExpression(
            node,
            node.left,
            node.operatorToken,
            updateExport(node.right)
          );
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  try {
    if (changed) {
      tree.write(
        path,
        ts
          .createPrinter({
            newLine: source.includes('\r\n')
              ? ts.NewLineKind.CarriageReturnLineFeed
              : ts.NewLineKind.LineFeed,
          })
          .printFile(result.transformed[0])
      );
    } else {
      logger.warn(
        `Preserved custom ${path}. Add "${entryName}": "${entryPath}" to the Rollup input map manually.`
      );
    }
    logger.warn(
      'Rollup package exports are consumer-owned. Add the secondary export to your package manifest if it is published.'
    );
  } finally {
    result.dispose();
  }
}
