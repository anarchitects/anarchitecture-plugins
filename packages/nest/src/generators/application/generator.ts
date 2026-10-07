// SPDX-License-Identifier: MIT
import { getProjects, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { runNestSchematic } from '../../generation-adapter/run-nest-schematic';
import { treePath } from '../../generation-adapter/tree-snapshot';
import { registerNestPlugin } from '../../utils/plugin-registration';
import { planApplicationWorkspaceRegistration } from '../../utils/register-application-workspace';
import type { ApplicationGeneratorSchema } from './schema';

function applicationLocation(options: ApplicationGeneratorSchema) {
  if (
    (typeof options.name !== 'string' && typeof options.name !== 'number') ||
    !String(options.name).trim()
  ) {
    throw new Error('A non-empty Nest application name is required.');
  }
  // Match Nest's name-to-directory normalization, without changing its options
  // or generated package name. Scoped and path-qualified names remain native.
  const name = String(options.name)
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/\s/g, '-');
  treePath(name);
  const root = treePath(
    !options.directory || options.directory === 'undefined'
      ? name
      : options.directory
  );
  const { base, dir } = posix.parse(name);
  return { root, name: /^@[^\s]/.test(dir) ? `${dir}/${base}` : base };
}

export async function applicationGenerator(
  tree: Tree,
  options: ApplicationGeneratorSchema
): Promise<void> {
  if (!tree.exists('nx.json') || !tree.exists('package.json')) {
    throw new Error(
      'Generate the Nest application inside an existing Nx workspace.'
    );
  }
  const { root, name } = applicationLocation(options);
  const nxJson = readNxJson(tree)!;
  // Validate registration and project collisions before staging native files.
  const plugins = registerNestPlugin(nxJson.plugins, {});
  const registerWorkspace = planApplicationWorkspaceRegistration(
    tree,
    root,
    options.packageManager
  );
  const existing = getProjects(tree).get(name);
  if (existing && existing.root !== root) {
    throw new Error(
      `Nx project "${name}" already exists at "${existing.root}".`
    );
  }
  await runNestSchematic(tree, {
    schematic: 'application',
    options: { ...options, directory: root },
    postTransform: (guard) => {
      guard.addJsonProperties(`${root}/project.json`, {
        name,
        projectType: 'application',
        sourceRoot: `${root}/src`,
      });
    },
  });
  registerWorkspace();
  if (JSON.stringify(nxJson.plugins) !== JSON.stringify(plugins)) {
    updateNxJson(tree, { ...nxJson, plugins });
  }
}

export default applicationGenerator;
