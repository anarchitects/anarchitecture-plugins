// SPDX-License-Identifier: MIT
/** Consumer-owned configuration for compiling source-only Nest packages. */
export function sourceConsumerRspackConfig(packages: string[]) {
  return `
const { builtinModules } = require('node:module');
const { resolve } = require('node:path');
const nodeExternals = require('webpack-node-externals');
module.exports = (options) => ({
  ...options,
  // Replace the default externalizer too: it must not externalize source-only
  // workspace packages before the allowlist below can take effect.
  externals: [
    nodeExternals({
      modulesDir: resolve(__dirname, 'node_modules'),
      additionalModuleDirs: [resolve(__dirname, '../../node_modules')],
      allowlist: ${JSON.stringify(packages)},
      importType: 'module',
    }),
    ({ request }, callback) => {
      const bare = request?.replace(/^node:/, '');
      return bare && builtinModules.includes(bare)
        ? callback(null, 'module ' + request) : callback();
    },
  ],
});
`;
}

export const sourceConsumerVitestConfig = `
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
export default defineConfig({
  plugins: [swc.vite({
    tsconfigFile: false, swcrc: false, module: { type: 'es6' },
    jsc: { parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true } },
  })],
  test: { globals: true, environment: 'node', reporters: ['verbose'], include: ['src/**/*.spec.ts'] },
});
`;
