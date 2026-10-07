// SPDX-License-Identifier: MIT
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nestMemberLintScript, setupLint } from './setup-lint';

describe('Nest member lint setup', () => {
  it.each(['', 'packages/api'])(
    'repairs the native script at %j once and includes nested project inputs',
    (root) => {
      const tree = createTreeWithEmptyWorkspace();
      const at = (file: string) => (root ? `${root}/${file}` : file);
      const manifest = {
        name: 'api',
        scripts: {
          lint: 'oxlint --type-aware src/ test/',
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
