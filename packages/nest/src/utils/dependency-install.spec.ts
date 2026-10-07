// SPDX-License-Identifier: MIT
import { installPackagesTask, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  dependencyState,
  installAfterGeneration,
  nativeInstallRequired,
} from './dependency-install';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));

describe('Nx dependency-install lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('coalesces native, Rspack, and Vitest requests into one deferred workspace install', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const native = nativeInstallRequired({
      changes: [],
      schematicVersion: '12.0.6',
      deferredTasks: [
        {
          name: 'node-package',
          options: { packageManager: 'npm', workingDirectory: 'apps/api' },
        },
        { name: 'node-package' },
        { name: 'repo-init' },
      ],
    });
    const callback = installAfterGeneration(tree, false, native, true, true);
    expect(installPackagesTask).not.toHaveBeenCalled();
    await callback?.();
    expect(installPackagesTask).toHaveBeenCalledTimes(1);
    // Native task options never override Nx workspace manager/installation cwd.
    expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
  });

  it('skips installation when requested or when nothing requires it', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(installAfterGeneration(tree, true, true, true)).toBeUndefined();
    expect(installAfterGeneration(tree, false, false, false)).toBeUndefined();
    expect(
      nativeInstallRequired({
        changes: [],
        schematicVersion: '12.0.6',
        deferredTasks: [{ name: 'repo-init' }],
      })
    ).toBe(false);
    expect(installPackagesTask).not.toHaveBeenCalled();
  });

  it('detects nested dependency changes without depending on manifest formatting or scripts', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'apps/api/package.json', {
      dependencies: { b: '1', a: '1' },
    });
    const before = dependencyState(tree, ['', 'apps/api']);
    writeJson(tree, 'apps/api/package.json', {
      scripts: { build: 'custom' },
      dependencies: { a: '1', b: '1' },
    });
    expect(dependencyState(tree, ['', 'apps/api'])).toBe(before);
    writeJson(tree, 'apps/api/package.json', {
      dependencies: { a: '2', b: '1' },
    });
    expect(dependencyState(tree, ['', 'apps/api'])).not.toBe(before);
  });
});
