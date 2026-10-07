// SPDX-License-Identifier: MIT
import { installPackagesTask, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addNestTransform, setupVitest } from './setup-vitest';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));

const config = `import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
  // Keep aliases and project-owned settings.
  plugins: [tsconfigPaths()],
  test: { globals: true, include: ['**/*.spec.ts'], testTimeout: 12345 },
});
`;

describe('Nest Vitest setup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds explicit decorator transformation once while retaining aliases and test settings', () => {
    const updated = addNestTransform(config);
    expect(updated).toContain('tsconfigFile: false');
    expect(updated).toContain('legacyDecorator: true, decoratorMetadata: true');
    expect(updated).toContain(
      "tsconfigPaths({ projects: [import.meta.dirname + '/tsconfig.spec.json'] })"
    );
    expect(updated).toContain("include: ['**/*.spec.ts'], testTimeout: 12345");
    expect(addNestTransform(updated ?? '')).toBe(updated);
  });

  it.each([
    'export default () => ({ plugins: [] });',
    'export default defineConfig({ plugins: customPlugins });',
    'export default defineConfig({ ...shared });',
  ])('leaves dynamic consumer configuration untouched: %s', (source) => {
    expect(addNestTransform(source)).toBeUndefined();
  });

  it('preserves an existing SWC integration and avoids import-name collisions', () => {
    const custom =
      "import swc from 'unplugin-swc';\nexport default custom(swc);";
    expect(addNestTransform(custom)).toBe(custom);
    expect(addNestTransform('const nestSwc = 1;\n' + config)).toContain(
      "import nestSwc_ from 'unplugin-swc'"
    );
  });

  it.each(['', 'services/api'])(
    'sets up owner %j with deferred installation and repeat safety',
    async (root) => {
      const tree = createTreeWithEmptyWorkspace();
      const at = (file: string) => (root ? `${root}/${file}` : file);
      writeJson(tree, at('package.json'), {
        name: 'api',
        devDependencies: { vitest: '^4.1.2', '@swc/core': '1.16.13' },
      });
      writeJson(tree, at('project.json'), {
        name: 'api',
        namedInputs: {
          default: ['defaultFiles'],
          defaultFiles: ['{projectRoot}/**/*'],
        },
      });
      tree.write(at('vitest.config.ts'), config);
      tree.write(
        at('vitest.config.e2e.ts'),
        config.replace('**/*.spec.ts', '**/*.e2e-spec.ts')
      );
      const install = setupVitest(tree, root);
      expect(installPackagesTask).not.toHaveBeenCalled();
      expect(install).toBeDefined();
      await install?.();
      expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
      expect(
        readJson(tree, at('package.json')).devDependencies['@swc/core']
      ).toBe('1.16.13');
      expect(readJson(tree, 'package.json').devDependencies['@nx/vitest']).toBe(
        '23.2.0'
      );
      expect(readJson(tree, 'nx.json').plugins).toContainEqual({
        plugin: '@nx/vitest',
        options: { testTargetName: 'vitest:test', testMode: 'run' },
      });
      expect(readJson(tree, at('project.json')).namedInputs.default).toEqual([
        'defaultFiles',
        root ? `{workspaceRoot}/${root}/**/*` : '{workspaceRoot}/**/*',
      ]);
      const before = tree.listChanges();
      expect(setupVitest(tree, root, true)).toBeUndefined();
      expect(tree.listChanges()).toEqual(before);
    }
  );

  it('preserves existing inference scopes, options, and dependency versions', () => {
    const tree = createTreeWithEmptyWorkspace();
    const registration = {
      plugin: '@nx/vitest',
      include: ['apps/**'],
      options: {
        testTargetName: 'check',
        testMode: 'watch',
        ciTargetName: 'check-ci',
      },
    };
    writeJson(tree, 'nx.json', {
      plugins: [registration],
      namedInputs: { default: ['sharedGlobals'] },
    });
    writeJson(tree, 'package.json', {
      devDependencies: { '@nx/vitest': '23.2.0', vite: '^7', vitest: '^4' },
    });
    tree.write('vitest.config.ts', config);
    setupVitest(tree, '', true);
    expect(readJson(tree, 'nx.json').plugins).toEqual([registration]);
    expect(readJson(tree, 'package.json').devDependencies).toMatchObject({
      vite: '^7',
      vitest: '^4',
    });
    expect(readJson(tree, 'package.json').nx.namedInputs.default).toEqual([
      'sharedGlobals',
      '{workspaceRoot}/**/*',
    ]);
  });

  it('leaves non-Vitest owners unchanged', () => {
    const tree = createTreeWithEmptyWorkspace();
    const before = tree.listChanges();
    expect(setupVitest(tree, 'api')).toBeUndefined();
    expect(tree.listChanges()).toEqual(before);
  });
});
