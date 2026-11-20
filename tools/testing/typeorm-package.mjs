import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const packageRoot = join(workspaceRoot, 'packages/typeorm');
const temporary = mkdtempSync(join(tmpdir(), 'nx-typeorm-package-'));

try {
  const [artifact] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
    })
  );
  const archive = join(temporary, artifact.filename);
  const packedPaths = new Set(artifact.files.map(({ path }) => path));
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8')
  );
  assert.equal(artifact.name, manifest.name);
  assert(
    packedPaths.has(manifest.main),
    `Missing built entry: ${manifest.main}`
  );

  for (const [name, sourceRoot] of [
    ['LICENSE', workspaceRoot],
    ['NOTICE', workspaceRoot],
    ['README.md', packageRoot],
  ]) {
    assert(
      packedPaths.has(name),
      `Missing package/${name} in ${artifact.filename}`
    );
    const packed = execFileSync('tar', ['-xOf', archive, `package/${name}`]);
    assert.deepEqual(
      packed,
      readFileSync(join(sourceRoot, name)),
      `Packed ${name} differs from its source`
    );
  }
  console.log(
    `Verified LICENSE, NOTICE, and README.md in ${artifact.filename}`
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
