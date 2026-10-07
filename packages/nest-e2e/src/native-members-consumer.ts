// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { usePackedPlugin, nx } from './packed-plugin';
import { fixtures } from './fixtures';

export function assertNativeMembers(
  suite: ReturnType<typeof usePackedPlugin>,
  type: string
) {
  const root = suite.createWorkspace({
    ...fixtures[0],
    name: `generated-${type}`,
    files: {},
  });
  try {
    nx(root, [
      'generate',
      '@anarchitects/nest:application',
      'backend',
      '--directory=services/backend',
      `--type=${type}`,
      '--no-interactive',
    ]);
    nx(root, [
      'generate',
      '@anarchitects/nest:sub-app',
      'worker',
      '--project=backend',
      '--no-interactive',
    ]);
    nx(root, [
      'generate',
      '@anarchitects/nest:library',
      'shared',
      '--project=backend',
      '--prefix=@domain',
      '--no-interactive',
    ]);
    for (const member of ['worker', 'shared']) {
      nx(root, [
        'generate',
        '@anarchitects/nest:resource',
        'users',
        `--project=backend-${member}`,
        '--crud=false',
        '--spec=false',
        '--no-interactive',
      ]);
      for (const [schematic, name] of [
        ['class', 'model'],
        ['interface', 'contract'],
        ['module', 'feature'],
        ['provider', 'cache'],
        ['service', 'logic'],
        ['controller', 'health'],
        ['decorator', 'roles'],
        ['filter', 'errors'],
        ['guard', 'access'],
        ['interceptor', 'logging'],
        ['middleware', 'request'],
        ['pipe', 'validation'],
      ]) {
        const args = [
          'generate',
          `@anarchitects/nest:${schematic}`,
          name,
          `--project=backend-${member}`,
          '--no-interactive',
        ];
        if (!['interface', 'module', 'decorator'].includes(schematic))
          args.push('--spec=false');
        nx(root, args);
      }
    }
    // Model dependencies installed for this native Nest package. Its default
    // Rspack externals discovery reads node_modules from the package cwd.
    symlinkSync(
      join(root, 'node_modules'),
      join(root, 'services/backend/node_modules'),
      'junction'
    );
    for (const [name, directory] of [
      ['worker', 'apps'],
      ['shared', 'libs'],
    ]) {
      const project = JSON.parse(
        nx(root, ['show', 'project', `backend-${name}`, '--json'])
      );
      expect(project.targets.build.options).toEqual({
        command: `nest build '${name}'`,
        cwd: 'services/backend',
      });
      if (name === 'shared') expect(project.targets.start).toBeUndefined();
      nx(root, ['run', `backend-${name}:build`, '--outputStyle=static']);
      const output = join(root, 'services/backend/dist', directory, name);
      expect(
        existsSync(join(output, name === 'worker' ? 'main.js' : 'index.js'))
      ).toBe(true);
      rmSync(output, { recursive: true, force: true });
      expect(
        nx(root, ['run', `backend-${name}:build`, '--outputStyle=static'])
      ).toMatch(/\[local cache\]|read the output from the cache/);
      expect(
        existsSync(join(output, name === 'worker' ? 'main.js' : 'index.js'))
      ).toBe(true);
    }
    const config = JSON.parse(
      readFileSync(join(root, 'services/backend/nest-cli.json'), 'utf8')
    );
    expect(config.projects.worker.root).toBe('apps/worker');
    expect(config.projects.shared.root).toBe('libs/shared');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
