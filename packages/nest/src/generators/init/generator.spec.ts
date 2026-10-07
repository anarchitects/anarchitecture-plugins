// SPDX-License-Identifier: MIT
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, writeJson, type Tree } from '@nx/devkit';
import { initGenerator } from './generator';

const plugin = '@anarchitects/nest/plugin';
let tree: Tree;
beforeEach(() => {
  tree = createTreeWithEmptyWorkspace();
  writeJson(tree, 'package.json', {
    private: true,
    devDependencies: { '@nestjs/cli': '^12.0.0' },
    dependencies: { '@nestjs/core': '12.1.2', '@nestjs/common': '~12.1.0' },
  });
});

function snapshot() {
  return tree
    .listChanges()
    .map(({ path, content, type }) => [path, content?.toString(), type]);
}

describe('Nest init generator', () => {
  it('registers once, preserves the workspace, and never edits dependencies or Nest files', () => {
    const nxJson = {
      plugins: ['existing-plugin'],
      namedInputs: { production: ['default'] },
      targetDefaults: { build: { cache: false } },
    };
    writeJson(tree, 'nx.json', nxJson);
    writeJson(tree, 'nest-cli.json', { sourceRoot: 'custom' });
    const manifest = tree.read('package.json')?.toString();
    const nestConfig = tree.read('nest-cli.json')?.toString();
    expect(initGenerator(tree)).toBeUndefined();
    expect(readJson(tree, 'nx.json')).toEqual({
      ...nxJson,
      plugins: ['existing-plugin', plugin],
    });
    const first = snapshot();
    initGenerator(tree);
    expect(snapshot()).toEqual(first);
    expect(tree.read('package.json')?.toString()).toBe(manifest);
    expect(tree.read('nest-cli.json')?.toString()).toBe(nestConfig);
  });

  it('creates nx.json when absent and configures custom names', () => {
    tree.delete('nx.json');
    initGenerator(tree, {
      buildTargetName: 'compile',
      startTargetName: 'serve',
    });
    expect(readJson(tree, 'nx.json').plugins).toEqual([
      {
        plugin,
        options: { buildTargetName: 'compile', startTargetName: 'serve' },
      },
    ]);
  });

  it.each([plugin, '@anarchitects/nest'])(
    'preserves an existing string registration %s',
    (name) => {
      tree.write(
        'nx.json',
        `{\n // keep this comment\n "plugins": ["${name}"]\n}`
      );
      const before = snapshot();
      initGenerator(tree);
      expect(snapshot()).toEqual(before);
      initGenerator(tree, { startTargetName: 'serve' });
      expect(readJson(tree, 'nx.json').plugins).toEqual([
        { plugin: name, options: { startTargetName: 'serve' } },
      ]);
    }
  );

  it('merges only supplied names into every scoped registration, retaining options and order', () => {
    const first = {
      plugin,
      include: ['apps/**'],
      exclude: ['apps/legacy/**'],
      options: {
        buildTargetName: 'compile',
        startTargetName: 'run',
        futureOption: true,
      },
    };
    const second = {
      plugin,
      include: ['services/**'],
      options: { buildTargetName: 'bundle' },
    };
    writeJson(tree, 'nx.json', { plugins: [first, 'other', second] });
    const unchanged = snapshot();
    initGenerator(tree);
    expect(snapshot()).toEqual(unchanged);
    const options = Object.freeze({ startTargetName: 'serve' });
    initGenerator(tree, options);
    expect(readJson(tree, 'nx.json').plugins).toEqual([
      { ...first, options: { ...first.options, startTargetName: 'serve' } },
      'other',
      { ...second, options: { ...second.options, startTargetName: 'serve' } },
    ]);
    const updated = snapshot();
    initGenerator(tree, options);
    expect(snapshot()).toEqual(updated);
  });

  it.each([
    { buildTargetName: '' },
    { startTargetName: '  ' },
    { buildTargetName: 'start' },
    { startTargetName: 'build' },
    { buildTargetName: 'run', startTargetName: 'run' },
  ])('rejects invalid options %j without edits', (options) => {
    const before = snapshot();
    expect(() => initGenerator(tree, options)).toThrow(/must be/);
    expect(snapshot()).toEqual(before);
  });

  it('detects collisions with preserved names and across scoped entries before changing anything', () => {
    writeJson(tree, 'nx.json', {
      plugins: [
        plugin,
        { plugin, include: ['apps/**'], options: { buildTargetName: 'serve' } },
      ],
    });
    const before = snapshot();
    expect(() => initGenerator(tree, { startTargetName: 'serve' })).toThrow(
      'must be different'
    );
    expect(snapshot()).toEqual(before);
  });

  it('accepts project-local dependencies and skips ignored dependency trees', () => {
    writeJson(tree, 'package.json', { private: true });
    writeJson(tree, 'services/api/package.json', {
      devDependencies: { '@nestjs/cli': '12.0.0' },
      dependencies: { '@nestjs/core': '^12', '@nestjs/common': '^12' },
    });
    tree.write('.gitignore', 'legacy/\n');
    writeJson(tree, 'legacy/package.json', {
      dependencies: { '@nestjs/core': '11.0.0' },
    });
    writeJson(tree, 'node_modules/bad/package.json', {
      dependencies: { '@nestjs/core': '11.0.0' },
    });
    initGenerator(tree);
    expect(readJson(tree, 'nx.json').plugins).toEqual([plugin]);
  });

  it('rejects nested incompatible frameworks even with a supported root CLI', () => {
    writeJson(tree, 'apps/old/package.json', {
      dependencies: { '@nestjs/common': '^11.0.0' },
    });
    const before = snapshot();
    expect(() => initGenerator(tree)).toThrow(
      'apps/old/package.json (dependencies): @nestjs/common@^11.0.0'
    );
    expect(snapshot()).toEqual(before);
  });

  it('requires a declared CLI and recommends installation without writing packages', () => {
    writeJson(tree, 'package.json', {
      dependencies: { '@nestjs/core': '^12' },
    });
    const before = snapshot();
    expect(() => initGenerator(tree)).toThrow('yarn add -D @nestjs/cli@^12');
    expect(snapshot()).toEqual(before);
  });

  it('requires a workspace manifest', () => {
    tree.delete('package.json');
    const before = snapshot();
    expect(() => initGenerator(tree)).toThrow(
      'requires a workspace package.json'
    );
    expect(snapshot()).toEqual(before);
  });
});
