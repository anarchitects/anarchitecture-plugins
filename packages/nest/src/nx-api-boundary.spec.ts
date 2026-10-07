// SPDX-License-Identifier: MIT
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { preProcessFile } from 'typescript';

// Keep this allowlist aligned with the audit in README.md. A new entry needs a
// public-API review; private APIs must stay behind a documented nx-compat adapter.
const publicNxEntrypoints = new Set(['@nx/devkit']);

function unreviewedNxImports(source: string): string[] {
  return preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter(
      (specifier) =>
        /^(?:nx(?:\/|$)|@nx\/)/.test(specifier) &&
        !publicNxEntrypoints.has(specifier)
    );
}

function implementationFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return implementationFiles(path);
    return /\.[cm]?[jt]s$/.test(entry.name) &&
      !/\.(?:spec|test)\./.test(entry.name)
      ? [path]
      : [];
  });
}

describe('Nest public Nx API boundary', () => {
  it.each([
    "import { helper } from 'nx/src/private';",
    "import type { Context } from '@nx/devkit/src/private';",
    "export { helper } from '@nx/js/src/private';",
    "export type { Context } from 'nx/dist/src/private';",
    "type Context = import('@nx/devkit/dist/private').Context;",
    "const helper = require('nx/src/private');",
    "const helper = import('@nx/js/internal/private');",
    "import helper = require('@nx/devkit/src/private');",
  ])('detects an internal dependency in %s', (source) => {
    expect(unreviewedNxImports(source)).toHaveLength(1);
  });

  it('requires review of new Nx entrypoints, including potentially public ones', () => {
    expect(unreviewedNxImports("import { helper } from '@nx/js';")).toEqual([
      '@nx/js',
    ]);
  });

  it('allows the audited public entrypoint and unrelated imports, ignoring comments', () => {
    expect(
      unreviewedNxImports(`
        import { createNodesFromFiles, type CreateNodes } from '@nx/devkit';
        export type { TargetConfiguration } from '@nx/devkit';
        const devkit = require('@nx/devkit');
        import { join } from 'node:path';
        import * as ts from 'typescript';
        import { createNestBuildTarget } from './utils/build-target';
        // import { helper } from 'nx/src/private';
      `)
    ).toEqual([]);
  });

  it.each(['src', 'dist'])(
    'uses only audited public Nx entrypoints in %s implementation and declarations',
    (directory) => {
      const packageRoot = resolve(__dirname, '..');
      const files = implementationFiles(join(packageRoot, directory));
      expect(files.length).toBeGreaterThan(0);
      const violations = files.flatMap((file) =>
        unreviewedNxImports(readFileSync(file, 'utf8')).map((specifier) => ({
          file: relative(packageRoot, file),
          specifier,
        }))
      );
      expect(violations).toEqual([]);
    }
  );
});
