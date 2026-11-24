import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Follow resolution from each package, not the consumer root: Nx can retain an
// independent minimatch version. Check the entire plugin-owned ts-morph tree.
export function verifyTypeormAstDependencies(pluginRoot) {
  const visited = new Set();
  const minimatches = [];
  const packages = [];
  function visit(name, parentManifest) {
    const require = createRequire(parentManifest);
    let directory = dirname(require.resolve(name));
    let manifestPath;
    let manifest;
    while (true) {
      manifestPath = join(directory, 'package.json');
      if (existsSync(manifestPath)) {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.name === name) break;
      }
      const parent = dirname(directory);
      assert.notEqual(parent, directory, `Cannot locate ${name} manifest`);
      directory = parent;
    }
    const identity = realpathSync(manifestPath);
    if (visited.has(identity)) return;
    visited.add(identity);
    packages.push(`${name}@${manifest.version}`);
    if (name === 'minimatch') {
      const [major, minor, patch] = manifest.version.split('.').map(Number);
      assert(
        major > 11 || (major === 11 && (minor > 0 || patch >= 1)),
        `Plugin ts-morph path retains minimatch@${manifest.version} affected by GHSA-g3hv-75wg-m249`
      );
      minimatches.push(manifest.version);
    }
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      visit(dependency, manifestPath);
    }
  }
  visit('ts-morph', join(pluginRoot, 'package.json'));
  assert(minimatches.length > 0, 'Expected to inspect ts-morph minimatch');
  console.log(`Verified plugin AST dependency tree: ${packages.join(', ')}`);
}
