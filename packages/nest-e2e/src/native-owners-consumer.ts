// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { usePackedPlugin, nx, write, snapshotFiles } from './packed-plugin';
import { fixtures } from './fixtures';

export function assertNativeOwners(
  suite: ReturnType<typeof usePackedPlugin>,
  mode: string
) {
  const root = suite.createWorkspace({
    ...fixtures[0],
    name: `multi-owner-${mode}`,
    files: {},
  });
  try {
    const collection = JSON.parse(
      readFileSync(
        join(root, 'node_modules/@anarchitects/nest/generators.json'),
        'utf8'
      )
    ) as {
      generators: Record<string, { aliases?: string[] }>;
    };
    // Exercise native aliases in ESM and canonical names in CJS.
    const generate = (name: string, ...args: string[]) =>
      nx(root, [
        'generate',
        '@anarchitects/nest:' +
          (mode === 'esm'
            ? collection.generators[name].aliases?.[0] ?? name
            : name),
        ...args,
        '--no-interactive',
      ]);
    generate(
      'application',
      'backend',
      '--directory=services/team/backend',
      `--type=${mode}`
    );
    generate(
      'application',
      'other',
      '--directory=services/other',
      `--type=${mode === 'esm' ? 'cjs' : 'esm'}`
    );
    generate('sub-app', 'worker', '--project=backend');
    generate('sub-app', 'worker', '--project=other');
    generate('library', 'shared', '--project=backend');
    const otherBefore = snapshotFiles(join(root, 'services/other'));
    const owner = join(root, 'services/team/backend');
    const defaultModule = readFileSync(
      join(owner, 'apps/backend/src/app.module.ts'),
      'utf8'
    );
    const workerModule = join(owner, 'apps/worker/src/worker.module.ts');
    const beforePreview = readFileSync(workerModule, 'utf8');
    generate(
      'resource',
      'preview',
      '--project=backend-worker',
      '--crud=false',
      '--dry-run'
    );
    expect(existsSync(join(owner, 'apps/worker/src/preview'))).toBe(false);
    expect(readFileSync(workerModule, 'utf8')).toBe(beforePreview);
    generate(
      'resource',
      'users',
      '--project=backend-worker',
      '--crud=false',
      '--spec=false'
    );
    const artifacts = [
      ['class', ''],
      ['interface', '.interface'],
      ['module', '.module'],
      ['provider', ''],
      ['service', '.service'],
      ['controller', '.controller'],
      ['decorator', '.decorator'],
      ['filter', '.filter'],
      ['gateway', '.gateway'],
      ['guard', '.guard'],
      ['interceptor', '.interceptor'],
      ['middleware', '.middleware'],
      ['pipe', '.pipe'],
      ['resolver', '.resolver'],
    ];
    for (const [name, suffix] of artifacts) {
      const args = [
        'feature-' + name,
        '--project=backend-worker',
        '--path=features',
        '--flat=true',
      ];
      if (!['interface', 'module', 'decorator'].includes(name))
        args.push('--spec=false');
      // Transport setup is consumer-owned. Check these sources and their
      // aliases without registering unconfigured transports in the build.
      if (['gateway', 'resolver'].includes(name)) args.push('--skipImport');
      generate(name, ...args);
      const file = join(
        owner,
        'apps/worker/src/features',
        'feature-' + name + suffix + '.ts'
      );
      expect(existsSync(file)).toBe(true);
      expect(
        existsSync(
          join(
            root,
            'services/other/apps/worker/src/features',
            'feature-' + name + suffix + '.ts'
          )
        )
      ).toBe(false);
    }
    generate(
      'service',
      'shared-logic',
      '--project=backend',
      '--nestProject=shared',
      '--spec=false'
    );
    expect(
      existsSync(
        join(owner, 'libs/shared/src/shared-logic/shared-logic.service.ts')
      )
    ).toBe(true);
    expect(
      readFileSync(join(owner, 'apps/backend/src/app.module.ts'), 'utf8')
    ).toBe(defaultModule);
    expect(readFileSync(workerModule, 'utf8')).toContain(
      './users/users.module' + (mode === 'esm' ? '.js' : '')
    );
    expect(readFileSync(workerModule, 'utf8')).not.toContain('Gateway');
    expect(readFileSync(workerModule, 'utf8')).not.toContain('Resolver');
    expect(snapshotFiles(join(root, 'services/other'))).toEqual(otherBefore);
    const beforeAmbiguous = snapshotFiles(owner);
    expect(() => generate('service', 'ambiguous')).toThrow('unambiguous');
    expect(snapshotFiles(owner)).toEqual(beforeAmbiguous);
    write(root, 'services/legacy/project.json', { name: 'legacy' });
    generate('configuration', '--project=legacy');
    const legacy = JSON.parse(
      nx(root, ['show', 'project', 'legacy', '--json'])
    );
    expect(legacy.targets.build.options).toEqual({
      command: 'nest build',
      cwd: 'services/legacy',
    });
    const projects = JSON.parse(nx(root, ['show', 'projects', '--json']));
    expect(projects).toEqual(
      expect.arrayContaining([
        'backend',
        'backend-worker',
        'backend-shared',
        'other',
        'other-worker',
        'legacy',
      ])
    );
    symlinkSync(
      join(root, 'node_modules'),
      join(owner, 'node_modules'),
      'junction'
    );
    nx(root, ['run', 'backend-worker:build', '--outputStyle=static']);
    expect(existsSync(join(owner, 'dist/apps/worker/main.js'))).toBe(true);
    expect(snapshotFiles(join(root, 'services/other'))).toEqual(otherBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
