// SPDX-License-Identifier: MIT
import {
  getProjects,
  readJson,
  readNxJson,
  updateNxJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { posix } from 'node:path';
import { runNestSchematic } from '../generation-adapter/run-nest-schematic';
import { treePath } from '../generation-adapter/tree-snapshot';
import { registerNestPlugin } from './plugin-registration';
import {
  dependencyState,
  installAfterGeneration,
  nativeInstallRequired,
} from './dependency-install';
import { setupLint } from './setup-lint';
import { setupRspack } from './setup-rspack';
import { setupVitest } from './setup-vitest';

export interface NestMemberOptions {
  name: string;
  project?: string;
  language?: string;
  path?: string;
  rootDir?: string;
  specFileSuffix?: string;
  format?: boolean;
  skipInstall?: boolean;
}
export interface NativeMember {
  type: 'application' | 'library';
  root: string;
  sourceRoot: string;
  compilerOptions?: { tsConfigPath?: string };
}
interface NestWorkspace {
  sourceRoot?: string;
  compilerOptions?: {
    builder?: string | { type?: string; options?: Record<string, unknown> };
  };
  projects?: Record<string, NativeMember>;
}

/** Select an Nx owner, keeping native rootDir/path relative to its Nest config. */
export async function generateNestMember(
  tree: Tree,
  schematic: 'sub-app' | 'library',
  options: NestMemberOptions
): Promise<GeneratorCallback | undefined> {
  if (!tree.exists('nx.json') || !tree.exists('package.json')) {
    throw new Error('Generate Nest members inside an existing Nx workspace.');
  }
  if (typeof options.name !== 'string' || !options.name.trim())
    throw new Error('A non-empty Nest member name is required.');
  treePath(options.name);
  for (const value of [options.rootDir, options.path]) {
    if (value !== undefined && value !== '' && value !== '.') treePath(value);
  }
  const projects = getProjects(tree);
  const candidates = [...projects.values()].filter((project) =>
    tree.exists(posix.join(project.root, 'nest-cli.json'))
  );
  const rootOwner = tree.exists('nest-cli.json')
    ? {
        root: '.',
        name:
          readJson(tree, 'package.json').nx?.name ??
          readJson(tree, 'package.json').name ??
          'nest',
      }
    : undefined;
  const selected = options.project
    ? projects.get(options.project) ??
      (rootOwner?.name === options.project ? rootOwner : undefined)
    : candidates.find((project) => project.root === '.') ??
      rootOwner ??
      (candidates.length === 1 ? candidates[0] : undefined);
  if (!selected || !tree.exists(posix.join(selected.root, 'nest-cli.json'))) {
    throw new Error(
      'Select the Nx project owning nest-cli.json with --project. The workspace must have an unambiguous Nest owner.'
    );
  }
  const ownerRoot = selected.root === '.' ? '' : treePath(selected.root);
  const at = (path: string) => posix.join(ownerRoot, path);
  if (!tree.exists(at('package.json')) || !tree.exists(at('tsconfig.json'))) {
    throw new Error(
      'The selected Nest workspace must contain package.json and tsconfig.json.'
    );
  }
  const nxJson = readNxJson(tree)!;
  const plugins = registerNestPlugin(nxJson.plugins, {});
  const previousConfig = readJson<NestWorkspace>(tree, at('nest-cli.json'));
  let nextSourceRoot: string | undefined;
  const { project: _project, skipInstall, ...nativeOptions } = options;
  const before = dependencyState(tree, ['', ownerRoot]);
  const result = await runNestSchematic(tree, {
    schematic,
    options: nativeOptions,
    workingDirectory: ownerRoot,
    isolateHostReads: true,
    postTransform: (guard) => {
      const config = guard.readJson<NestWorkspace>(at('nest-cli.json'));
      nextSourceRoot = config.sourceRoot
        ? treePath(config.sourceRoot)
        : undefined;
      for (const [nativeName, member] of Object.entries(
        config.projects ?? {}
      )) {
        const root = at(treePath(member.root));
        const sourceRoot = at(treePath(member.sourceRoot));
        const existing = [...projects.values()].find(
          (project) => project.root === root
        );
        const name = existing?.name ?? `${selected.name}-${nativeName}`;
        const collision = projects.get(name);
        if (collision && collision.root !== root)
          throw new Error(
            `Nx project "${name}" already exists at "${collision.root}".`
          );
        if (root === (ownerRoot || '.'))
          throw new Error(
            'A Nest member must have its own directory inside the selected workspace.'
          );
        guard.addJsonProperties(`${root}/project.json`, {
          name,
          projectType: member.type,
          sourceRoot,
        });
      }
    },
  });
  // Native first-sub-app conversion resets the builder to the string default.
  // Retain an explicitly configured Rspack builder and its consumer options.
  const previousBuilder = previousConfig.compilerOptions?.builder;
  if (
    typeof previousBuilder === 'object' &&
    previousBuilder.type === 'rspack'
  ) {
    const config = readJson<NestWorkspace>(tree, at('nest-cli.json'));
    if (config.compilerOptions?.builder === 'rspack') {
      config.compilerOptions.builder = previousBuilder;
      writeJson(tree, at('nest-cli.json'), config);
    }
  }
  // Native conversion moves the owner's source. Migrate only matching Nx
  // sourceRoot metadata; preserve custom values and every other user setting.
  if (nextSourceRoot && nextSourceRoot !== previousConfig.sourceRoot) {
    const oldSourceRoot = at(previousConfig.sourceRoot ?? 'src');
    for (const file of ['project.json', 'package.json']) {
      if (!tree.exists(at(file))) continue;
      const json = readJson(tree, at(file));
      const metadata = file === 'package.json' ? json.nx : json;
      if (metadata?.sourceRoot === oldSourceRoot) {
        metadata.sourceRoot = at(treePath(nextSourceRoot));
        writeJson(tree, at(file), json);
      }
    }
  }
  if (JSON.stringify(nxJson.plugins) !== JSON.stringify(plugins))
    updateNxJson(tree, { ...nxJson, plugins });
  setupLint(tree, ownerRoot);
  const nativeDependenciesChanged =
    before !== dependencyState(tree, ['', ownerRoot]);
  const rspackInstall = setupRspack(tree, ownerRoot);
  const vitestInstall = setupVitest(tree, ownerRoot);
  return installAfterGeneration(
    tree,
    skipInstall,
    nativeInstallRequired(result),
    nativeDependenciesChanged,
    rspackInstall,
    vitestInstall
  );
}
