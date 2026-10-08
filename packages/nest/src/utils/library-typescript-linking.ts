// SPDX-License-Identifier: MIT
import { readJson, updateJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';

interface TsConfig {
  extends?: string;
  files?: string[];
  include?: string[];
  references?: { path: string }[];
  compilerOptions?: {
    composite?: boolean;
    declaration?: boolean;
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

const baseFile = 'tsconfig.base.json';
const solutionFile = 'tsconfig.json';

/** Validate linking before generation; commit root metadata only after success. */
export function planLibraryTypeScriptLinking(
  tree: Tree,
  name: string,
  root: string
) {
  const base = tree.exists(baseFile)
    ? readJson<TsConfig>(tree, baseFile)
    : undefined;
  const solution = tree.exists(solutionFile)
    ? readJson<TsConfig>(tree, solutionFile)
    : undefined;
  const empty = (value: unknown) => Array.isArray(value) && !value.length;
  const solutionLayout =
    solution &&
    (empty(solution.files) || empty(solution.include)) &&
    (solution.files === undefined || empty(solution.files)) &&
    (solution.include === undefined || empty(solution.include));
  if (
    solutionLayout &&
    solution.references !== undefined &&
    (!Array.isArray(solution.references) ||
      solution.references.some((entry) => typeof entry?.path !== 'string'))
  )
    throw new Error(
      'Cannot link the Nest library: invalid tsconfig.json references.'
    );
  // Existing solution references take precedence over legacy aliases. Also
  // recognize an empty Nx solution before it has its first project reference.
  const references =
    solutionLayout &&
    (Array.isArray(solution.references) ||
      (typeof solution.extends === 'string' &&
        solution.extends.replace(/^\.\//, '') === baseFile &&
        base?.compilerOptions?.composite === true &&
        base.compilerOptions.declaration !== false));
  const paths = base?.compilerOptions?.paths;
  const mode = references
    ? 'references'
    : paths !== undefined
    ? 'paths'
    : 'standalone';
  const relative = (file: string) => {
    const path = posix.relative(root, file);
    return path.startsWith('.') ? path : `./${path}`;
  };
  const compilerOptions = {
    target: 'ES2023',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    strict: true,
    skipLibCheck: true,
  };
  const tsconfig = {
    ...(base && mode !== 'standalone' ? { extends: relative(baseFile) } : {}),
    compilerOptions,
    files: [],
    include: [],
    references: [{ path: './tsconfig.lib.json' }],
  };
  const tsconfigLib = {
    extends: './tsconfig.json',
    compilerOptions: {
      // Alias consumers compile dependency source in the same TS program.
      rootDir: mode === 'paths' ? relative('.') : 'src',
      outDir: 'dist',
      composite: mode !== 'paths',
      declaration: true,
      ...(mode !== 'paths'
        ? { tsBuildInfoFile: 'dist/tsconfig.lib.tsbuildinfo' }
        : {}),
    },
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    ...(mode === 'references' ? { references: [] } : {}),
  };

  let commit: () => void = () => undefined;
  if (mode === 'references') {
    commit = () => {
      const current = readJson<TsConfig>(tree, solutionFile);
      const existing = current.references ?? [];
      if (
        existing.some(({ path }) =>
          [root, `${root}/tsconfig.json`, `${root}/tsconfig.lib.json`].includes(
            posix.normalize(path).replace(/\/$/, '')
          )
        )
      )
        return;
      updateJson(tree, solutionFile, (json) => ({
        ...json,
        references: [...existing, { path: `./${root}` }],
      }));
    };
  } else if (mode === 'paths') {
    if (!paths || typeof paths !== 'object' || Array.isArray(paths))
      throw new Error(
        'Cannot link the Nest library: invalid tsconfig.base.json paths.'
      );
    const baseUrl = base?.compilerOptions?.baseUrl ?? '.';
    if (typeof baseUrl !== 'string' || posix.isAbsolute(baseUrl))
      throw new Error(
        'Cannot link the Nest library: use a workspace-relative baseUrl.'
      );
    const entrypoint = `${root}/src/index.ts`;
    if (
      Object.hasOwn(paths, name) &&
      (!Array.isArray(paths[name]) ||
        paths[name].length !== 1 ||
        typeof paths[name][0] !== 'string' ||
        posix.normalize(posix.join(baseUrl, paths[name][0])) !== entrypoint)
    )
      throw new Error(
        `TypeScript alias "${name}" already exists with a different entrypoint.`
      );
    const relativeAlias = posix.relative(baseUrl, entrypoint);
    // Without baseUrl, TypeScript requires explicitly relative path mappings.
    const alias =
      base?.compilerOptions?.baseUrl === undefined &&
      !relativeAlias.startsWith('.')
        ? `./${relativeAlias}`
        : relativeAlias;
    commit = () => {
      const current = readJson<TsConfig>(tree, baseFile);
      if (Object.hasOwn(current.compilerOptions?.paths ?? {}, name)) return;
      updateJson(tree, baseFile, (json) => ({
        ...json,
        compilerOptions: {
          ...json.compilerOptions,
          paths: { ...json.compilerOptions.paths, [name]: [alias] },
        },
      }));
    };
  }
  return { mode, tsconfig, tsconfigLib, commit };
}
