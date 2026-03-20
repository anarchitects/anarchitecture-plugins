import {
  captureWorkspaceSnapshot,
  resetWorkspaceState,
  runNx,
  workspaceRoot,
} from './test-utils';
import { join } from 'path';
import { readFileSync } from 'fs';

describe('nx-typeorm init generator', () => {
  const sandboxProjects: string[] = [];
  const snapshot = captureWorkspaceSnapshot();

  beforeAll(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  afterEach(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  afterAll(() => {
    resetWorkspaceState(snapshot, sandboxProjects);
  });

  it('registers plugin metadata and required dependencies', () => {
    runNx(
      'yarn nx g @anarchitects/nx-typeorm:init --skipInstall --skipFormat --no-interactive'
    );

    const nxJson = JSON.parse(readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'));
    expect(nxJson.plugins).toEqual(
      expect.arrayContaining([{ plugin: '@anarchitects/nx-typeorm' }])
    );

    const packageJson = JSON.parse(
      readFileSync(join(workspaceRoot, 'package.json'), 'utf-8')
    );
    const typeormVersion =
      packageJson.dependencies?.typeorm ?? packageJson.devDependencies?.typeorm;
    const reflectMetadataVersion =
      packageJson.dependencies?.['reflect-metadata'] ??
      packageJson.devDependencies?.['reflect-metadata'];

    expect(typeormVersion).toBeDefined();
    expect(reflectMetadataVersion).toBeDefined();
  });
});
