// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { usePackedPlugin, nx, assertStarts } from '../packed-plugin';
import { fixtures } from '../fixtures';

describe('packed Nest configuration', () => {
  const suite = usePackedPlugin();
  it.each(['module', 'commonjs'] as const)(
    'builds an existing %s application after native configuration generation',
    async (moduleType) => {
      const fixture = {
        ...fixtures[0],
        name: `configuration-${moduleType}`,
        moduleType,
      };
      const root = suite.createWorkspace(fixture);
      try {
        rmSync(join(root, 'nest-cli.json'));
        nx(root, ['generate', '@anarchitects/nest:config', '--no-interactive']);
        const config = JSON.parse(
          readFileSync(join(root, 'nest-cli.json'), 'utf8')
        );
        expect(config).toEqual({
          $schema: 'https://json.schemastore.org/nest-cli',
          collection: '@nestjs/schematics',
          sourceRoot: 'src',
        });
        const project = JSON.parse(
          nx(root, ['show', 'project', fixture.name, '--json'])
        );
        expect(project.targets.build.options).toEqual({
          command: 'nest build',
          cwd: '.',
        });
        expect(project.targets.start.options).toEqual({
          command: 'nest start',
          cwd: '.',
        });
        nx(root, ['run', `${fixture.name}:build`, '--outputStyle=static']);
        expect(existsSync(join(root, fixture.emittedMain))).toBe(true);
        await assertStarts(root, `${fixture.name}:start`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
