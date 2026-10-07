// SPDX-License-Identifier: MIT
import { getProjects, readJson, type Tree } from '@nx/devkit';
import { posix } from 'node:path';
import { treePath } from '../generation-adapter/tree-snapshot';

export interface GenerateOptions {
  spec?: boolean | Record<string, boolean>;
  flat?: boolean;
  specFileSuffix?: string;
  baseDir?: string;
}
export interface NestGenerationConfig {
  root?: string;
  sourceRoot?: string;
  language?: string;
  generateOptions?: GenerateOptions;
  projects?: Record<string, NestGenerationConfig>;
}

/** Paths belong to the selected native owner, never the process cwd. */
export function nativeRelativePath(path: string): string {
  return path === '' || path === '.' ? path : treePath(path);
}

export function resolveNestGenerationContext(
  tree: Tree,
  options: { project?: string; nestProject?: string }
) {
  if (!tree.exists('nx.json') || !tree.exists('package.json')) {
    throw new Error('Generate Nest resources inside an existing Nx workspace.');
  }
  const projects = getProjects(tree);
  const rootManifest = readJson(tree, 'package.json');
  const rootOwner = tree.exists('nest-cli.json')
    ? {
        root: '.',
        name: rootManifest.nx?.name ?? rootManifest.name ?? 'nest',
      }
    : undefined;
  const owners = [...projects.values()].filter((project) =>
    tree.exists(posix.join(project.root, 'nest-cli.json'))
  );
  const selected = options.project
    ? projects.get(options.project) ??
      (rootOwner?.name === options.project ? rootOwner : undefined)
    : owners.find((project) => project.root === '.') ??
      rootOwner ??
      (owners.length === 1 ? owners[0] : undefined);
  if (!selected)
    throw new Error(
      'Select an Nx Nest project with --project; the workspace has no unambiguous Nest owner.'
    );
  let ownerRoot = selected.root === '.' ? '.' : treePath(selected.root);
  while (!tree.exists(posix.join(ownerRoot, 'nest-cli.json'))) {
    if (ownerRoot === '.')
      throw new Error(
        `Nx project "${selected.name}" does not belong to a Nest workspace.`
      );
    ownerRoot = posix.dirname(ownerRoot);
  }
  if (!tree.exists(posix.join(ownerRoot, 'package.json')))
    throw new Error('The selected Nest owner must contain package.json.');
  const config = readJson<NestGenerationConfig>(
    tree,
    posix.join(ownerRoot, 'nest-cli.json')
  );
  const memberName =
    selected.root === ownerRoot
      ? undefined
      : Object.entries(config.projects ?? {}).find(
          ([, member]) =>
            member.root !== undefined &&
            posix.join(ownerRoot, nativeRelativePath(member.root)) ===
              selected.root
        )?.[0];
  if (selected.root !== ownerRoot && !memberName)
    throw new Error(
      `Nx project "${selected.name}" is not a member of the owning Nest configuration.`
    );
  if (options.nestProject && memberName && options.nestProject !== memberName)
    throw new Error('--nestProject conflicts with the selected Nx member.');
  const nativeName = options.nestProject ?? memberName;
  const member = nativeName ? config.projects?.[nativeName] : undefined;
  if (nativeName && !member)
    throw new Error(
      `Native Nest project "${nativeName}" does not exist in the selected owner.`
    );
  return { ownerRoot, config, member };
}

/** Mirror the pinned Nest CLI's resource defaults without importing CLI internals. */
export function resourceGenerationDefaults(
  config: NestGenerationConfig,
  member: NestGenerationConfig | undefined,
  explicit: {
    spec?: boolean;
    flat?: boolean;
    specFileSuffix?: string;
    sourceRoot?: string;
    language?: string;
  }
) {
  const global = config.generateOptions ?? {};
  const local = member?.generateOptions ?? {};
  const configuredSpec = local.spec ?? global.spec;
  const globalSpec =
    typeof global.spec === 'boolean' ? global.spec : global.spec?.resource;
  const spec =
    explicit.spec ??
    (typeof configuredSpec === 'boolean'
      ? configuredSpec
      : configuredSpec?.resource ?? globalSpec) ??
    true;
  // Nest's --flat=false still consults configuration; only true overrides it.
  const flat =
    explicit.flat === true ? true : local.flat ?? global.flat ?? false;
  const specFileSuffix =
    explicit.specFileSuffix ||
    (local.specFileSuffix ?? global.specFileSuffix ?? 'spec');
  const sourceRoot =
    explicit.sourceRoot !== undefined
      ? nativeRelativePath(explicit.sourceRoot)
      : posix.join(
          nativeRelativePath(member?.sourceRoot ?? config.sourceRoot ?? 'src'),
          nativeRelativePath(global.baseDir ?? '')
        );
  return {
    spec,
    flat,
    specFileSuffix,
    sourceRoot,
    language: explicit.language ?? config.language ?? 'ts',
  };
}
