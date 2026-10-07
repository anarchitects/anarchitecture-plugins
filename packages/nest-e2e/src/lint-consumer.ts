// SPDX-License-Identifier: MIT
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInstalledConsumer } from './installed-consumer';

/** Prove lint checks active source and tests, including after cache warm-up. */
export function assertLintConsumer(
  root: string,
  tarball: string,
  type: string
) {
  const { yarn } = createInstalledConsumer(root, tarball);
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
    '--packageManager=yarn',
    `--type=${type}`
  );
  const config = readFileSync(join(owner, '.oxlintrc.json'), 'utf8');
  const nxFile = join(root, 'nx.json');
  const nx = JSON.parse(readFileSync(nxFile, 'utf8'));
  nx.targetDefaults = { lint: { cache: true, inputs: ['default'] } };
  writeFileSync(nxFile, JSON.stringify(nx));
  const lint = ['nx', 'run', 'api:lint', '--output-style=static'];
  const checkViolation = (path: string) => {
    const file = join(owner, path);
    const source = readFileSync(file, 'utf8');
    yarn(lint);
    try {
      // A type-aware rule from the unchanged native config, not a syntax error.
      writeFileSync(file, source + '\nPromise.resolve(536);\n');
      let failure = '';
      try {
        yarn(lint);
      } catch (error) {
        failure = String(error);
      }
      expect(failure).toContain('no-floating-promises');
      expect(failure).toContain(path);
    } finally {
      writeFileSync(file, source);
    }
  };
  checkViolation('src/app.service.ts');
  // Library-first keeps standalone src/test active; custom roots must work too.
  generate('library', 'shared', '--project=api', '--rootDir=modules');
  checkViolation('modules/shared/src/shared.service.ts');
  checkViolation('test/app.e2e-spec.ts');
  generate('sub-app', 'worker', '--project=api', '--rootDir=services');
  expect(existsSync(join(owner, 'src'))).toBe(false);
  expect(existsSync(join(owner, 'test'))).toBe(false);
  expect(readFileSync(join(owner, '.oxlintrc.json'), 'utf8')).toBe(config);
  if (type === 'cjs') {
    // The pinned CJS sub-app template has a real unhandled bootstrap promise.
    // Detect it before applying the documented, consumer-owned source repair.
    expect(() => yarn(lint)).toThrow(/no-floating-promises/);
    const main = join(owner, 'services/worker/src/main.ts');
    const source = readFileSync(main, 'utf8');
    expect(source).toMatch(/^bootstrap\(\);$/m);
    writeFileSync(
      main,
      source.replace(/^bootstrap\(\);$/m, 'void bootstrap();')
    );
  }
  for (const path of [
    'services/api/src/app.service.ts',
    'services/worker/src/worker.controller.spec.ts',
    'services/api/test/app.e2e-spec.ts',
    'modules/shared/src/shared.service.ts',
    'modules/shared/src/shared.service.spec.ts',
  ])
    checkViolation(path);
  // Output files must never make an otherwise clean source lint fail.
  for (const path of [
    'dist/broken.js',
    'coverage/broken.js',
    'modules/shared/dist/broken.js',
  ]) {
    const file = join(owner, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'this is not valid JavaScript !!!');
  }
  yarn([...lint, '--skipNxCache']);
  const ownerProject = JSON.parse(
    yarn(['nx', 'show', 'project', 'api', '--json'], undefined, true)
  );
  expect(ownerProject.namedInputs.default).toContain(
    '{workspaceRoot}/packages/api/**/*'
  );
  const member = JSON.parse(
    yarn(['nx', 'show', 'project', 'api-worker', '--json'], undefined, true)
  );
  expect(member.targets.lint).toBeUndefined();
}
