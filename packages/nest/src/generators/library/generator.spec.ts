// SPDX-License-Identifier: MIT
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateNestMember } from '../../utils/generate-nest-member';
import { generateNxNestLibrary } from '../../utils/generate-nx-nest-library';
import { libraryGenerator } from './generator';
import { resolveLibraryMode } from './resolve-library-mode';
import type { LibraryGeneratorSchema } from './schema';

jest.mock('../../utils/generate-nest-member', () => ({
  generateNestMember: jest.fn(),
}));
jest.mock('../../utils/generate-nx-nest-library', () => ({
  generateNxNestLibrary: jest.fn(),
}));

describe('library ownership contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('selects native ownership and forwards native options and the install callback unchanged', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const options = {
      name: 'shared',
      project: 'api',
      rootDir: 'modules',
      path: 'nested',
      prefix: '@domain',
      skipInstall: true,
      specFileSuffix: 'test',
    };
    const install = jest.fn();
    jest.mocked(generateNestMember).mockResolvedValueOnce(install);
    expect(resolveLibraryMode(options)).toEqual({
      kind: 'native',
      project: 'api',
    });
    expect(await libraryGenerator(tree, options)).toBe(install);
    expect(generateNestMember).toHaveBeenCalledWith(tree, 'library', options);
  });

  it('accepts and normalizes an independent Nx destination without requiring a Nest owner', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const options = {
      name: 'users',
      directory: './libs/users/',
      skipInstall: true,
    };
    expect(resolveLibraryMode(options)).toEqual({
      kind: 'nx',
      directory: 'libs/users/',
    });
    const install = jest.fn();
    jest.mocked(generateNxNestLibrary).mockResolvedValueOnce(install);
    expect(await libraryGenerator(tree, options)).toBe(install);
    expect(generateNxNestLibrary).toHaveBeenCalledWith(
      tree,
      options,
      'libs/users/'
    );
    expect(generateNestMember).not.toHaveBeenCalled();
  });

  it.each([
    [{}, /exactly one/],
    [{ project: 'api', directory: 'libs/users' }, /mutually exclusive/],
    [{ project: '' }, /--project must be a non-empty Nx project name/],
    [{ project: ' ' }, /--project must be a non-empty Nx project name/],
    [
      { directory: '' },
      /--directory must be a non-empty workspace-relative directory/,
    ],
    [{ directory: ' ' }, /--directory must be a non-empty/],
    ...['rootDir', 'path', 'prefix'].flatMap((key) => [
      [
        { directory: 'libs/users', [key]: 'custom' },
        /only supported with --project/,
      ],
      [{ directory: 'libs/users', [key]: '' }, /only supported with --project/],
    ]),
    ...[
      '../users',
      '/libs/users',
      'C:\\libs\\users',
      'libs/../users',
      '.git/users',
      'node_modules/users',
      '.',
    ].map((directory) => [
      { directory },
      /workspace-relative|host\/runtime|file path/,
    ]),
  ] as [Partial<LibraryGeneratorSchema>, RegExp][])(
    'rejects invalid ownership %j before staging changes',
    async (selectors, message) => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write('libs/existing/keep.txt', 'existing content');
      const before = tree.listChanges();
      await expect(
        libraryGenerator(tree, { name: 'users', ...selectors })
      ).rejects.toThrow(message);
      expect(tree.listChanges()).toEqual(before);
      expect(generateNestMember).not.toHaveBeenCalled();
      expect(generateNxNestLibrary).not.toHaveBeenCalled();
    }
  );

  it('keeps one public generator and alias with explicit ownership options', () => {
    const root = resolve(__dirname, '../../..');
    const catalog = JSON.parse(
      readFileSync(resolve(root, 'generators.json'), 'utf8')
    );
    expect(catalog.generators.library.aliases).toEqual(['lib']);
    expect(catalog.generators['workspace-library']).toBeUndefined();
    const schema = JSON.parse(
      readFileSync(resolve(root, catalog.generators.library.schema), 'utf8')
    );
    expect(schema.properties.directory).toMatchObject({
      type: 'string',
      format: 'path',
    });
    expect(schema.properties.project.type).toBe('string');
    expect(schema.properties.skipInstall).toMatchObject({
      type: 'boolean',
      default: false,
    });
    // Ownership validation runs before staging, with actionable errors. Neither
    // selector nor native-only options should be silently filled by CLI prompts.
    for (const key of ['project', 'directory', 'rootDir', 'path', 'prefix']) {
      expect(schema.properties[key].default).toBeUndefined();
      expect(schema.properties[key]['x-prompt']).toBeUndefined();
    }
  });
});
