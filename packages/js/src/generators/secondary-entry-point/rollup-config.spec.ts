import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { logger } from '@nx/devkit';
import { runInNewContext } from 'node:vm';
import { updateRollupConfig } from './rollup-config';

describe('inferred Rollup entry points', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves the primary entry, custom settings and repeat safety', () => {
    const tree = createTreeWithEmptyWorkspace();
    const path = 'libs/demo/rollup.config.cjs';
    tree.write(
      path,
      "module.exports = { input: 'source/main.ts', external: ['node:fs'], output: { dir: 'dist', format: 'es' } };"
    );
    updateRollupConfig(
      tree,
      'libs/demo',
      'feature/index',
      'source/feature/index.ts'
    );
    const source = tree.read(path, 'utf8')!;
    const context = { module: { exports: {} } };
    runInNewContext(source, context);
    expect(context.module.exports).toEqual({
      input: {
        main: 'source/main.ts',
        'feature/index': 'source/feature/index.ts',
      },
      external: ['node:fs'],
      output: { dir: 'dist', format: 'es' },
    });
    updateRollupConfig(
      tree,
      'libs/demo',
      'feature/index',
      'source/feature/index.ts'
    );
    expect(tree.read(path, 'utf8')).toBe(source);
  });

  it('updates the native input argument of the Nx Rollup helper without replacing its options', () => {
    const tree = createTreeWithEmptyWorkspace();
    const path = 'libs/demo/rollup.config.cjs';
    tree.write(
      path,
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({ main: './src/index.ts', outputPath: './dist', compiler: 'swc' }, { external: ['node:fs'] });`
    );
    updateRollupConfig(
      tree,
      'libs/demo',
      'feature/index',
      'src/feature/index.ts'
    );
    const withNx = jest.fn();
    runInNewContext(tree.read(path, 'utf8')!, {
      require: () => ({ withNx }),
      module: {},
    });
    expect(withNx).toHaveBeenCalledWith(
      { main: './src/index.ts', outputPath: './dist', compiler: 'swc' },
      {
        external: ['node:fs'],
        input: {
          index: './src/index.ts',
          'feature/index': 'src/feature/index.ts',
        },
      }
    );
  });

  it.each([
    'module.exports = makeConfig();',
    'export default { input: entries };',
    'export default { input };',
    "export default { input: { [key]: 'src/index.ts' } };",
    "export default { ...shared, input: 'src/index.ts' };",
    "export default { input: 'src/index.ts', output: { file: 'dist/index.js' } };",
    "export default { input: 'src/index.ts', output: { ...sharedOutput } };",
    "const { withNx } = require('@nx/rollup/with-nx'); module.exports = withNx({ main: './src/index.ts', outputFileName: 'custom.js' });",
  ])(
    'preserves dynamic configuration and reports manual configuration: %s',
    (source) => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write('libs/demo/rollup.config.ts', source);
      const warning = jest
        .spyOn(logger, 'warn')
        .mockImplementation(() => undefined);
      updateRollupConfig(
        tree,
        'libs/demo',
        'feature/index',
        'src/feature/index.ts'
      );
      expect(tree.read('libs/demo/rollup.config.ts', 'utf8')).toBe(source);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('manually'));
    }
  );
});
