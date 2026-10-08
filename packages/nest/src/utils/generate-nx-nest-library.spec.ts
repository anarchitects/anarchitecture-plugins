// SPDX-License-Identifier: MIT
import { installPackagesTask, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { runIsolatedSchematic } from '../generation-adapter/run-isolated-schematic';
import { snapshotNxTree } from '../generation-adapter/tree-snapshot';
import { generateNxNestLibrary } from './generate-nx-nest-library';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));
jest.mock('../generation-adapter/run-isolated-schematic', () => ({
  runIsolatedSchematic: jest.fn(),
}));

describe('Nx-native library transaction and install lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['paths', 'references'])(
    'keeps package, project, workspace, and %s linking unstaged when native generation fails',
    async (mode) => {
      const tree = createTreeWithEmptyWorkspace();
      if (mode === 'references') {
        writeJson(tree, 'tsconfig.json', { files: [], references: [] });
      }
      const before = snapshotNxTree(tree);
      jest
        .mocked(runIsolatedSchematic)
        .mockRejectedValueOnce(new Error('native generation failed'));
      await expect(
        generateNxNestLibrary(tree, { name: 'users' }, 'libs/users')
      ).rejects.toThrow('native generation failed');
      expect(snapshotNxTree(tree)).toEqual(before);
      expect(installPackagesTask).not.toHaveBeenCalled();
    }
  );

  it('rejects a conflicting user alias before invoking native generation', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { paths: { users: ['existing.ts'] } },
    });
    const before = snapshotNxTree(tree);
    await expect(
      generateNxNestLibrary(tree, { name: 'users' }, 'libs/users')
    ).rejects.toThrow('alias "users" already exists');
    expect(snapshotNxTree(tree)).toEqual(before);
    expect(runIsolatedSchematic).not.toHaveBeenCalled();
    expect(installPackagesTask).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'defers exactly one workspace install unless skipInstall=%s',
    async (skipInstall) => {
      const tree = createTreeWithEmptyWorkspace();
      jest
        .mocked(runIsolatedSchematic)
        .mockImplementationOnce(async (before) => ({
          after: new Map([
            ...before,
            ['src/users.module.ts', Buffer.from('native module fixture')],
          ]),
          deferredTasks: [],
          schematicVersion: '12.0.6',
        }));
      const callback = await generateNxNestLibrary(
        tree,
        { name: 'users', skipInstall },
        'libs/users'
      );
      expect(tree.exists('libs/users/package.json')).toBe(true);
      expect(installPackagesTask).not.toHaveBeenCalled();
      if (skipInstall) expect(callback).toBeUndefined();
      else {
        expect(typeof callback).toBe('function');
        await callback?.();
        expect(installPackagesTask).toHaveBeenCalledTimes(1);
        expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
      }
    }
  );
});
