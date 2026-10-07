// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('published package shell', () => {
  const packageRoot = resolve(__dirname, '..');
  let consumerRoot: string;
  let installedPackage: string;
  let packedFiles: string[];

  beforeAll(() => {
    consumerRoot = mkdtempSync(join(tmpdir(), 'nx-nest-package-'));
    installedPackage = join(consumerRoot, 'node_modules/@anarchitects/nest');
    mkdirSync(installedPackage, { recursive: true });

    const [pack] = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          '--json',
          '--ignore-scripts',
          '--pack-destination',
          consumerRoot,
        ],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          env: { ...process.env, npm_config_cache: join(consumerRoot, '.npm') },
        }
      )
    );
    packedFiles = pack.files.map((file: { path: string }) => file.path);
    execFileSync('tar', [
      '-xzf',
      join(consumerRoot, pack.filename),
      '-C',
      installedPackage,
      '--strip-components=1',
    ]);
  }, 30_000);

  afterAll(() => {
    if (consumerRoot) rmSync(consumerRoot, { recursive: true, force: true });
  });

  it('runs the stable Nest v12 CLI baseline', () => {
    const version = execFileSync(
      process.execPath,
      [require.resolve('@nestjs/cli/bin/nest.js'), '--version'],
      { cwd: packageRoot, encoding: 'utf8' }
    );
    expect(version.trim()).toBe('12.0.0');
  });

  it('ships every public runtime and type export, documentation, and MIT license', () => {
    const manifest = JSON.parse(
      readFileSync(join(installedPackage, 'package.json'), 'utf8')
    );
    for (const entrypoint of ['.', './plugin']) {
      for (const condition of ['types', 'import', 'default']) {
        expect(
          existsSync(
            join(installedPackage, manifest.exports[entrypoint][condition])
          )
        ).toBe(true);
      }
    }
    expect(manifest.license).toBe('MIT');
    expect(readFileSync(join(installedPackage, 'LICENSE'), 'utf8')).toContain(
      'MIT License'
    );
    expect(packedFiles).toEqual(
      expect.arrayContaining(['package.json', 'README.md', 'LICENSE'])
    );
    expect(
      packedFiles.some((file) =>
        /(?:\.spec\.|\.tsbuildinfo$|^src\/)/.test(file)
      )
    ).toBe(false);
  });

  it.each(['commonjs', 'module'])(
    'loads public exports from a standalone %s consumer',
    (mode) => {
      const script =
        mode === 'commonjs'
          ? `const { name } = require('@anarchitects/nest');
         const plugin = require('@anarchitects/nest/plugin');
         const manifest = require('@anarchitects/nest/package.json');`
          : `import { name } from '@anarchitects/nest';
         import * as plugin from '@anarchitects/nest/plugin';
         import { createRequire } from 'node:module';
         const manifest = createRequire(import.meta.url)('@anarchitects/nest/package.json');`;

      const output = execFileSync(
        process.execPath,
        [
          `--input-type=${mode}`,
          '-e',
          `${script}
       console.log(JSON.stringify([name, plugin.name, manifest.name]));`,
        ],
        { cwd: consumerRoot, encoding: 'utf8' }
      );
      expect(JSON.parse(output)).toEqual([
        '@anarchitects/nest/plugin',
        '@anarchitects/nest/plugin',
        '@anarchitects/nest',
      ]);
    }
  );
});
