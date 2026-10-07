// SPDX-License-Identifier: MIT
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  dependencies,
  packageRoot,
  nx,
  write,
  usePackedPlugin,
} from '../packed-plugin';
import { fixtures } from '../fixtures';

describe('packed Nest contracts', () => {
  const suite = usePackedPlugin();
  it('uses pinned stable Nest v12 application and CLI packages', () => {
    for (const name of [
      '@nestjs/cli',
      '@nestjs/common',
      '@nestjs/core',
      '@nestjs/platform-express',
      '@nestjs/microservices',
      '@nestjs/swagger',
    ]) {
      const version = JSON.parse(
        readFileSync(join(packageRoot(name), 'package.json'), 'utf8')
      ).version;
      expect(version).toMatch(/^12\.\d+\.\d+$/);
      expect(version).toBe(dependencies[name]);
    }
  });

  it('rejects an incompatible declared framework without partial registration', () => {
    const root = suite.createWorkspace(fixtures[0]);
    try {
      const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
      );
      manifest.dependencies['@nestjs/common'] = '^11.0.0';
      write(root, 'package.json', manifest);
      const before = readFileSync(join(root, 'nx.json'), 'utf8');
      expect(() =>
        nx(root, ['generate', '@anarchitects/nest:init', '--no-interactive'])
      ).toThrow('@nestjs/common@^11.0.0');
      expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
