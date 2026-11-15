// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nestMemberLintScript, setupLint } from './setup-lint';

describe('Nest member lint setup', () => {
  it.each([
    {
      schematic: 'library' as const,
      rootDir: 'modules',
      script: 'oxlint --type-aware src/ test/ modules/',
    },
    {
      schematic: 'sub-app' as const,
      rootDir: 'services',
      script: 'oxlint --type-aware services/ libs/',
    },
  ])(
    'recognizes the exact native $schematic rewrite for a custom root',
    ({ schematic, rootDir, script }) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'package.json', { scripts: { lint: script } });
      setupLint(tree, '', { schematic, rootDir });
      expect(readJson(tree, 'package.json').scripts.lint).toBe(
        nestMemberLintScript
      );
      writeJson(tree, 'package.json', {
        scripts: { lint: script + ' --deny-warnings' },
      });
      const before = tree.listChanges();
      setupLint(tree, '', { schematic, rootDir });
      expect(tree.listChanges()).toEqual(before);
    }
  );
  it.each(
    ['', 'packages/api'].flatMap((root) =>
      ['src/ test/', 'apps/ libs/'].map((paths) => ({ root, paths }))
    )
  )(
    'repairs the native script at %j once and includes nested project inputs',
    ({ root, paths }) => {
      const tree = createTreeWithEmptyWorkspace();
      const at = (file: string) => (root ? `${root}/${file}` : file);
      const manifest = {
        name: 'api',
        scripts: {
          lint: `oxlint --type-aware ${paths}`,
          build: 'nest build',
        },
      };
      writeJson(tree, at('package.json'), manifest);
      writeJson(tree, at('project.json'), {
        name: 'api',
        namedInputs: { default: ['custom'], custom: ['{projectRoot}/**/*'] },
      });
      tree.write(
        at('.oxlintrc.json'),
        '{"rules":{"typescript/no-floating-promises":"error"}}'
      );
      setupLint(tree, root);
      expect(readJson(tree, at('package.json'))).toEqual({
        ...manifest,
        scripts: { ...manifest.scripts, lint: nestMemberLintScript },
      });
      expect(readJson(tree, at('project.json')).namedInputs).toEqual({
        default: [
          'custom',
          root ? `{workspaceRoot}/${root}/**/*` : '{workspaceRoot}/**/*',
        ],
        custom: ['{projectRoot}/**/*'],
      });
      expect(tree.read(at('.oxlintrc.json'), 'utf8')).toBe(
        '{"rules":{"typescript/no-floating-promises":"error"}}'
      );
      const changes = tree.listChanges();
      setupLint(tree, root);
      expect(tree.listChanges()).toEqual(changes);
    }
  );

  it.each([
    undefined,
    'eslint .',
    'oxlint --type-aware src/ test/ --deny-warnings',
  ])('preserves consumer script %j and metadata', (lint) => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', { scripts: lint ? { lint } : {} });
    const changes = tree.listChanges();
    setupLint(tree, '');
    expect(tree.listChanges()).toEqual(changes);
  });

  it('uses package metadata and inherited default inputs for a root owner', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'nx.json', {
      namedInputs: { default: ['sharedGlobals', '{projectRoot}/**/*'] },
    });
    writeJson(tree, 'package.json', {
      name: 'api',
      nx: { tags: ['backend'] },
      scripts: { lint: nestMemberLintScript },
    });
    setupLint(tree, '');
    expect(readJson(tree, 'package.json').nx).toEqual({
      tags: ['backend'],
      namedInputs: {
        default: [
          'sharedGlobals',
          '{projectRoot}/**/*',
          '{workspaceRoot}/**/*',
        ],
      },
    });
  });
});
