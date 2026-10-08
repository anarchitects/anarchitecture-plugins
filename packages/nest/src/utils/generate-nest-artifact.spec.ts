// SPDX-License-Identifier: MIT
import { installPackagesTask, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { runNestSchematic } from '../generation-adapter/run-nest-schematic';
import { generateNestArtifact } from './generate-nest-artifact';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));
jest.mock('../generation-adapter/run-nest-schematic', () => ({
  runNestSchematic: jest.fn(),
}));

describe('Nx-native artifact install lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    { task: true, dependencyChange: false, skipInstall: false },
    { task: false, dependencyChange: true, skipInstall: false },
    { task: true, dependencyChange: true, skipInstall: false },
    { task: true, dependencyChange: true, skipInstall: true },
    { task: false, dependencyChange: false, skipInstall: false },
  ])(
    'defers one workspace install for %j',
    async ({ task, dependencyChange, skipInstall }) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'libs/users/project.json', {
        name: 'users',
        projectType: 'library',
        sourceRoot: 'libs/users/src',
        metadata: { nest: { kind: 'nx-library' } },
      });
      writeJson(tree, 'libs/users/package.json', {
        name: 'users',
        type: 'module',
      });
      jest.mocked(runNestSchematic).mockImplementationOnce(async (staged) => {
        if (dependencyChange)
          writeJson(staged, 'libs/users/package.json', {
            ...readJson(staged, 'libs/users/package.json'),
            dependencies: { 'native-dependency': '1.0.0' },
          });
        return {
          changes: [],
          deferredTasks: task
            ? [{ name: 'node-package' }, { name: 'node-package' }]
            : [],
          schematicVersion: '12.0.6',
        };
      });
      const callback = await generateNestArtifact(
        tree,
        'service',
        { name: 'orders', project: 'users', skipInstall },
        { flat: false, spec: true, language: 'ts' }
      );
      expect(runNestSchematic).toHaveBeenCalledWith(
        tree,
        expect.objectContaining({ workingDirectory: 'libs/users' })
      );
      expect(installPackagesTask).not.toHaveBeenCalled();
      if (!skipInstall && (task || dependencyChange)) {
        expect(typeof callback).toBe('function');
        await callback?.();
        expect(installPackagesTask).toHaveBeenCalledTimes(1);
        expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
      } else expect(callback).toBeUndefined();
    }
  );
});
