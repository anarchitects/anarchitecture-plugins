# @anarchitects/nest

An incubator for stable NestJS v12 integration with Nx. The portable core is
intended for eventual contribution to `@nx/nest`, rather than a permanent fork.

## Status

This package discovers Nest projects and infers cacheable build and continuous
start targets through the `@anarchitects/nest/plugin` entrypoint. Build outputs
are resolved from the effective Nest TypeScript configuration. The `init`
generator validates Nest v12 declarations and registers inference. The revived
MVP is published on npm as
[`@anarchitects/nest@0.0.1`](https://www.npmjs.com/package/@anarchitects/nest/v/0.0.1).
See the [release notes, verification record, and known limitations](https://github.com/anarchitects/anarchitecture-plugins/blob/main/docs/releases/nest-0.0.1.md)
for the scope delivered under
[epic #478](https://github.com/anarchitects/anarchitecture-plugins/issues/478).

## Architecture and ownership

Nest owns framework behavior; Nx owns workspace orchestration. This plugin
connects the two by translating existing Nest configuration into Nx metadata.
Running the official `nest build` and `nest start` commands keeps compiler,
bundler, asset handling, and startup behavior with Nest instead of duplicating
them in an executor. Framework scaffolding belongs to the official Nest CLI
and schematics, which avoids maintaining copies of Nest templates.

| Concern                                                                               | Owner                                                       | Plugin boundary                                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Framework configuration, compilation, startup, and scaffolding                        | Nest CLI and schematics                                     | Read configuration for inference; delegate execution and application generation to Nest. |
| Project graph, task ordering, input hashing, cache storage/restoration, and overrides | Nx                                                          | Supply project and target metadata through public APIs.                                  |
| Nest discovery, build/start inference, and adoption into Nx                           | `@anarchitects/nest`                                        | Validate declarations and register inference without generating application code.        |
| Jest and Vitest targets/configuration                                                 | Their respective Nx integrations (`@nx/jest`, `@nx/vitest`) | No test target inference, runner selection, or test configuration changes.               |
| ESLint and Oxlint targets/configuration                                               | `@nx/eslint` and the workspace's chosen Oxlint integration  | No lint target inference or linter selection.                                            |
| Domain layout, governance, platform preferences, and validation conventions           | Application teams and optional Anarchitects tooling         | Keep these policies outside the portable core and opt in explicitly.                     |

Register test and lint integrations separately, according to the tools used by
the workspace. The presence of Jest, Vitest, ESLint, or Oxlint configuration does
not cause this plugin to add targets. Nx may still expose targets from package
scripts, explicit project configuration, or other plugins.

## Compatibility

| Peer          | Supported range | Reason                                                                                              |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `nx`          | `>=23.2.0 <24`  | Initial validation uses the repository's Nx 23.2 baseline; older and future majors are not claimed. |
| `@nx/devkit`  | `>=23.2.0 <24`  | Keep the plugin API aligned with the installed Nx version.                                          |
| `@nestjs/cli` | `>=12.0.0 <13`  | Stable Nest v12 CLI only; prereleases and older majors are excluded.                                |

Use the same version of `nx` and `@nx/devkit`. Node.js must satisfy
`^22.22.3 || ^24.15.0 || >=26.0.0`, matching the stable Nest schematic runtime.
This is the upcoming 0.0.2 development contract: upgrade Node before updating
from 0.0.1. The published 0.0.1 contract remains recorded in its
[release notes](https://github.com/anarchitects/anarchitecture-plugins/blob/main/docs/releases/nest-0.0.1.md).
The generation runtime requires TypeScript `>=6.0.0 <7`; 0.0.1 also supported 5.9.
The CLI peer establishes the framework tooling contract; the plugin does not
install or import the application's `@nestjs/core` or platform adapter.
Application dependencies remain owned by the Nest project.

These ranges establish the package contract. The
[Nest v12 E2E suite](https://github.com/anarchitects/anarchitecture-plugins/blob/main/packages/nest-e2e/README.md) validates standalone ESM/CommonJS,
nested solution workspaces with inherited outputs, and tsc/Rspack monorepos.
Each fixture runs real inferred builds, restores outputs from cache, and starts
a Nest HTTP application using the packed plugin and pinned stable dependencies.

### Tested Nest v12 project shapes

| Shape                                   | Covered behavior                                                                   | Limit                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Standalone ESM / NodeNext               | Root project with `tsconfig.build.json` fallback                                   | Uses the tsc builder.                                                                                                    |
| Standalone CommonJS                     | tsc builder `configPath` selection                                                 | Does not change the application's module system.                                                                         |
| Nested project in a TypeScript solution | Explicit `tsConfigPath`, inherited output outside the project, custom target names | Solution references do not create extra Nx nodes or output entries.                                                      |
| Nest monorepo with tsc                  | Application plus shared library, real build and startup                            | Existing members remain within the owner; members with Nx `project.json` also get named targets.                         |
| Nest monorepo with Rspack               | ESM application plus shared library, real bundle and startup                       | Tested with an explicit bundler config retaining `dist`; arbitrary bundler output overrides require explicit Nx outputs. |

The fixture baseline is Nest CLI 12.0.0, Nest common/core/platform-express 12.1.2,
Nx 23.2.0, TypeScript 6.0.3, and Rspack 2.1.10. This is a tested baseline within
the peer ranges, not validation of every version combination. Other builders,
platform adapters, and transports are not covered by this matrix. The plugin
does not select or replace them; execution follows the application's Nest config.
Nest prereleases and majors other than v12 are outside the supported contract.

## Installation and registration

Install the released MVP in an Nx workspace with stable Nest v12 dependencies:

```sh
yarn nx add @anarchitects/nest@0.0.1
```

`nx add` invokes the package's `init` generator. For an already installed package,
run it directly; custom target names are optional:

```sh
yarn nx g @anarchitects/nest:init
yarn nx g @anarchitects/nest:init --buildTargetName=compile --startTargetName=serve
```

The generator registers the following entry in the existing `plugins` array in
`nx.json` (manual registration remains supported):

```json
{
  "plugins": ["@anarchitects/nest/plugin"]
}
```

Init validates before writing. It checks declared dependencies, devDependencies,
peerDependencies, and optionalDependencies in every non-ignored `package.json`,
including nested workspace packages. Nest CLI, common, core, platform-express,
platform-fastify, microservices, websockets, and testing declarations must use
stable semver ranges wholly within `>=12.0.0 <13`. Independently versioned
integrations such as Swagger and TypeORM are not treated as framework versions.
At least one workspace or project manifest must declare the CLI as more than a
peer dependency. A CLI-only workspace is accepted before applications are added.

Unsupported majors, prereleases, broad ranges spanning unsupported majors,
tags, aliases, and unresolved `workspace:`/`file:` protocols fail with the
manifest path, dependency section, and guidance. This is a declaration check,
not an inspection of installed versions; run your package manager's install
after correcting declarations. Missing CLI guidance recommends a stable v12
devDependency, for example `yarn add -D @nestjs/cli@^12` at the appropriate
workspace/project package. Init never installs packages or rewrites manifests,
lockfiles, Nest configs, or targets.

Repeated runs preserve existing names when options are omitted. Supplied names
merge into existing registrations while preserving other options, include/exclude
scopes, ordering, and unrelated Nx configuration. The root entrypoint alias
`@anarchitects/nest` is recognized too. Deliberate multiple scoped registrations
are retained; explicit name options apply to each. Effective build/start names
must be non-empty and different. No application, library, or resource is generated.

Registration discovers `**/nest-cli.json` at the workspace root or in nested
directories. A config must have a sibling `package.json` or `project.json`;
configs without either are ignored, even if a parent directory has a manifest.
The config's directory becomes the Nx project root (`.` at the workspace root).
The plugin adds `nest` technology metadata and lets Nx's built-in plugins merge
project names and explicit configuration from the manifests.

Discovery uses filenames only. Build inference reads the Nest config, project
manifests, and TypeScript configuration but never executes the Nest CLI, changes
the working directory, emits compiler output, or writes a plugin cache.
Nest `sourceRoot` and `root` fields do not relocate the owning Nx project.
Existing Nest monorepos remain one Nx project per `nest-cli.json` unless members
also have Nx `project.json` metadata. The sub-app/library generators add that
metadata, enabling separate child nodes and native named-project targets.
Members with their own `nest-cli.json` retain their independent inference.

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

### Contributor constraints for the portable core

Keep changes suitable for contribution to `@nx/nest` without bringing along
Anarchitects governance or application architecture packages. The core must
work with ordinary Nest projects and retain the ownership boundaries above.

- Keep `src/plugins/plugin.ts` a discovery adapter. Put configuration reading,
  output resolution, named-input merging, and target construction in reusable
  `src/utils/` modules. Inference must not launch processes or write files.
- Keep `src/generators/init/` limited to validation and minimal Nx registration.
  Preserve user configuration and repeat safety. The application generator
  delegates to native schematics and adds only Nx metadata. Sub-app and library
  wrappers preserve native workspace updates and add member metadata; resource
  wrappers follow in later issues.
- Delegate framework behavior to Nest. Do not copy templates, choose a compiler
  or platform for the user, or rebuild CLI behavior in custom executors.
- Keep organizational layouts, tags, boundary rules, Fastify preferences, and
  schema-validation policies in separate, optional tooling. The portable core
  must not import that tooling or change defaults to enable its opinions.
- Leave test and lint inference to the corresponding tool integrations. New
  scope requires an explicit design decision, not an incidental addition to
  Nest discovery.
- Use public Nx APIs and current `CreateNodes` / `CreateNodesContext` types.
  Preserve explicit Nx override precedence and cover behavior changes with unit
  and packed-consumer tests. Follow the compatibility boundary below if a public
  API cannot express a required operation.
- Retain the package's MIT license and attribution, and document changes to
  defaults, support ranges, and migration requirements.

The earlier
[generation strategy ADR](https://github.com/anarchitects/anarchitecture-plugins/blob/main/docs/adr/adr-nest-generation-strategy.md)
is historical proposal context. Its prerelease guidance and proposed generators
do not describe the stable v12 core implemented under epic #478.

### Application generation (0.0.2 development)

After installing with `yarn nx add @anarchitects/nest`, generate an application
inside an existing Nx workspace:

```sh
yarn nx g @anarchitects/nest:application api --directory=apps/api --dry-run
yarn nx g @anarchitects/nest:application api --directory=apps/api
yarn nx g @anarchitects/nest:application worker --directory=apps/worker --type=cjs --observe
```

`directory` is the exact workspace-relative destination. When omitted, Nest's
normalized name supplies the directory (`MyApi` becomes `my-api`). Scoped and
numeric names retain native behavior. Generation into the workspace root or
outside the workspace is rejected, as are conflicting project names and files.
Repeating generation with identical options is safe.

The wrapper forwards the stable native application's full option surface,
including `strict`, `type`, `packageManager`, `spec`, `specFileSuffix`, `format`,
and `observe`. Native defaults remain ESM, Vitest, strict TypeScript, and Oxlint;
`--type=cjs` retains the native CommonJS/Jest output. Nest owns NodeNext settings,
compiler/bundler configuration, package scripts, dependencies, and observe
instrumentation. Framework files are not patched. Explicit `--format` uses Nest's
formatter and leaves unrelated workspace source files untouched.

Only `project.json` metadata (`name`, `projectType`, and `sourceRoot`) and the
`@anarchitects/nest/plugin` registration are added for Nx. Existing plugin options
and include/exclude scopes remain in effect. No explicit targets are written.
Nx discovers the project even outside package-manager workspace globs.

Native package scripts keep Nx's normal precedence over inferred targets with
the same name. Consequently, the generated `build` and `start` scripts appear
as script targets, without the inference plugin's cache/continuous settings.
To expose those inferred settings alongside the native scripts, configure the
plugin with distinct names such as `buildTargetName: "compile"` and
`startTargetName: "serve"`. The generator preserves existing target-name choices;
it does not remove scripts or change target precedence.

Generation does not install dependencies, initialize git, or edit workspace
package-manager configuration. Choose a directory covered by your workspace
globs (or add it yourself), then install the generated application's dependencies
with your package manager before running it. `packageManager` is passed to Nest
as native generation metadata; it does not select or run an installer. Use the
full `application` generator name; `app` aliases the separate native `sub-app`
wrapper. These features are part of development toward
0.0.2 and are not available in the published 0.0.1 package.

### Sub-apps and libraries (0.0.2 development)

Use an existing Nx project containing `nest-cli.json`, `package.json`, and
`tsconfig.json` as the Nest workspace owner:

```sh
yarn nx g @anarchitects/nest:sub-app worker --project=api --dry-run
yarn nx g @anarchitects/nest:app worker --project=api
yarn nx g @anarchitects/nest:library shared --project=api --prefix=@domain
yarn nx g @anarchitects/nest:lib utilities --project=api --rootDir=modules
```

`--project` selects the owning Nx project, not a Nest member. When omitted,
the root Nest workspace takes precedence, otherwise the single Nest owner is
selected. Multiple nested owners require an explicit selection. Root and nested
TypeScript Nest workspaces are covered, including standalone-to-monorepo
conversion and adding members to an existing monorepo.

Nest owns the layout: destinations are `<rootDir>/<path>/<normalized-name>`,
relative to the selected owner, with native `apps`/`libs` defaults. `prefix`
defaults come from the selected Tree's `defaultLibraryPrefix`, then Nest's
`@app` fallback. Native language, spec suffix, and formatting options are
forwarded. Native path validation and template limitations still apply; for
example, the pinned templates use `../../tsconfig.json`, so adding extra path
depth may require project-owned TypeScript configuration afterward.

Sub-app conversion preserves Nest's Rspack configuration and its package,
TypeScript, test, and source updates. The wrapper copies no templates and adds
no framework patches. It adds Nx metadata for each native workspace member,
including the converted original application. New Nx names are
`<owner-name>-<native-name>` (for example, `api-worker` and `api-shared`);
existing names at the same root are preserved. Matching owner `sourceRoot`
metadata is migrated to the converted native source location. Other custom
metadata remains unchanged.

Project Crystal infers `nest build '<native-name>'` from the owning directory;
applications also get `nest start '<native-name>'`, while libraries get no start
target. Existing target names/scopes and explicit overrides retain precedence.
Member builds hash the owner's files conservatively and resolve outputs from
the member's TypeScript config. Existing members without Nx metadata retain
their previous owner-only behavior. Custom bundler output overrides still
require explicit Nx output configuration.

Duplicate native names and conflicting Nx metadata fail without applying partial
generation. Repeating a member name produces Nest's existing-project error;
it does not rewrite that member. Dry-run, generation, and native cwd lookups use
the pending Tree. No dependency installation, git initialization, or process cwd
change occurs. Install dependencies for the selected native package before
building; Nest's default Rspack externals discovery uses its `node_modules`.

### Native generation adapter (0.0.2 development)

`src/generation-adapter/run-nest-schematic.ts` is internal infrastructure for
[epic #498](https://github.com/anarchitects/anarchitecture-plugins/issues/498).
`init`, `application`, `sub-app` (`app`), and `library` (`lib`) are registered
publicly; resource and other wrappers arrive later. This is not a 0.0.2 publication.

The adapter runs the pinned stable `@nestjs/schematics` 12.0.6 collection with
Angular DevKit 22.2.0. Native ESM factories are imported asynchronously before
the synchronous schematic engine resolves them. No templates are copied and
no Nest CLI subprocess is launched. Nx Trees are copied into an in-memory
schematic Tree, preserving pending changes, empty files, and binary content.
Successful native creates, updates, deletes, and renames are applied back only
after generation and post-processing succeed. Internal `.git`, `.nx`, and
`node_modules` state is excluded.

`runNestSchematic(tree, { schematic, options, dryRun, postTransform })` accepts
native names and collection aliases, validates options through Nest's schema,
and preserves schema defaults and generated bytes. Formatting is left to Nest's
explicit `format` option. `dryRun: true` returns the proposed changes without
mutating even the supplied Nx Tree; normal Nx CLI dry-run remains safe because
the adapter only stages Tree changes and never commits to disk.

Native install or other scheduled tasks are returned as `deferredTasks`; the
adapter never runs them. It does not invoke a package manager, git, change cwd,
or exit the process. Only the official native generation collection is accepted;
`upgrade`/`update` and external collections are excluded. This is an adapter for
trusted Nest code, not a sandbox for arbitrary third-party schematics.

Optional Nx post-processing receives an additive API, not a writable Tree:
`createFile` only creates missing files (or retains identical bytes), and
`addJsonProperties` adds missing keys to `nx.json`, `project.json`, or
`package.json`. Existing values and arrays cannot be replaced. All generated
source files and Nest/TypeScript configuration are protected from patching.
A failed transform discards the entire staged generation result.

`readJson` returns detached JSON for deriving metadata, without providing write
access to native files. `workingDirectory` scopes native paths to a selected
owner. The member wrappers isolate native host reads in a worker thread: the
sub-app package-name lookup and library config lookup read the scoped Tree.
Only those exact paths are bridged; runtime modules/templates use normal reads.
The parent filesystem APIs and cwd are untouched, including concurrent calls.
The worker uses production generation semantics because Nest skips source
conversion when `NODE_ENV=test`.

Nest CLI `generateOptions` merging for element generators belongs to the later
wrappers; the adapter does not emulate the entire CLI configuration lookup.

### Nx API compatibility boundary

The #484 audit found no handwritten private Nx imports, but TypeScript inferred
a private `nx/src/config/workspace-json-project-json.js` reference in the emitted
`named-inputs.d.ts` return type. An explicit return type using public
`ProjectConfiguration['namedInputs']` removes that declaration dependency without
changing runtime behavior. The only Nx import entrypoint in shipped code and
declarations is now public `@nx/devkit`:

| API                                          | Use                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `createNodesFromFiles`, `CreateNodes`        | Discovery adapter in `src/plugins/plugin.ts`                                                          |
| `readJsonFile`                               | Nest/project configuration reads in `src/utils/read-build-outputs.ts` and `src/utils/named-inputs.ts` |
| `CreateNodesContext`, `ProjectConfiguration` | Named-input reader's public context/configuration types                                               |
| `NxJsonConfiguration`, `TargetConfiguration` | Pure build/start target construction types                                                            |

Generators additionally use public `readJson`, `writeJson`, `readNxJson`,
`updateNxJson`, `getProjects`, `visitNotIgnoredFiles`, and `Tree` for validation
and configuration edits.

`CreateNodes` and `CreateNodesContext` are the current types for the supported
Nx baseline. The `createNodesV2` runtime export remains an alias of `createNodes`;
the deprecated `CreateNodesV2` and `CreateNodesContextV2` types are not used.

Public APIs and local utilities already replace the internal helpers needed by
an in-tree Nx plugin: named inputs are merged from public configuration, build
hashes use public target inputs, and TypeScript's public parser resolves effective
compiler options. There is no private Nx hashing, workspace-context, tsconfig,
or inference-cache helper to wrap. No `nx-compat` runtime module is needed today.

If a future feature demonstrably requires a private API, isolate that operation
under `src/nx-compat/` with a narrow typed adapter. Document the exact import,
supported Nx versions, why public alternatives do not suffice, and its failure
behavior; add focused adapter tests before making a file-specific exception to
the API boundary check. Nest config parsing, path selection, and target
construction stay in `src/utils/`, outside that adapter. Do not make it a general
re-export of Nx internals.

`nx-api-boundary.spec.ts` checks static imports, re-exports, import types,
CommonJS requires, and literal dynamic imports in production source, compiled
JavaScript, and declarations against the audited public entrypoint allowlist.
New Nx entrypoints require review even if they may be public. Computed module
loading is not covered by this static check and must not be used to bypass it.
Test-only Nx CLI resolution (`nx/bin/nx.js`) runs the installed CLI in consumer
fixtures; it is not shipped or used by plugin inference.

For Nx upgrades, rerun the boundary check through the test target and the
packed-package consumer tests, then build, lint, and typecheck. The consumer tests
exercise both public entrypoints, root/nested discovery, target naming, config
inheritance, and Nx override precedence. These checks validate the installed
Nx baseline; they do not claim a multi-version compatibility matrix. Keep `nx`
and `@nx/devkit` aligned within the documented peer range.

### Validation and publishing

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest
yarn nx e2e nx-nest-e2e
yarn nx release --projects nx-nest --dry-run
```

The TypeScript, Jest, ESLint, and publish targets are inferred by the workspace's
existing Nx plugins. Tests depend on the build to verify the actual packed
artifact, including both entrypoints, the shipped declarations and license,
and build/start inference through Nx's project graph in a temporary consumer workspace.

The Nx project is `nx-nest`; the npm package is `@anarchitects/nest`. The existing
independent release configuration can version just this project. The manual
release workflow accepts `nx-nest`, and the publish workflow selects it from a
`nx-nest@<version>` tag. Packaging uses `packages/nest/package.json` and its
in-place `dist` directory. Version 0.0.1 was released through the manual release
workflow and published manually to npm. Subsequent releases use the existing
release tag as their baseline; `--first-release` is no longer needed.

## License and upstream path

All new code under `packages/nest` is MIT-licensed under the adjacent
[LICENSE](./LICENSE), an explicit package-level exception to the repository's
root Apache-2.0 license. Contributions to this package must retain that license
and existing attribution so the core can be contributed to the MIT-licensed Nx
repository without a later relicensing step.

[Nx issue #35503](https://github.com/nrwl/nx/issues/35503) records the broader
exploration of a modern Nest v12 integration with Project Crystal and delegation
to Nest tooling. Its ideas about generators, test/lint targets, and opinionated
defaults are proposal context, not features promised by this package.

[Nx PR #35551](https://github.com/nrwl/nx/pull/35551) is the concrete architectural
reference for Nest config discovery and CLI-backed build/start inference,
including effective TypeScript output resolution. This package follows the
config-directory and sibling-manifest discovery rules using public Nx APIs and
local utilities, without private Nx helpers or a plugin target cache. The deleted
Anarchitects implementation is not restored.

This repository provides an incubator for validating that portable core with
packed-package consumers before proposing it upstream. Eventual integration
into `@nx/nest` is the intent; upstream acceptance, timing, and a migration path
remain subject to upstream review and a future release plan. Optional
Anarchitects policies must remain separable from any such contribution.
