// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInstalledConsumer } from './installed-consumer';

export function assertVitestConsumer(root: string, tarball: string) {
  const { yarn, yarnConfig } = createInstalledConsumer(root, tarball);
  const owner = join(root, 'packages/api');
  const generate = (name: string, ...args: string[]) => {
    const command = [
      'nx',
      'g',
      `@anarchitects/nest:${name}`,
      ...args,
      '--no-interactive',
    ];
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
    yarn([...command, '--dry-run']);
    expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
    yarn(command);
  };
  generate(
    'application',
    'api',
    '--directory=packages/api',
    '--packageManager=yarn'
  );
  yarn(['install']);

  const run = (target: string, expected: string[]) => {
    const report = `results-${target.replace(/:/g, '-')}.json`;
    try {
      yarn([
        'nx',
        'run',
        `api:${target}`,
        '--skipNxCache',
        '--reporter=json',
        `--outputFile=${report}`,
      ]);
    } catch (error) {
      throw new Error(
        `${String(error)}\n${
          existsSync(join(owner, report))
            ? readFileSync(join(owner, report), 'utf8')
            : ''
        }`
      );
    }
    const results = JSON.parse(readFileSync(join(owner, report), 'utf8'));
    expect(results.success).toBe(true);
    const files = results.testResults.map((result: { name: string }) =>
      relative(realpathSync(owner), result.name).replace(/\\/g, '/')
    );
    expect(files.sort()).toEqual([...expected].sort());
    expect(results.numPassedTests).toBe(expected.length);
  };
  run('test', ['src/app.controller.spec.ts']);
  run('test:e2e', ['test/app.e2e-spec.ts']);
  generate('resource', 'users', '--project=api', '--type=rest', '--crud=true');
  const source = readFileSync(
    join(owner, 'src/users/users.controller.ts'),
    'utf8'
  );
  generate('sub-app', 'worker', '--project=api');
  generate('library', 'shared', '--project=api');
  expect(existsSync(join(owner, 'src'))).toBe(false);
  expect(existsSync(join(owner, 'test'))).toBe(false);
  expect(
    readFileSync(join(owner, 'apps/api/src/users/users.controller.ts'), 'utf8')
  ).toBe(source);

  // Exercise constructor injection and path aliases in a library, not only
  // the generated empty service. This requires emitted decorator metadata.
  writeFileSync(
    join(owner, 'libs/shared/src/injection.spec.ts'),
    `
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SharedService } from '@app/shared';
@Injectable()
class Consumer {
  constructor(readonly shared: SharedService) {}
}
it('injects the library service using decorator metadata', async () => {
  const module = await Test.createTestingModule({ providers: [Consumer, SharedService] }).compile();
  expect(module.get(Consumer).shared).toBeInstanceOf(SharedService);
  await module.close();
});
`
  );
  const units = [
    'apps/api/src/app.controller.spec.ts',
    'apps/api/src/users/users.controller.spec.ts',
    'apps/api/src/users/users.service.spec.ts',
    'apps/worker/src/worker.controller.spec.ts',
    'libs/shared/src/shared.service.spec.ts',
    'libs/shared/src/injection.spec.ts',
  ];
  run('test', units);
  run('test:e2e', [
    'apps/api/test/app.e2e-spec.ts',
    'apps/worker/test/app.e2e-spec.ts',
  ]);
  const project = JSON.parse(
    yarn(['nx', 'show', 'project', 'api', '--json'], undefined, true)
  );
  expect(project.targets['vitest:test'].cache).toBe(true);
  expect(project.targets['vitest:test'].options.cwd).toBe('packages/api');
  expect(project.namedInputs.default).toContain(
    '{workspaceRoot}/packages/api/**/*'
  );
  run('vitest:test', units);
  const cachedCommand = [
    'nx',
    'run',
    'api:vitest:test',
    '--output-style=static',
  ];
  yarn(cachedCommand);
  const librarySpec = join(owner, 'libs/shared/src/injection.spec.ts');
  const before = readFileSync(librarySpec, 'utf8');
  try {
    writeFileSync(
      librarySpec,
      before +
        "\nit('invalidates the owner cache', () => expect(true).toBe(false));\n"
    );
    expect(() => yarn(cachedCommand)).toThrow(/invalidates the owner cache/);
  } finally {
    writeFileSync(librarySpec, before);
  }
  expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
}
