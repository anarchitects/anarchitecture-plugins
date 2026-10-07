// SPDX-License-Identifier: MIT
import { readNxJson, updateJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';

/** Owner-wide tools read files below nested Nx project boundaries. */
export function includeNestOwnerFiles(tree: Tree, ownerRoot: string): void {
  const at = (file: string) => posix.join(ownerRoot, file);
  const nxJson = readNxJson(tree);
  // The owner runs tools below nested Nx member roots. `projectRoot` inputs
  // exclude nested projects, so include the owner's subtree explicitly.
  const projectFile = tree.exists(at('project.json'))
    ? 'project.json'
    : 'package.json';
  updateJson(tree, at(projectFile), (json) => {
    const project = projectFile === 'package.json' ? (json.nx ??= {}) : json;
    project.namedInputs ??= {};
    const defaults = project.namedInputs.default ??
      nxJson?.namedInputs?.default ?? ['{projectRoot}/**/*'];
    const ownerFiles = ownerRoot
      ? `{workspaceRoot}/${ownerRoot}/**/*`
      : '{workspaceRoot}/**/*';
    project.namedInputs.default = [...new Set([...defaults, ownerFiles])];
    return json;
  });
}
