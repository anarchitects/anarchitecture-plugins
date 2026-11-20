import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import generator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];
jest.mock('../../utils/cli.js', () => ({ runTypeormCommand: jest.fn() }));

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});

describe('entity-create generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
    addProjectConfiguration(tree, 'api', {
      root: 'apps/blueprint/api',
      projectType: 'application',
    });
    addProjectConfiguration(tree, 'data-access', {
      root: 'libs/data-access',
      projectType: 'library',
    });
  });

  it.each([
    ['api', undefined, 'apps/blueprint/api/src/entities'],
    [
      'data-access',
      undefined,
      'libs/data-access/src/infrastructure-persistence/entities',
    ],
    ['api', 'src/custom', 'apps/blueprint/api/src/custom'],
  ])(
    'stages a scaffold for %s in %s',
    async (project, directory, destination) => {
      await generator(tree, { project, name: 'user profile', directory });
      const path = `${destination}/user-profile.entity.ts`;
      expect(tree.read(path, 'utf-8')).toContain(
        'export class UserProfileEntity'
      );
      expect(tree.listChanges()).toContainEqual(
        expect.objectContaining({ path, type: 'CREATE' })
      );
      expect(runTypeormCommand).not.toHaveBeenCalled();
    }
  );

  it('does not repeat a class suffix', async () => {
    await generator(tree, { project: 'api', name: 'user Entity' });
    const content = tree.read(
      'apps/blueprint/api/src/entities/user-Entity.entity.ts',
      'utf-8'
    );
    expect(content).toContain('class UserEntity');
    expect(content).not.toContain('UserEntityEntity');
  });

  it('preserves an existing destination and stages no other changes', async () => {
    const path = 'apps/blueprint/api/src/entities/user.entity.ts';
    tree.write(path, '// custom implementation');
    const changes = tree.listChanges();
    await expect(
      generator(tree, { project: 'api', name: 'user' })
    ).rejects.toThrow('already exists');
    expect(tree.read(path, 'utf-8')).toBe('// custom implementation');
    expect(tree.listChanges()).toEqual(changes);
  });

  it.each([
    { project: ' ', name: 'valid' },
    { project: 'api', name: ' ' },
    { project: 'api', name: '../escape' },
    { project: 'api', name: 'valid', directory: '../escape' },
    { project: 'api', name: 'valid', directory: '/absolute' },
    { project: 'api', name: 'valid', args: ['--path=elsewhere'] },
  ])(
    'rejects unsafe or unsupported options before staging files: %j',
    async (options) => {
      const changes = tree.listChanges();
      await expect(generator(tree, options)).rejects.toThrow();
      expect(tree.listChanges()).toEqual(changes);
      expect(runTypeormCommand).not.toHaveBeenCalled();
    }
  );
});
