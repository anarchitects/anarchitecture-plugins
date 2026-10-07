# @anarchitects/nest

An incubator for stable NestJS v12 integration with Nx. The portable core is
intended for eventual contribution to `@nx/nest`, rather than a permanent fork.

## Status

This package discovers Nest projects and infers cacheable build and continuous
start targets through the `@anarchitects/nest/plugin` entrypoint. Build outputs
are resolved from the effective Nest TypeScript configuration. Further validation
and generators remain tracked in
[epic #478](https://github.com/anarchitects/anarchitecture-plugins/issues/478).

## Compatibility

| Peer          | Supported range | Reason                                                                                              |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `nx`          | `>=23.2.0 <24`  | Initial validation uses the repository's Nx 23.2 baseline; older and future majors are not claimed. |
| `@nx/devkit`  | `>=23.2.0 <24`  | Keep the plugin API aligned with the installed Nx version.                                          |
| `@nestjs/cli` | `>=12.0.0 <13`  | Stable Nest v12 CLI only; prereleases and older majors are excluded.                                |

Use the same version of `nx` and `@nx/devkit`. Node.js must satisfy
`^20.19.0 || ^22.12.0 || >=24.0.0`, matching the Nx 23 runtime baseline.
The CLI peer establishes the framework tooling contract; the plugin does not
install or import the application's `@nestjs/core` or platform adapter.
Application dependencies remain owned by the Nest project.

These ranges establish the package contract. Full Nest v12 project-shape
validation is planned in #485; current coverage validates packaging, loading,
project discovery, build and start target configuration, and effective build outputs.

## Installation and registration

Once a revived version is published, install it in an Nx workspace using:

```sh
yarn nx add @anarchitects/nest
```

The plugin has no init generator yet (#486), so registration is manual.
Add the entry to the existing `plugins` array in `nx.json`:

```json
{
  "plugins": ["@anarchitects/nest/plugin"]
}
```

Registration discovers `**/nest-cli.json` at the workspace root or in nested
directories. A config must have a sibling `package.json` or `project.json`;
configs without either are ignored, even if a parent directory has a manifest.
The config's directory becomes the Nx project root (`.` at the workspace root).
The plugin adds `nest` technology metadata and lets Nx's built-in plugins merge
project names and explicit configuration from the manifests.

Discovery uses filenames only. Build inference reads the Nest config, project
manifests, and TypeScript configuration but never executes the Nest CLI, changes
the working directory, emits compiler output, or writes a plugin cache.
Nest `sourceRoot`, `root`, and `projects` fields do not relocate the Nx project
or create separate child nodes. In Nest monorepo mode, this stage discovers the
directory containing `nest-cli.json`.

## Inferred build target

The default `build` target runs `nest build` from the directory containing
`nest-cli.json`. It is cacheable, depends on `^build`, and carries Nest technology
metadata. The plugin uses a command target; no custom executor is required.

To rename the target, configure `buildTargetName`:

```json
{
  "plugins": [
    {
      "plugin": "@anarchitects/nest/plugin",
      "options": { "buildTargetName": "compile" }
    }
  ]
}
```

This creates `compile` instead of `build` and depends on `^compile` in dependency
projects. Omitted options default to `build`; empty target names are rejected.

Build inputs use `production` and `^production` when that named input exists,
otherwise `default` and `^default`. Named inputs are resolved from workspace
`nx.json`, then `package.json`'s `nx.namedInputs`, then `project.json`, with later
definitions taking precedence. The Nest CLI external dependency and both root
`tsconfig.json` and `tsconfig.base.json` files are included in the hash. These
whole-file tsconfig inputs conservatively invalidate the cache when shared
settings or solution references change, using public Nx input configuration.

Nx applies `targetDefaults` over inferred configuration and explicit project
target settings over those defaults. Explicit commands, inputs, outputs, and
cache settings therefore remain authoritative.

### Effective TypeScript configuration and outputs

For the inferred `nest build` command (without a named application argument),
the tsconfig is selected relative to the directory containing `nest-cli.json`:

1. `compilerOptions.tsConfigPath`, when set.
2. `compilerOptions.builder.options.configPath` for a builder of type `tsc`.
3. `tsconfig.build.json`, when present.
4. `tsconfig.json` otherwise.

TypeScript's public configuration parser resolves `extends`, including package
and multiple-base forms, JSON comments, and trailing commas. An inherited
`outDir` is relative to the config that declares it; a child override is relative
to the child's config. Solution-style `files: []` and `references` are accepted.
References do not select a different build config or infer additional outputs.

Outputs inside the project use `{projectRoot}`. Outputs outside the project use
`{workspaceRoot}` with the corresponding relative path. Absolute `outDir` values
and workspace symlinks are normalized to these same tokens. Existing local
tsconfig files read during resolution are added to build inputs, including shared
base configs outside the project. When installed package configs are read, the
target uses Nx's default hashing of all external dependencies instead of narrowing
the dependency input to Nest CLI. This conservatively invalidates the build when
a package-based config or its transitive bases change.

If the selected config is missing or has no `outDir`, inference retains the
`{projectRoot}/dist` fallback. A missing explicit config does not switch to a
different config; Nest CLI reports the missing file when building. Invalid
existing configs and unresolved `extends` produce a configuration error during
inference rather than guessing an output directory.

This resolves the selected tsconfig's output directory. Custom bundler output
overrides or separately configured asset destinations still require explicit Nx
`outputs` settings.

## Inferred start target

The default `start` target runs `nest start` from the directory containing
`nest-cli.json`. It has `continuous: true`, `cache: false`, and Nest technology
metadata. Nx can run dependent tasks alongside this long-running command.
Nest CLI owns compilation and startup; the target adds no build dependency,
cache inputs, or outputs. Watch mode is opt-in through Nest CLI arguments, for
example `yarn nx start api --watch`.

To use a name such as `serve`, configure `startTargetName`:

```json
{
  "plugins": [
    {
      "plugin": "@anarchitects/nest/plugin",
      "options": {
        "buildTargetName": "compile",
        "startTargetName": "serve"
      }
    }
  ]
}
```

Each option defaults independently to `build` or `start`. Renaming replaces the
default target name; no compatibility alias is added. Both names must be non-empty
and different. If an existing configuration uses `buildTargetName: "start"`, set
a distinct `startTargetName` to keep that build name. Nx `targetDefaults` and
explicit project targets can override the inferred runtime settings, using the
same precedence as build targets.

No `test` or `lint` target is inferred.
Jest, Vitest, ESLint, and Oxlint remain the responsibility of their respective
Nx integrations.

Both the root and `/plugin` entrypoints provide compiled CommonJS JavaScript,
loadable with `require` or ESM `import`, plus TypeScript declarations. Workspace
development uses the repository's source export condition. Discovery uses only
public Nx APIs and Node filesystem reads. The plugin uses no
private Nx APIs, copied Nest templates, or historical plugin implementation.

## Development and release

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest
yarn nx release --projects nx-nest --first-release --dry-run
```

The TypeScript, Jest, ESLint, and publish targets are inferred by the workspace's
existing Nx plugins. Tests depend on the build to verify the actual packed
artifact, including both entrypoints, the shipped declarations and license,
and build/start inference through Nx's project graph in a temporary consumer workspace.

The Nx project is `nx-nest`; the npm package is `@anarchitects/nest`. The existing
independent release configuration can version just this project. The manual
release workflow accepts `nx-nest`, and the publish workflow selects it from a
`nx-nest@<version>` tag. Packaging uses `packages/nest/package.json` and its
in-place `dist` directory. No publishing is performed as part of shell setup.

## License and upstream path

All new code under `packages/nest` is MIT-licensed under the adjacent
[LICENSE](./LICENSE), an explicit package-level exception to the repository's
root Apache-2.0 license. Contributions to this package must retain that license
and existing attribution so the core can be contributed to the MIT-licensed Nx
repository without a later relicensing step.

The architectural reference remains
[Nx PR #35551](https://github.com/nrwl/nx/pull/35551). Discovery follows its
config-directory and sibling-manifest rules, without its private Nx API or
target-cache dependencies. The deleted Anarchitects implementation is not restored.
