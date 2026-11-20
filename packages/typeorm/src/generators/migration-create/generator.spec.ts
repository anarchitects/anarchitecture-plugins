import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import generator from './generator.js';

let createTreeWithEmptyWorkspace: typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace'];
jest.mock('../../utils/cli.js', () => ({ runTypeormCommand: jest.fn() }));
const timestamp = 1795219200000;

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});

describe('migration-create generator', () => {
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
    ['api', undefined, 'apps/blueprint/api/tools/typeorm/migrations'],
    [
      'data-access',
      undefined,
      'libs/data-access/src/infrastructure-persistence/migrations',
    ],
    ['api', 'tools/db/migrations', 'apps/blueprint/api/tools/db/migrations'],
  ])(
    'stages a migration for %s in %s',
    async (project, directory, destination) => {
      await generator(tree, {
        project,
        name: 'add users',
        directory,
        timestamp,
      });
      const path = `${destination}/${timestamp}-add-users.ts`;
      const content = tree.read(path, 'utf-8');
      expect(content).toContain(
        `export class AddUsers${timestamp} implements MigrationInterface`
      );
      expect(content).toContain('async up(queryRunner: QueryRunner)');
      expect(content).toContain('async down(queryRunner: QueryRunner)');
      expect(tree.listChanges()).toContainEqual(
        expect.objectContaining({ path, type: 'CREATE' })
      );
      expect(runTypeormCommand).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    'supports JavaScript migrations (esm=%s)',
    async (esm) => {
      await generator(tree, {
        project: 'api',
        name: 'add-users',
        timestamp,
        outputJs: true,
        esm,
      });
      const content = tree.read(
        `apps/blueprint/api/tools/typeorm/migrations/${timestamp}-add-users.js`,
        'utf-8'
      );
      expect(content).toContain(
        `${esm ? 'export' : 'module.exports ='} class AddUsers${timestamp}`
      );
      expect(content).not.toContain('implements');
    }
  );

  it('uses the current timestamp when omitted and retains underscore class naming', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    try {
      await generator(tree, { project: 'api', name: 'add_users' });
      expect(
        tree.read(
          `apps/blueprint/api/tools/typeorm/migrations/${timestamp}-add_users.ts`,
          'utf-8'
        )
      ).toContain(`class AddUsers${timestamp}`);
    } finally {
      now.mockRestore();
    }
  });

  it.each([
    ['--outputJs', '--esm', '--timestamp', `${timestamp}`],
    ['-o', '--esm=true', `-t=${timestamp}`],
  ])('supports known trailing CLI flags: %j', async (...args) => {
    await generator(tree, {
      project: 'api',
      name: 'add-users',
      timestamp: 1,
      args,
    });
    expect(
      tree.read(
        `apps/blueprint/api/tools/typeorm/migrations/${timestamp}-add-users.js`,
        'utf-8'
      )
    ).toContain(`export class AddUsers${timestamp}`);
  });

  it('allows trailing booleans to disable named options', async () => {
    await generator(tree, {
      project: 'api',
      name: 'add-users',
      timestamp,
      outputJs: true,
      esm: true,
      args: ['--outputJs=false', '--no-esm'],
    });
    expect(
      tree.exists(
        `apps/blueprint/api/tools/typeorm/migrations/${timestamp}-add-users.ts`
      )
    ).toBe(true);
  });

  it('preserves an existing migration without staging changes', async () => {
    const path = `apps/blueprint/api/tools/typeorm/migrations/${timestamp}-add-users.ts`;
    tree.write(path, '// existing migration');
    const changes = tree.listChanges();
    await expect(
      generator(tree, { project: 'api', name: 'add-users', timestamp })
    ).rejects.toThrow('already exists');
    expect(tree.read(path, 'utf-8')).toBe('// existing migration');
    expect(tree.listChanges()).toEqual(changes);
  });

  it.each([
    { project: ' ', name: 'valid' },
    { project: 'api', name: ' ' },
    { project: 'api', name: '../escape' },
    { project: 'api', name: 'valid', directory: '../escape' },
    { project: 'api', name: 'valid', directory: '/absolute' },
    { project: 'api', name: 'valid', timestamp: -1 },
    { project: 'api', name: 'valid', timestamp: NaN },
    { project: 'api', name: 'valid', timestamp: Infinity },
    { project: 'api', name: 'valid', timestamp: 1.5 },
    { project: 'api', name: 'valid', args: ['--timestamp'] },
    { project: 'api', name: 'valid', args: ['--timestamp=invalid'] },
    { project: 'api', name: 'valid', args: ['--path=elsewhere'] },
    { project: 'api', name: 'valid', args: ['--outputJs=invalid'] },
  ])('rejects invalid options before staging files: %j', async (options) => {
    const changes = tree.listChanges();
    await expect(generator(tree, options)).rejects.toThrow();
    expect(tree.listChanges()).toEqual(changes);
    expect(runTypeormCommand).not.toHaveBeenCalled();
  });
});
