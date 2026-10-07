// SPDX-License-Identifier: MIT
import { installPackagesTask, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { runInNewContext } from 'node:vm';
import { setupRspack } from './setup-rspack';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));

describe('native Rspack workspace setup', () => {
  beforeEach(() => jest.clearAllMocks());

  function fixture(root = 'packages/api', builder: unknown = 'rspack') {
    const tree = createTreeWithEmptyWorkspace();
    const at = (file: string) => (root ? `${root}/${file}` : file);
    writeJson(tree, at('nest-cli.json'), { compilerOptions: { builder } });
    writeJson(tree, at('package.json'), {
      name: 'api',
      scripts: { build: 'nest build' },
    });
    return { tree, at };
  }

  it.each(['', 'packages/api'])(
    'declares prerequisites and reports required installation for owner %j',
    async (root) => {
      const { tree, at } = fixture(root);
      const install = setupRspack(tree, root);
      expect(readJson(tree, at('package.json')).devDependencies).toEqual({
        '@rspack/core': '^2.1.10',
        'webpack-node-externals': '^3.0.0',
        'tsconfig-paths-webpack-plugin': '^4.2.0',
      });
      expect(installPackagesTask).not.toHaveBeenCalled();
      expect(install).toBe(true);
      expect(
        readJson(tree, at('nest-cli.json')).compilerOptions.builder
      ).toEqual({
        type: 'rspack',
        options: { configPath: 'rspack.config.cjs' },
      });
      const before = tree.listChanges();
      expect(setupRspack(tree, root)).toBe(false);
      expect(tree.listChanges()).toEqual(before);
    }
  );

  it('preserves dependency versions and custom manifest fields without requesting an unnecessary install', () => {
    const { tree, at } = fixture();
    const manifest = {
      name: 'api',
      dependencies: { '@rspack/core': '2.1.10' },
      optionalDependencies: { 'webpack-node-externals': '^3' },
      devDependencies: { 'tsconfig-paths-webpack-plugin': '^4' },
      installConfig: { hoistingLimits: 'workspaces' },
      scripts: { build: 'custom build' },
    };
    writeJson(tree, at('package.json'), manifest);
    expect(setupRspack(tree, 'packages/api')).toBe(false);
    expect(readJson(tree, at('package.json'))).toEqual(manifest);
    expect(installPackagesTask).not.toHaveBeenCalled();
    expect(tree.exists(at('rspack.config.cjs'))).toBe(true);
  });

  it.each(['rspack.config.js', 'custom.cjs'])(
    'preserves the existing %s configuration and its builder options',
    (file) => {
      const { tree, at } = fixture(
        'packages/api',
        file === 'custom.cjs'
          ? { type: 'rspack', options: { configPath: file, custom: true } }
          : 'rspack'
      );
      tree.write(at(file), 'module.exports = () => ({ custom: true });');
      const before = tree.read(at('nest-cli.json'), 'utf8');
      setupRspack(tree, 'packages/api');
      expect(tree.read(at('nest-cli.json'), 'utf8')).toBe(before);
      expect(tree.read(at(file), 'utf8')).toContain('custom: true');
      expect(tree.exists(at('rspack.config.cjs'))).toBe(false);
    }
  );

  it('does not overwrite an existing cjs config when selecting it', () => {
    const { tree, at } = fixture();
    tree.write(at('rspack.config.cjs'), 'module.exports = {};');
    setupRspack(tree, 'packages/api');
    expect(tree.read(at('rspack.config.cjs'), 'utf8')).toBe(
      'module.exports = {};'
    );
  });

  it('configures explicit member Rspack builders without changing other builders', () => {
    const { tree, at } = fixture('packages/api', 'tsc');
    writeJson(tree, at('nest-cli.json'), {
      compilerOptions: { builder: 'tsc' },
      projects: {
        worker: {
          compilerOptions: {
            builder: { type: 'rspack', options: { custom: true } },
          },
        },
        custom: {
          compilerOptions: {
            builder: { type: 'rspack', options: { configPath: 'missing.cjs' } },
          },
        },
      },
    });
    setupRspack(tree, 'packages/api');
    const config = readJson(tree, at('nest-cli.json'));
    expect(config.compilerOptions.builder).toBe('tsc');
    expect(config.projects.worker.compilerOptions.builder.options).toEqual({
      custom: true,
      configPath: 'rspack.config.cjs',
    });
    expect(
      config.projects.custom.compilerOptions.builder.options.configPath
    ).toBe('missing.cjs');
  });

  it.each([undefined, 'tsc', { type: 'swc' }])(
    'leaves non-Rspack builder %j untouched',
    (builder) => {
      const { tree } = fixture('packages/api', builder ?? 'tsc');
      const before = tree.listChanges();
      expect(setupRspack(tree, 'packages/api')).toBe(false);
      expect(tree.listChanges()).toEqual(before);
    }
  );

  it.each([true, false])(
    'extends native defaults with workspace externals (ESM=%s)',
    (esm) => {
      const { tree, at } = fixture();
      setupRspack(tree, 'packages/api');
      const module = { exports: undefined as unknown };
      const external = jest.fn(() => 'workspace-externals');
      runInNewContext(tree.read(at('rspack.config.cjs'), 'utf8') ?? '', {
        module,
        __dirname: '/workspace/packages/api',
        require: (name: string) =>
          name === 'webpack-node-externals' ? external : require(name),
      });
      const factory = module.exports as (
        options: Record<string, unknown>
      ) => Record<string, unknown>;
      const options = {
        output: { module: esm },
        plugins: [{}],
        module: { rules: [{}] },
        externals: ['native'],
      };
      const result = factory(options);
      expect(result).toEqual({
        ...options,
        externals: ['native', 'workspace-externals'],
      });
      expect(result.output).toBe(options.output);
      expect(result.plugins).toBe(options.plugins);
      expect(result.module).toBe(options.module);
      expect(external).toHaveBeenCalledWith({
        modulesDir: '/workspace/packages/api/node_modules',
        additionalModuleDirs: [
          '/workspace/packages/node_modules',
          '/workspace/node_modules',
        ],
        importType: esm ? 'module' : 'commonjs',
      });
    }
  );
});
