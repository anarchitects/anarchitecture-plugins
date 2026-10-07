// SPDX-License-Identifier: MIT
import {
  addDependenciesToPackageJson,
  readJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { posix } from 'node:path';
import { dependencyState } from './dependency-install';

interface CompilerConfig {
  compilerOptions?: {
    builder?: string | { type?: string; options?: { configPath?: string } };
  };
  projects?: Record<string, CompilerConfig>;
}

const compilerDependencies = {
  '@rspack/core': '^2.1.10',
  'webpack-node-externals': '^3.0.0',
  'tsconfig-paths-webpack-plugin': '^4.2.0',
};

/** Complete native Rspack setup while keeping Nest CLI in charge of compilation. */
export function setupRspack(tree: Tree, ownerRoot: string): boolean {
  const before = dependencyState(tree, ['', ownerRoot]);
  const at = (path: string) => posix.join(ownerRoot, path);
  const config = readJson<CompilerConfig>(tree, at('nest-cli.json'));
  const rspackConfigs = [
    config,
    ...Object.values(config.projects ?? {}),
  ].filter(({ compilerOptions }) => {
    const builder = compilerOptions?.builder;
    return (typeof builder === 'string' ? builder : builder?.type) === 'rspack';
  });
  if (!rspackConfigs.length) return false;

  const manifest = readJson(tree, at('package.json'));
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  const missing = Object.fromEntries(
    Object.entries(compilerDependencies).filter(([name]) => !declared[name])
  );
  addDependenciesToPackageJson(tree, {}, missing, at('package.json'), true);

  // Nest automatically loads rspack.config.js. An explicit configPath wins.
  // Leave either form of user configuration untouched, including missing paths.
  const needsConfig = rspackConfigs.filter(({ compilerOptions }) => {
    const builder = compilerOptions?.builder;
    return (
      !tree.exists(at('rspack.config.js')) &&
      !(typeof builder === 'object' && builder.options?.configPath)
    );
  });
  if (needsConfig.length) {
    const configPath = 'rspack.config.cjs';
    if (!tree.exists(at(configPath))) {
      const levels =
        ownerRoot && ownerRoot !== '.' ? ownerRoot.split('/').length : 0;
      tree.write(at(configPath), workspaceRspackConfig(levels));
    }
    for (const item of needsConfig) {
      if (!item.compilerOptions) continue;
      const builder = item.compilerOptions.builder;
      item.compilerOptions.builder = {
        ...(typeof builder === 'object' ? builder : { type: 'rspack' }),
        options: {
          ...(typeof builder === 'object' ? builder.options : {}),
          configPath,
        },
      };
    }
    writeJson(tree, at('nest-cli.json'), config);
  }

  return before !== dependencyState(tree, ['', ownerRoot]);
}

function workspaceRspackConfig(levels: number): string {
  return `// Keep Nest's compiler defaults and also externalize hoisted workspace packages.
const { resolve } = require('node:path');
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    ...(Array.isArray(options.externals)
      ? options.externals
      : options.externals ? [options.externals] : []),
    nodeExternals({
      modulesDir: resolve(__dirname, 'node_modules'),
      additionalModuleDirs: ${JSON.stringify(
        Array.from(
          { length: levels },
          (_, index) => '../'.repeat(index + 1) + 'node_modules'
        )
      )}.map(
        (directory) => resolve(__dirname, directory)
      ),
      importType: options.output?.module ? 'module' : 'commonjs',
    }),
  ],
});
`;
}
