import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import plugin, { name } from './index.js';

describe('nest package shell', () => {
  it('exports plugin metadata without runtime hooks', () => {
    expect(name).toBe('@anarchitects/nest');
    expect(plugin).toEqual({ name: '@anarchitects/nest' });
    expect(plugin).not.toHaveProperty('createNodesV2');
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
});
