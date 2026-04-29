import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pluginEntry, {
  createNodesV2 as pluginCreateNodesV2,
} from './plugins/nest.js';
import plugin, { createNodesV2, name } from './index.js';

describe('nest package shell', () => {
  it('exports plugin metadata and inference hooks', () => {
    expect(name).toBe('@anarchitects/nest');
    expect(createNodesV2).toBeDefined();
    expect(plugin).toEqual({
      name: '@anarchitects/nest',
      createNodesV2,
    });
  });

  it('exposes a public plugin entrypoint wrapper', () => {
    expect(pluginEntry).toEqual(plugin);
    expect(pluginCreateNodesV2).toBe(createNodesV2);
  });

  it('declares empty manifest placeholders', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const manifestPath = join(currentDir, 'index.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      executors: Record<string, unknown>;
      generators: Record<string, unknown>;
    };

    expect(manifest).toEqual({
      executors: {},
      generators: {},
    });
  });

  it('declares explicit public exports for the package root and plugin entrypoint', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(currentDir, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        '.': expect.objectContaining({
          import: './dist/index.js',
        }),
        './plugin': expect.objectContaining({
          import: './dist/plugins/nest.js',
        }),
      })
    );
  });
});
