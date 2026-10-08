// SPDX-License-Identifier: MIT
import {
  getProjects,
  readJson,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
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

export interface NativeOwnerContext {
  kind: 'native-owner';
  ownerRoot: string;
  config: NestGenerationConfig;
  member?: undefined;
}

export interface NativeMemberContext {
  kind: 'native-member';
  ownerRoot: string;
  config: NestGenerationConfig;
  nestProject: string;
  member: NestGenerationConfig;
}

export interface NxNativeLibraryContext {
  kind: 'nx-library';
  projectName: string;
  /** Workspace-relative paths. */
  projectRoot: string;
  sourceRoot: string;
  packageJsonPath: string;
  packageJson: {
    name: string;
    type?: 'module' | 'commonjs';
    [key: string]: unknown;
  };
  /** Source root relative to the library's scoped schematic Tree. */
  relativeSourceRoot: string;
  moduleSystem: 'esm' | 'cjs';
  language: 'ts';
}

export type NestGenerationContext =
  | NativeOwnerContext
  | NativeMemberContext
  | NxNativeLibraryContext;

function resolveNxLibraryContext(
  tree: Tree,
  projectName: string,
  project: ProjectConfiguration,
  nestProject: string | undefined
): NxNativeLibraryContext {
  if (nestProject !== undefined)
    throw new Error(
      '--nestProject is only valid for native Nest owners or members.'
    );
  const projectRoot = treePath(project.root).replace(/\/$/, '');
  if (project.projectType !== 'library' || !project.sourceRoot)
    throw new Error(
      `Nx-native Nest project "${projectName}" must be a library with a sourceRoot.`
    );
  const sourceRoot = treePath(project.sourceRoot).replace(/\/$/, '');
  if (sourceRoot !== projectRoot && !sourceRoot.startsWith(`${projectRoot}/`))
    throw new Error(
      `Source root "${sourceRoot}" must be inside Nx-native Nest library "${projectRoot}".`
    );
  // A root native owner may coexist with independent workspace libraries, but
  // an explicitly registered native member cannot also be an Nx-native library.
  for (let root = projectRoot; ; root = posix.dirname(root)) {
    const configPath = posix.join(root, 'nest-cli.json');
    if (tree.exists(configPath)) {
      const config = readJson<NestGenerationConfig>(tree, configPath);
      if (
        root === projectRoot ||
        // Only detect an identity collision here; unrelated member paths are
        // validated when that native project is selected, not by this library.
        Object.values(config.projects ?? {}).some(
          (member) =>
            typeof member.root === 'string' &&
            posix.join(root, member.root.replace(/\\/g, '/')) === projectRoot
        )
      )
        throw new Error(
          `Nx project "${projectName}" has conflicting native Nest and nx-library ownership.`
        );
    }
    if (root === '.') break;
  }
  if (tree.exists(`${projectRoot}/nest.json`))
    throw new Error(
      `Nx-native Nest library "${projectName}" must not contain a native nest.json configuration.`
    );
  const packageJsonPath = `${projectRoot}/package.json`;
  if (!tree.exists(packageJsonPath))
    throw new Error(
      `Nx-native Nest library "${projectName}" must contain package.json.`
    );
  const packageJson = readJson<NxNativeLibraryContext['packageJson']>(
    tree,
    packageJsonPath
  );
  if (
    !packageJson ||
    typeof packageJson.name !== 'string' ||
    !packageJson.name.trim() ||
    (packageJson.type !== undefined &&
      !['module', 'commonjs'].includes(packageJson.type))
  )
    throw new Error(
      `Nx-native Nest library "${projectName}" has an invalid package name or module type.`
    );
  return {
    kind: 'nx-library',
    projectName,
    projectRoot,
    sourceRoot,
    relativeSourceRoot: posix.relative(projectRoot, sourceRoot) || '.',
    packageJsonPath,
    packageJson,
    moduleSystem: packageJson.type === 'module' ? 'esm' : 'cjs',
    language: 'ts',
  };
}

/** Paths belong to the selected native owner, never the process cwd. */
export function nativeRelativePath(path: string): string {
  return path === '' || path === '.' ? path : treePath(path);
}

export function resolveNestGenerationContext(
  tree: Tree,
  options: { project?: string; nestProject?: string }
): NestGenerationContext {
  if (!tree.exists('nx.json') || !tree.exists('package.json')) {
    throw new Error('Generate Nest artifacts inside an existing Nx workspace.');
  }
  const projects = getProjects(tree);
  const explicitProject = options.project
    ? projects.get(options.project)
    : undefined;
  if (options.project && explicitProject?.metadata?.nest?.kind === 'nx-library')
    return resolveNxLibraryContext(
      tree,
      options.project,
      explicitProject,
      options.nestProject
    );
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
  return nativeName && member
    ? {
        kind: 'native-member',
        ownerRoot,
        config,
        nestProject: nativeName,
        member,
      }
    : { kind: 'native-owner', ownerRoot, config };
}

export interface NativeGenerationDefaults {
  flat: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  language?: string;
}

/** Apply Nest config precedence, retaining each schematic's own fallback defaults. */
export function nestGenerationDefaults(
  config: NestGenerationConfig,
  member: NestGenerationConfig | undefined,
  explicit: {
    spec?: boolean;
    flat?: boolean;
    specFileSuffix?: string;
    sourceRoot?: string;
    language?: string;
  },
  schematic: string,
  defaults: NativeGenerationDefaults
) {
  const global = config.generateOptions ?? {};
  const local = member?.generateOptions ?? {};
  const configuredSpec = local.spec ?? global.spec;
  const globalSpec =
    typeof global.spec === 'boolean' ? global.spec : global.spec?.[schematic];
  const spec =
    explicit.spec ??
    (typeof configuredSpec === 'boolean'
      ? configuredSpec
      : configuredSpec?.[schematic] ?? globalSpec) ??
    defaults.spec;
  // Nest's --flat=false still consults configuration; only true overrides it.
  const flat =
    explicit.flat === true
      ? true
      : local.flat ?? global.flat ?? explicit.flat ?? defaults.flat;
  const specFileSuffix =
    explicit.specFileSuffix ||
    (local.specFileSuffix ?? global.specFileSuffix ?? defaults.specFileSuffix);
  const sourceRoot =
    explicit.sourceRoot !== undefined
      ? nativeRelativePath(explicit.sourceRoot)
      : posix.join(
          nativeRelativePath(member?.sourceRoot ?? config.sourceRoot ?? 'src'),
          nativeRelativePath(global.baseDir ?? '')
        );
  return {
    ...(defaults.spec !== undefined ? { spec } : {}),
    flat,
    ...(defaults.specFileSuffix !== undefined ? { specFileSuffix } : {}),
    sourceRoot,
    ...(defaults.language !== undefined
      ? { language: explicit.language ?? config.language ?? defaults.language }
      : {}),
  };
}
