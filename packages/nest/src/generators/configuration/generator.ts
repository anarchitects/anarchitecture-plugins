// SPDX-License-Identifier: MIT
import { getProjects, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { runNestSchematic } from '../../generation-adapter/run-nest-schematic';
import { treePath } from '../../generation-adapter/tree-snapshot';
import { registerNestPlugin } from '../../utils/plugin-registration';
import type { ConfigurationGeneratorSchema } from './schema';

export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema = {}
): Promise<void> {
  if (!tree.exists('nx.json') || !tree.exists('package.json'))
    throw new Error(
      'Generate Nest configuration inside an existing Nx workspace.'
    );
  if (options.project !== undefined && options.directory !== undefined)
    throw new Error('Use either --project or --directory, not both.');
  if (
    options.language !== undefined &&
    !['ts', 'js'].includes(options.language)
  )
    throw new Error('Nest configuration language must be ts or js.');
  // The native template interpolates collection into JSON without escaping.
  if (
    options.collection !== undefined &&
    (!options.collection.trim() ||
      JSON.stringify(options.collection) !== `"${options.collection}"`)
  )
    throw new Error(
      'Nest configuration collection must be a non-empty name without JSON control characters.'
    );

  let directory = options.directory ?? '.';
  if (options.project !== undefined) {
    const project = getProjects(tree).get(options.project);
    if (!project)
      throw new Error(`Nx project "${options.project}" does not exist.`);
    directory = project.root;
  }
  const root = directory === '.' ? '.' : treePath(directory);
  if (
    !tree.exists(posix.join(root, 'package.json')) &&
    !tree.exists(posix.join(root, 'project.json'))
  )
    throw new Error(
      'The Nest configuration directory must contain package.json or project.json for Nx project discovery.'
    );
  const nxJson = readNxJson(tree) ?? {};
  const plugins = registerNestPlugin(nxJson.plugins, {});
  const configPath = posix.join(root, 'nest-cli.json');
  try {
    await runNestSchematic(tree, {
      schematic: 'configuration',
      workingDirectory: root,
      options: { language: options.language, collection: options.collection },
    });
  } catch (cause) {
    if (tree.exists(configPath))
      throw new Error(
        `Cannot generate ${configPath}: existing configuration is preserved. Identical native output can be generated again; edit differing configuration explicitly.`,
        { cause }
      );
    throw cause;
  }
  if (JSON.stringify(nxJson.plugins) !== JSON.stringify(plugins))
    updateNxJson(tree, { ...nxJson, plugins });
}
export default configurationGenerator;
