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

| Concern                                                                               | Owner                                                       | Plugin boundary                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Framework configuration, compilation, startup, and scaffolding                        | Nest CLI and schematics                                     | Read configuration for inference; delegate execution and native generation to Nest.    |
| Project graph, task ordering, input hashing, cache storage/restoration, and overrides | Nx                                                          | Supply project and target metadata through public APIs.                                |
| Nest discovery, build/start inference, and adoption into Nx                           | `@anarchitects/nest`                                        | Validate declarations and register inference without generating application code.      |
| Jest and Vitest task integration                                                      | Their respective Nx integrations (`@nx/jest`, `@nx/vitest`) | Delegate Vitest inference and configure its Nest transform during member generation.   |
| ESLint and Oxlint task integration                                                    | `@nx/eslint` or Nx package-script targets                   | Infer no lint targets; repair the native Oxlint script scope during member generation. |
| Domain layout, governance, platform preferences, and validation conventions           | Application teams and optional Anarchitects tooling         | Keep these policies outside the portable core and opt in explicitly.                   |

Member generation configures native Oxlint scope and, for ESM, the Vitest integration
described below. For other test/lint tools or adoption of existing projects, register their integrations
separately. Nest inference itself only supplies build/start targets; Nx also
exposes package scripts, explicit targets, and targets inferred by other plugins.

## Native generators (0.0.2 development)

Application, resource, sub-app, library, and structural artifact generators
support `--skipInstall` (default `false`). They install once through Nx after
successful generation when native tasks, dependency changes, or newly registered
application workspace membership require it. Unchanged dependencies and
configuration-only edits do not request installation. Dry runs and failed
generation never install. Dependency ownership and package-manager/hoisting
settings stay with the existing workspace. This lifecycle addresses
[#544](https://github.com/anarchitects/anarchitecture-plugins/issues/544).

The complete native generation surface is available in this development branch.
The published 0.0.1 MVP provides `init` and inference; these generators are part
of the upcoming 0.0.2 release under [#498](https://github.com/anarchitects/anarchitecture-plugins/issues/498).
Install released versions through `nx add @anarchitects/nest`; use a packed build
of this branch when testing generation before publication.

| Generator       | Alias    | Purpose                                                      |
| --------------- | -------- | ------------------------------------------------------------ |
| `application`   | —        | Independent Nest application and package inside Nx.          |
| `sub-app`       | `app`    | Application member within an existing native Nest workspace. |
| `library`       | `lib`    | Native Nest CLI member or independent Nx-native library.     |
| `configuration` | `config` | Native `nest-cli.json` for an existing Nx project.           |
| `resource`      | `res`    | Native REST, GraphQL, microservice, or WebSocket resource.   |
| `class`         | `cl`     | Class.                                                       |
| `controller`    | `co`     | Controller and native module registration.                   |
| `decorator`     | `d`      | v12 Reflector decorator.                                     |
| `filter`        | `f`      | Exception filter.                                            |
| `gateway`       | `ga`     | WebSocket gateway.                                           |
| `guard`         | `gu`     | Guard.                                                       |
| `interceptor`   | `itc`    | Interceptor.                                                 |
| `interface`     | `itf`    | TypeScript interface.                                        |
| `middleware`    | `mi`     | Middleware.                                                  |
| `module`        | `mo`     | Module and native module registration.                       |
| `pipe`          | `pi`     | Pipe.                                                        |
| `provider`      | `pr`     | Provider and native module registration.                     |
| `service`       | `s`      | Service and native module registration.                      |
| `resolver`      | `r`      | GraphQL resolver.                                            |

`init` is the Nx adoption/registration generator, not a Nest schematic. All
nineteen generators above directly delegate framework files to the official
pinned stable `@nestjs/schematics` collection. The public catalog and aliases
are checked against that collection in the packed-package tests.

Use `application` for independent Nx applications. Nx's monorepo does not
require a native Nest monorepo; `app` specifically means `sub-app`, not
`application`. Native sub-apps/libraries share their owner's package and CLI
configuration. For example:

```sh
yarn nx g @anarchitects/nest:application api --directory=services/api
yarn nx g @anarchitects/nest:application admin --directory=services/admin --type=cjs
yarn nx g @anarchitects/nest:app worker --project=api
yarn nx g @anarchitects/nest:lib shared --project=api
yarn nx g @anarchitects/nest:res users --project=api-worker --type=rest
yarn nx g @anarchitects/nest:s cache --project=api --nestProject=shared
```

`project` selects an Nx project. Artifact/resource `nestProject` selects a native
member within the chosen owner; native paths remain relative to that owner.
Select a project explicitly when several independent Nest owners exist. See the
individual generator sections below for default precedence, supported options,
registration behavior, dependency installation, and safe dry runs.

### Native ownership and optional extensions

Nest owns source templates, DTOs, module imports, module-system choices,
Vitest/Jest, oxlint, and compiler/bundler output. Nx supplies project selection,
Tree changes, additive project metadata, and inferred tasks. Generators do not
rewrite native output into an Anarchitects architecture or select a Standard
Schema library. Formatting follows the native opt-in options.

`upgrade` and its alias `update` are deliberately absent: upgrading existing
applications is a migration concern with its own execution and safety contract,
not part of this generation adapter.

Fastify scaffolding is separate, optional work tracked in
[Fastify epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508).
It is not part of the native surface delivered by #498. That work layers an
explicit platform choice over native application generation; it does not change
the native defaults documented here. Domain layouts, governance conventions,
and schema-library-specific scaffolding likewise belong to separately opted-in
extensions. No Fastify or schema-library generator is advertised by this package.

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
platform adapters, and transport runtime combinations beyond the HTTP/TCP
compatibility fixtures are not covered by this matrix. The plugin
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
  wrappers preserve native workspace updates, add member metadata, and complete
  Rspack and Vitest workspace setup. Resource and structural artifact generation
  delegate code and module imports to Nest as well.
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

`project.json` metadata (`name`, `projectType`, and `sourceRoot`), the
`@anarchitects/nest/plugin` registration, and package-manager workspace membership
are added for Nx. Existing plugin options
and include/exclude scopes remain in effect. No explicit targets are written.
The generated package is registered even when its directory is outside existing
package-manager workspace globs.

Native package scripts keep Nx's normal precedence over inferred targets with
the same name. Consequently, the generated `build` and `start` scripts appear
as script targets, without the inference plugin's cache/continuous settings.
To expose those inferred settings alongside the native scripts, configure the
plugin with distinct names such as `buildTargetName: "compile"` and
`startTargetName: "serve"`. The generator preserves existing target-name choices;
it does not remove scripts or change target precedence.

Application generation registers the package, then returns one Nx install callback
when dependencies or workspace membership change. Nx commits the Tree before
installing with the containing workspace's package manager:

```sh
yarn nx g @anarchitects/nest:application api --directory=packages/api --packageManager=yarn
yarn nx run-many -t build test test:e2e lint -p api
```

Application registration adds the exact destination to the surrounding
workspace configuration only when no existing entry or glob covers it:

| Workspace package manager | Registration location                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| npm, Yarn, Bun            | Root `package.json#workspaces` (also preserves Yarn's object form and `nohoist`). |
| pnpm                      | `pnpm-workspace.yaml#packages`, creating the file when needed.                    |

The containing workspace's `packageManager` declaration takes precedence, then
its lockfile, an existing `pnpm-workspace.yaml`, and `nx.json#cli.packageManager`.
When none exists, the native `--packageManager` option is the fallback, or npm
when omitted. The option is still forwarded unchanged to Nest; installation uses Nx's
workspace package-manager selection.

Unrelated entries, manifest fields, pnpm settings/comments, and hoisting policies
are preserved. Covered declarations remain byte-for-byte unchanged. Custom
`--directory` values and repeated registration work the same way. Explicit
workspace exclusions or malformed configuration fail before native files are
staged: choose another destination or edit the exclusion yourself. Registration
is staged in the Nx Tree only after native generation succeeds. `--dry-run`
writes no files, changes no lockfile, and installs nothing. `--skipInstall`
stages the same native and workspace changes but omits the install callback;
run your normal workspace install afterward. No generator initializes git.

Existing applications can be registered by repeating the original application
command with identical options (provided their native files still match), or
by adding their directory to the corresponding workspace declaration and running
a normal install. Loading the inference plugin does not edit workspace settings.
See [#542](https://github.com/anarchitects/anarchitecture-plugins/issues/542).

Use the full `application` generator name; `app` aliases the separate native
`sub-app` wrapper. These features are part of development toward 0.0.2 and are
not available in the published 0.0.1 package.

#### CJS tests in Yarn package workspaces

The pinned Nest 12.0.6 CJS template invokes Jest through
`./node_modules/jest/bin/jest.js`. This comes from the
[official Nest application template](https://github.com/nestjs/schematics/blob/master/src/lib/application/files/ts/package.json).
With Yarn's default `node-modules` hoisting, Jest can instead live at the Nx
workspace root. The generated `test` and `test:e2e` scripts then fail with
`Cannot find module .../node_modules/jest/bin/jest.js`.
The plugin preserves these native scripts; it does not infer Jest targets or
silently change dependency placement. This limitation and its verified consumer
configurations are tracked in [#533](https://github.com/anarchitects/anarchitecture-plugins/issues/533).

To keep default hoisting, invoke Yarn's Jest binary resolution through Nx from
the workspace root. Replace `legacy-api` with your Nx project name. These shell
examples use POSIX environment assignment:

```sh
NODE_OPTIONS=--experimental-vm-modules yarn nx exec --projects=legacy-api -- yarn jest --runInBand
NODE_OPTIONS=--experimental-vm-modules yarn nx exec --projects=legacy-api -- yarn jest --config ./test/jest-e2e.json --runInBand
NODE_OPTIONS=--experimental-vm-modules yarn nx exec --projects=legacy-api -- yarn jest --coverage --runInBand
```

Nx runs each command from the selected project's directory, so the native Jest
and TypeScript configurations remain in use. Keep the VM-modules flag: native
CJS tests can load ESM dependencies. These are explicit consumer commands, not
additional targets inferred by the Nest plugin. For persistent test-target
integration, configure the workspace's Jest integration separately.

Alternatively, to use the original generated scripts, merge the following
consumer-owned setting into **the generated application's** `package.json`,
then run `yarn install` from the workspace root:

```json
{
  "installConfig": {
    "hoistingLimits": "workspaces"
  }
}
```

This Yarn setting keeps that application's dependencies within its workspace.
It can increase installation size, but leaves the root hoisting policy and
other workspaces' policies unchanged. It is optional and is never added by a
generator. The original tasks can then run normally:

```sh
yarn nx run legacy-api:test
yarn nx run legacy-api:test:e2e
yarn nx run legacy-api:test:cov
```

The native `test:watch`, `test:cov`, and `test:debug` scripts also assume local
Jest paths. With default hoisting, use the explicit command above with
`--watch` for watch mode or `--coverage` for coverage. For the unchanged native
debug script (which uses `node_modules/.bin/jest` and `--inspect-brk`), use the
package-scoped hoisting setting before starting it. Unit, HTTP integration,
and coverage runs are exercised in the real-install regression; interactive
watch sessions and debugger attachment are not automated by that test.

### Sub-apps and libraries (0.0.2 development)

Use an existing Nx project containing `nest-cli.json`, `package.json`, and
`tsconfig.json` as the Nest workspace owner:

```sh
yarn nx g @anarchitects/nest:sub-app worker --project=api --dry-run
yarn nx g @anarchitects/nest:app worker --project=api
yarn nx g @anarchitects/nest:library shared --project=api --prefix=@domain
yarn nx g @anarchitects/nest:lib utilities --project=api --rootDir=modules
```

`--project` selects the owning Nx project, not a Nest member. Libraries now
require an explicit ownership selector, including workspaces with only one Nest
owner: add `--project=<owner>` to existing library commands that omit it.
Sub-apps retain automatic selection: the root Nest workspace takes precedence,
otherwise the single Nest owner is selected. Multiple nested owners require an
explicit selection. Root and nested
TypeScript Nest workspaces are covered, including standalone-to-monorepo
conversion and adding members to an existing monorepo.

Use `--directory=libs/users` for a new independent Nx library/package, as
described below. Supply exactly one of `--project` or `--directory`. `rootDir`, `path`, and `prefix` apply only
to native libraries selected with `--project`; `directory` is the complete
workspace-relative destination. The `library` / `lib` names and `--skipInstall`
remain unchanged.

Nest owns the layout: destinations are `<rootDir>/<path>/<normalized-name>`,
relative to the selected owner, with native `apps`/`libs` defaults. `prefix`
defaults come from the selected Tree's `defaultLibraryPrefix`, then Nest's
`@app` fallback. Native language, spec suffix, and formatting options are
forwarded. Native path validation and template limitations still apply; for
example, the pinned templates use `../../tsconfig.json`, so adding extra path
depth may require project-owned TypeScript configuration afterward.

Sub-app conversion retains Nest's Rspack builder and its package, TypeScript,
test, and source updates, then completes the compiler setup described below.
The wrapper copies no templates and adds no framework patches. It adds Nx metadata for each native workspace member,
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
the pending Tree. Member generation returns an Nx dependency-install task when required;
`--skipInstall` skips that task, and dry runs never install packages. Generation
does not initialize git or change the process cwd.

#### Independent Nx-native library containers

```sh
yarn nx g @anarchitects/nest:library users --directory=libs/users --dry-run
yarn nx g @anarchitects/nest:library users --directory=libs/users
yarn nx g @anarchitects/nest:lib @acme/support --directory=libs/support
```

This creates a private, source-only TypeScript package with its own
`package.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`,
`src/index.ts`, and initial Nest module. The module comes from the official
stable Nest v12 module schematic. Package and Nx project names are identical:
`users` or `@acme/support` above. Names normalize to kebab case; the unscoped
part must start with a letter and contain only letters, digits, or hyphens.
`directory` selects the complete destination, independently of the name.
Existing names, non-empty destinations, and overlapping project/package roots
are rejected before any files are staged.

The package owns `@nestjs/common`, `reflect-metadata`, and `rxjs`. It is
registered using the same package-manager detection, glob/exclusion handling,
and deferred Nx install as applications. `--skipInstall` stages the package and
workspace changes without installing; `--dry-run` writes and installs nothing.
The package exports its TypeScript source and is not configured for publishing.
Only TypeScript (`--language=ts`) is supported in this mode. The initial module
has no spec; `specFileSuffix` has no effect on this initial output. `--format`
remains opt-in for native module generation.

The project carries `metadata.nest.kind: "nx-library"`, distinguishing it from
ordinary shared libraries. Its initial compiler configuration is local and
uses ESM/NodeNext and Nest decorators. It can coexist with a
native library such as `packages/api/libs/internal`. There is no new runtime
dependency on `@nx/js` and no added Nest build/start target or inference
registration for this container.

Artifact/resource generation by Nx project name is tracked in
[#551](https://github.com/anarchitects/anarchitecture-plugins/issues/551),
[#552](https://github.com/anarchitects/anarchitecture-plugins/issues/552), and
[#553](https://github.com/anarchitects/anarchitecture-plugins/issues/553),
and application consumption in
[#554](https://github.com/anarchitects/anarchitecture-plugins/issues/554).
The source-only entrypoint requires a TypeScript-aware consumer; it is not a
precompiled Node.js package. Existing workspace tools may infer tasks from the
generated files; this generator does not install build/test/lint tooling.

#### Workspace TypeScript linking

The generator detects these supported root layouts, in this order:

| Workspace model                                                                                                              | Generated integration                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json` has empty `files`/`include` and a `references` array                                                         | Append one root reference to the library; preserve existing references and do not add paths.                      |
| Empty Nx solution extending `tsconfig.base.json`, whose compiler options enable `composite` and do not disable `declaration` | Same reference integration, including the first project in a new solution.                                        |
| `tsconfig.base.json` already declares `compilerOptions.paths`, including an empty object                                     | Add only the library's package-name alias to its source entrypoint. Existing aliases and `baseUrl` are preserved. |
| No recognized linking model                                                                                                  | Retain a standalone local config; do not invent root aliases or references.                                       |

Reference and alias libraries extend the existing root base config when present.
Nest decorators and ESM/NodeNext options remain local; root module settings,
Angular compiler options, existing aliases, and other projects' configuration
are preserved. Native `--project` libraries retain their owner-controlled Nest
CLI configs and do not use this integration.

Reference libraries are composite projects with `rootDir: "src"`, a local
`tsconfig.lib.json`, and a declaration output directory. Existing Nx TypeScript
sync tooling can maintain their dependency references. Alias libraries instead
use a non-composite program rooted at the workspace, so imported shared source
does not fail the composite file-list or project-local `rootDir` checks. Alias
destinations are relative to the existing `baseUrl`, or explicitly relative to
`tsconfig.base.json` when no `baseUrl` is set. A conflicting exact alias is an
error before generation; user mappings are never replaced.

Package dependencies still belong to their consuming packages. For example,
in a Yarn workspace using the existing `@nx/js/typescript` inference plugin:

```sh
yarn workspace @acme/consumer add @acme/users
yarn nx sync
yarn nx run @acme/consumer:typecheck
```

The generator does not install that plugin, migrate linking models, rewrite
arbitrary third-party tsconfig inheritance, or add dependency references for
imports that do not exist yet. Root reference/alias registration is duplicate-safe,
including equivalent predeclared entries. Re-running library creation still
rejects an existing project without modifying its linking metadata. Dry runs and
failed native generation leave all root linking files untouched.

#### Rspack setup for native members

The pinned native conversion selects Rspack without declaring its compiler
packages. The sub-app/library wrappers complete that setup automatically:

- Add missing `@rspack/core` (`^2.1.10`), `webpack-node-externals` (`^3.0.0`),
  and `tsconfig-paths-webpack-plugin` (`^4.2.0`) dev dependencies to the owning
  Nest package. Existing dependency versions and sections are preserved.
- For a default Rspack builder, create `rspack.config.cjs` beside `nest-cli.json`
  and set the builder's `options.configPath` to it. This extends Nest's defaults
  with external dependency discovery in the owner and ancestor `node_modules`
  directories up to the Nx workspace root. Native sources, scripts, TypeScript
  settings, compiler plugins, and output settings remain Nest-owned.
- Return one Nx install task when dependencies change, using the workspace package manager. Keep the owner
  covered by your package-manager workspace globs. Members share its manifest;
  they do not need separate dependency declarations.

For an owner named `api` at `packages/api`:

```sh
yarn nx g @anarchitects/nest:sub-app worker --project=api
yarn nx g @anarchitects/nest:library shared --project=api
yarn nx run-many -t build -p api-api api-worker api-shared --parallel=1
yarn nx run api-api:start
# After stopping the first app (both native apps default to port 3000):
yarn nx run api-worker:start
```

Use `--skipInstall` to generate the same manifest/configuration changes and run
`yarn install` yourself later. Dry runs stage changes without writing files or
running the install callback. The wrappers never change the root hoisting policy
or add `installConfig.hoistingLimits`; ESM and CJS real-install regressions cover
all three member builds and both HTTP applications with default Yarn hoisting.

An existing explicit `builder.options.configPath` takes precedence and is
preserved, as is Nest's implicit `rspack.config.js`. An existing
`rspack.config.cjs` is reused without overwriting it when no other configuration
is selected. Custom configurations remain consumer-owned, including their
externalization rules and any explicit Nx output overrides. Other package
managers and custom bundler settings require their own dependency-layout
validation.

Nest CLI still owns compilation through `nest build` and `nest start`.
`@nx/rspack` is not required for this integration: it supplies a separate Nx
Rspack build integration, while Nest directly uses `@rspack/core`.

For owners generated before this fix, generating another member applies the
setup. To update an owner without adding a member, add the three compiler dev
dependencies to its package using your package manager and provide a Nest Rspack
configuration that externalizes hoisted dependencies. Existing owners are not
modified merely by loading the inference plugin.

This workflow addresses [#534](https://github.com/anarchitects/anarchitecture-plugins/issues/534).
Converted-monorepo Vitest and lint setup are described below.

#### Oxlint setup for native members

Nest 12.0.6 leaves its lint script pointing at `src/ test/` when a sub-app moves
those directories into the member tree. On sub-app or library generation, the
wrapper replaces only the exact native default `oxlint --type-aware src/ test/`
with this owner-wide command:

```sh
oxlint --type-aware --ignore-pattern "**/dist/**" --ignore-pattern "**/coverage/**" .
```

This includes application and library source, unit tests, HTTP tests, and owner
configuration files, including custom `rootDir`/`path` destinations. It also
works when a library is added before sub-app conversion. Build and coverage
outputs are excluded; Oxlint retains its own dependency and ignore-file rules.
The existing `.oxlintrc.json`, rule severities, dependency versions, and TypeScript
configurations are preserved. Type-aware checking uses
[Oxlint's TypeScript project discovery](https://oxc.rs/docs/guide/usage/linter/cli.html),
not a separate Nest lint executor.

Nx exposes the package script on the **owner**, so run:

```sh
yarn nx run api:lint
```

Members such as `api-worker` and `api-shared` do not receive duplicate lint
targets. The wrapper includes the owner's full subtree in its default named
inputs so nested member edits invalidate owner tasks when caching is enabled.
It does not enable lint caching or override explicit target inputs; custom
cache inputs must include the member files too.

A custom lint script, explicit Nx target, or `nx.includedScripts` restriction
retains precedence. Consumers using another lint integration configure its
scope themselves. Loading the inference plugin never rewrites configuration.
For an existing owner, generating another member repairs an unchanged native
script. To repair without generating a member, update that script to the command
above and, if caching lint, include `{workspaceRoot}/packages/api/**/*` in the
owner's default named inputs (adjust the path for your owner). Reconcile stale
`src`/`test` copies from earlier conversions as described below before linting.

The pinned native **CJS sub-app** template ends `src/main.ts` with
`bootstrap();`, which violates its own `no-floating-promises` rule. The corrected
lint scope now reports this real violation. In that member's `src/main.ts`,
explicitly mark the bootstrap promise as intentionally unawaited:

```ts
void bootstrap();
```

Alternatively, attach your application's startup error handler. The wrapper
preserves the native source and rule rather than suppressing the finding; the
ESM sub-app template already uses `await bootstrap()`. The CJS consumer regression
first asserts this failure, then applies the documented source change.

Real Yarn consumers verify ESM and CJS, library-first and sub-app conversion,
custom roots, ignored output, and deliberate `no-floating-promises` violations
in app/library source and tests after warming Nx's cache. This addresses
[#536](https://github.com/anarchitects/anarchitecture-plugins/issues/536).

#### Vitest setup for ESM members

The ESM application generator retains Nest's standalone Vitest setup. When you
add a sub-app or library to an owner with `vitest.config.ts` or
`vitest.config.e2e.ts`, the member generators complete the converted-workspace
setup using [Nest's documented SWC integration](https://docs.nestjs.com/recipes/swc#vitest)
and the [Nx Vitest plugin](https://nx.dev/docs/technologies/test-tools/vitest/introduction):

- Add `@swc/core` and `unplugin-swc` to the owning package, preserving existing
  versions. Merge a SWC plugin into statically readable Vitest plugin arrays,
  with explicit legacy decorators, metadata emission, and ESM output. Existing
  test globs, settings, and other plugins remain intact.
- Create `tsconfig.spec.json` if absent, extending the owner's TypeScript config
  and including its app and library files. Point the native zero-argument
  `vite-tsconfig-paths` call at this config. A converted root is a solution with
  `files: []` and app references; it does not cover library specs for alias
  resolution. Existing test tsconfigs and custom path-plugin options are preserved.
- Declare `@nx/vitest` aligned with Nx, plus its Vite/Vitest peers, in the workspace
  root. Register the inference plugin only if it is absent; existing plugin
  scopes, target names, CI settings, and watch/run preferences take precedence.
- For a new registration, infer the cached `vitest:test` target in single-run
  mode. Native `test`, `test:e2e`, watch, and coverage scripts remain available.
  The owner's default named inputs include its entire subtree so changes inside
  nested Nx members invalidate its test cache.

```sh
yarn nx run api:vitest:test # inferred unit-test target, unless renamed by existing Nx configuration
yarn nx run api:test       # native unit-test script
yarn nx run api:test:e2e   # native HTTP integration script and separate config
```

Unit tests are owned by the Nest package, which discovers each app/library spec
once. The integration does not generate overlapping member test targets. Nest's
separate `vitest.config.e2e.ts` filename remains driven by its package script;
it does not match the Nx plugin's inference filename convention.

The member generator returns one Nx install callback for all staged dependencies.
`--skipInstall` skips installation; dry runs neither write files nor install.
An existing SWC import is treated as consumer-owned. Dynamic config factories or
plugin expressions are preserved with guidance to add the documented transform
manually; the generator does not replace them with a private template.

The adapter now commits native schematic actions through Angular Devkit's public
in-memory sink. Nest's conversion explicitly deletes the old `src` and `test`
directories after copying them. Reading the uncommitted Tree had retained those
files, causing duplicate discovery; applying the sink matches native filesystem
semantics without touching the host filesystem.

For an owner converted with an older plugin, first compare the old source/test
files with their relocated copies and reconcile any edits before removing stale
duplicates. Adding another member applies the Vitest setup. Existing owners are
not rewritten just by loading the plugin. This resolves
[#535](https://github.com/anarchitects/anarchitecture-plugins/issues/535);
monorepo lint setup remains tracked in #536.

### Resources (0.0.2 development)

Generate into an Nx application, library, or native workspace member:

```sh
yarn nx g @anarchitects/nest:resource users --project=api --dry-run
yarn nx g @anarchitects/nest:res users --project=api --type=rest
yarn nx g @anarchitects/nest:resource events --project=api-worker --type=microservice --crud=false
yarn nx g @anarchitects/nest:resource messages --project=api --nestProject=worker --type=ws
```

`project` selects an Nx project. For a native member, the wrapper finds its
owning `nest-cli.json` and uses that member's native `sourceRoot`. An owner can
also select an existing native `projects` entry with `nestProject`, including
members without separate Nx metadata. Without `project`, the root Nest owner
takes precedence; otherwise there must be exactly one owner. Selecting an
owner without `nestProject` uses its default source root.

All native transports are supported: `rest` (default), `graphql-code-first`,
`graphql-schema-first`, `microservice`, and `ws`. `crud`, `flat`, `spec`,
`specFileSuffix`, `skipImport`, `format`, and native path-bearing names are
forwarded. `path` is relative to the resolved source root; an explicit
`sourceRoot` is relative to the owning Nest directory and overrides the
configured source root/baseDir. Nest currently supports resource generation in
TypeScript only; its JavaScript rejection is preserved.

Omitted options follow the pinned Nest CLI's resource defaults: member
`generateOptions` overrides owner settings for specs, flat layout, and spec
suffixes. Per-schematic `spec.resource` falls back to the owner's setting when
absent in a member's map. Explicit `spec` and nonempty `specFileSuffix` take
precedence. Nest's `flat` semantics are retained: `true` wins, while `false`
still consults configuration. The owner's `generateOptions.baseDir` is appended
to the configured source root. `skipImport` and `format` remain native explicit
options; no implicit formatting or additional config interpretation is added.

Nest chooses the nearest module and writes its imports, preserving `.js`
relative import extensions for ESM. Native DTOs, entities, resolvers, services,
controllers, gateways, and GraphQL files remain unchanged. No Zod, Valibot,
ArkType, or other schema library is selected, and no extra validation or
serialization layer is inserted; Nest v12 Standard Schema integration remains
available to application code.

Native dependency changes are retained, including mapped-types declarations
and existing Swagger detection. Native package-install requests become one Nx callback after Tree commit.
A REST resource that adds `@nestjs/mapped-types` is therefore immediately usable
without a manual install. Use `--skipInstall` to stage changes only; a resource
whose dependencies are already declared does not trigger an unnecessary install. Nest's resource
schematic does not install every transport runtime dependency. Nx registration
and target metadata are unchanged. Dry-runs and failures do not apply partial
file or module-import changes.

### Structural artifacts (0.0.2 development)

These generators use the same `project` / `nestProject` selection and native
source-root resolution as resources:

```sh
yarn nx g @anarchitects/nest:class dto/user --project=api
yarn nx g @anarchitects/nest:interface contract --project=api
yarn nx g @anarchitects/nest:module orders --project=api-worker
yarn nx g @anarchitects/nest:provider cache --project=api-worker --skipImport
yarn nx g @anarchitects/nest:service orders --project=api --nestProject=worker
yarn nx g @anarchitects/nest:controller orders --project=api --spec=false --dry-run
```

| Generator    | Alias | Native default layout | Specs | Native module registration |
| ------------ | ----- | --------------------- | ----- | -------------------------- |
| `class`      | `cl`  | Flat                  | Yes   | None                       |
| `interface`  | `itf` | Flat                  | No    | None                       |
| `module`     | `mo`  | New directory         | No    | `imports`                  |
| `provider`   | `pr`  | Flat                  | Yes   | `providers`                |
| `service`    | `s`   | New directory         | Yes   | `providers`                |
| `controller` | `co`  | New directory         | Yes   | `controllers`              |

The table gives the pinned **schematic** defaults when neither options nor Nest
configuration override them. `flat`, `spec`, and `specFileSuffix` defaults are
resolved after project selection; per-schematic spec keys use the full generator
name, such as `generateOptions.spec.service`. Member settings take precedence,
with owner fallback when a member's spec map omits that generator. As with
resources, `flat=true` wins; otherwise configured flat settings take precedence
over an explicit `false`, followed by that explicit value or the schematic's
default. An explicit spec flag or nonempty suffix takes precedence.

Each wrapper exposes its native option surface, including `path`, `sourceRoot`,
and `format`. Language options are retained where native schemas support them;
interfaces remain TypeScript-only. Modules and interfaces have no spec options.
Service and provider wrappers additionally expose `skipImport`, which their
pinned native factories honor even though their JSON schemas omit it. Modules
and controllers expose it directly through their native schemas.

Nest owns naming, nearest-module discovery, registration, and ESM `.js` import
extensions. Native `module` and `className` hints are forwarded where present;
the wrapper does not replace the factory's interpretation of them. No source
templates, compiler choices, test runners, or explicit Nx targets are added.
JavaScript templates are delegated where supported. Formatting remains opt-in,
and generation errors leave the pending Tree unchanged.

### Cross-cutting and transport artifacts (0.0.2 development)

These generators use the same `project` / `nestProject` selection, native source
roots, and configuration precedence as structural artifacts:

```sh
yarn nx g @anarchitects/nest:decorator roles --project=api
yarn nx g @anarchitects/nest:guard access --project=api-worker --spec=false
yarn nx g @anarchitects/nest:gateway events --project=api --nestProject=worker
yarn nx g @anarchitects/nest:resolver users --project=api --skipImport --flat
```

| Generator     | Alias | Native default layout | Specs | Native module registration |
| ------------- | ----- | --------------------- | ----- | -------------------------- |
| `decorator`   | `d`   | Flat                  | No    | None                       |
| `filter`      | `f`   | Flat                  | Yes   | None                       |
| `gateway`     | `ga`  | Flat                  | Yes   | `providers`                |
| `guard`       | `gu`  | Flat                  | Yes   | None                       |
| `interceptor` | `itc` | Flat                  | Yes   | None                       |
| `middleware`  | `mi`  | Flat                  | Yes   | None                       |
| `pipe`        | `pi`  | Flat                  | Yes   | None                       |
| `resolver`    | `r`   | New directory         | Yes   | `providers`                |

Decorators preserve Nest v12's `Reflector.createDecorator<string[]>()` output.
All eight support native `path`, `sourceRoot`, `language`, `flat`, and `format`
options. Decorators have no spec options; the others support `spec` and
`specFileSuffix`. Use full schematic names in spec maps, for example
`generateOptions.spec.gateway`.

Gateway and resolver wrappers expose `skipImport`, which their native factories
support although their JSON schemas omit it. Otherwise Nest registers them in
the nearest module's `providers`, retaining ESM `.js` extensions or CJS imports
according to the owning Nest package. Cross-cutting artifacts retain native
behavior: generating a guard, filter, interceptor, middleware, or pipe does not
bind it to a route or application automatically.

Gateways use native WebSocket templates (`@nestjs/websockets`), and resolvers use
native GraphQL templates (`@nestjs/graphql`). The selected application must
provide the corresponding transport dependencies and runtime configuration;
these native schematics do not declare transport dependencies or configure transports.
No source templates or explicit Nx targets are added. Native-output parity and
packed CLI tests cover all eight in ESM/CJS projects and native members; build
fixtures additionally cover the six cross-cutting artifacts.

### Native CLI configuration (0.0.2 development)

Use `configuration` (alias `config`) to add the official Nest CLI configuration
to an existing Nx project:

```sh
yarn nx g @anarchitects/nest:configuration --project=api
yarn nx g @anarchitects/nest:config --directory=services/api --language=js
yarn nx g @anarchitects/nest:config --dry-run
```

`project` selects an existing Nx project by name. `directory` selects a
workspace-relative directory containing `package.json` or `project.json`;
use one selector at a time. With neither selector, generation targets the
workspace root. The native schematic's `project` option represents an output
path; this wrapper resolves the Nx selector to that location before delegation.

The pinned native factory has no JSON option schema. The wrapper exposes its
`language` (`ts` / `js`) and `collection` options. Nest defaults to TypeScript,
`@nestjs/schematics`, and `sourceRoot: "src"`; the JavaScript template also
writes `language: "js"`. A custom collection is written as configuration only,
never executed during generation. No application sources, compiler configuration,
dependencies, or explicit Nx targets are generated.

Generation adds the inference plugin to `nx.json` when absent, preserving
existing registration options and scopes. The native `nest-cli.json` beside the
project manifest is recognized by Project Crystal and receives the usual
inferred build/start targets; explicit project targets keep their precedence.
Existing registration scopes still determine which projects receive inference.
Use `nx add @anarchitects/nest` to install the plugin and validate the workspace's
Nest dependencies before generating configuration.

Existing `nest-cli.json` files are never overwritten. Repeating generation with
byte-identical native output is a no-op. Differing content, including customized
settings or formatting, causes a conflict with no staged changes, even with Nx
`--force`. Edit existing configuration explicitly. Normal Nx `--dry-run` previews
both native configuration and plugin registration without writing files.

### Native generation adapter (0.0.2 development)

`src/generation-adapter/run-nest-schematic.ts` is internal infrastructure for
[epic #498](https://github.com/anarchitects/anarchitecture-plugins/issues/498).
`init`, `application`, `sub-app` (`app`), `library` (`lib`), `resource` (`res`),
`configuration` (`config`), and the structural, cross-cutting, and transport
generators above are registered publicly. This is not a 0.0.2 publication.

The adapter runs the pinned stable `@nestjs/schematics` 12.0.6 collection with
Angular DevKit 22.2.0. Native ESM factories are imported asynchronously before
the synchronous schematic engine resolves them. No templates are copied and
no Nest CLI subprocess is launched. Nx Trees are copied into an in-memory
schematic Tree, preserving pending changes, empty files, and binary content.
Successful native creates, updates, deletes, and renames are applied back only
after generation and post-processing succeed. Internal `.git`, `.nx`, and
`node_modules` state is excluded.

`runNestSchematic(tree, { schematic, options, dryRun, postTransform })` accepts
native names and collection aliases, validates options through Nest's schema
where provided, and preserves native defaults and generated bytes. Formatting is left to Nest's
explicit `format` option. `dryRun: true` returns the proposed changes without
mutating even the supplied Nx Tree; normal Nx CLI dry-run remains safe because
the adapter only stages Tree changes and never commits to disk.

Native install or other scheduled tasks are returned as `deferredTasks`; the
adapter never runs them. Public application/member/artifact wrappers inspect
`node-package` requests and dependency changes, then return an Nx
`GeneratorCallback`. Rspack and Vitest helpers report boolean requirements;
the outer generator coalesces them into one `installPackagesTask(tree, true)`
callback, including nested owner manifest changes. The install utility is shared
with future generator modes. Other native tasks are not executed. The adapter does not invoke a package manager, git, change cwd,
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

Resource and artifact generators share context/default resolution before
invoking the adapter. The adapter itself does not emulate the entire CLI
configuration lookup.

### Nest v12 compatibility matrix (0.0.2 development)

Compatibility tests retain the pinned native schematics as the source of truth.
The application matrix generates an application, native sub-app and library,
REST resource, and all structural/cross-cutting/transport artifacts in sequence.
After every step it compares native files byte-for-byte, with focused assertions
for Nx registration/project metadata and the member Rspack dependency and
configuration additions, plus the member Vitest integration.

| Contract           | Automated coverage                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module system      | Omitted `type` selects native ESM; explicit CJS, package metadata, NodeNext compiler options, and relative `.js` imports are checked.                                                                                         |
| Test tooling       | ESM retains Vitest, with SWC and a test tsconfig added for members; CJS retains Jest/ts-jest and native VM-modules scripts.                                                                                                   |
| Lint and build     | Native oxlint configuration/dependencies remain intact; native monorepo conversion retains the Rspack builder and library aliases.                                                                                            |
| Observe            | Both module systems run with `observe` enabled and disabled; native dependency and instrumentation output are preserved.                                                                                                      |
| HTTP validation    | Generated ESM/CJS apps with native REST resources compile and run with `StandardSchemaValidationPipe`, asynchronous body validation, and transforming route/query parameter schemas. Invalid input never reaches the handler. |
| Message validation | Native microservice resources coexist with TCP handlers using Standard Schema `@Payload` validation and RPC errors for invalid input.                                                                                         |
| Serialization      | `StandardSchemaSerializerInterceptor` strips private response fields over HTTP and TCP; invalid HTTP responses are rejected.                                                                                                  |
| OpenAPI            | Swagger derives request/parameter schemas from Standard Schema metadata and response schemas from `standardSchema`; input/output JSON Schema conversion is asserted.                                                          |

The runtime fixture adds consumer-owned integration code beside unchanged native
application/resource sources. It exercises generated services and verifies native
HTTP and message handlers remain reachable. A separate fixture TypeScript config
compiles this integration without rewriting generated toolchain configuration.

The private `nx-nest-e2e` project pins `@nestjs/swagger` 12.0.2,
`@nestjs/microservices` 12.1.2, `@nestjs/mapped-types` 12.0.0, and Standard Schema
interface types 1.1.0. A minimal schema object implements the standard in the
test fixture; the generator core gains no schema vendor or transport dependency.
Tooling and Observe checks verify native generation contracts; they do not
contact an Observe service or run the generated Vitest/Jest/oxlint toolchains.
A separate real-install CJS consumer regression runs the native Jest unit,
HTTP integration, and coverage suites under the supported Yarn configurations
described above. The real-install ESM consumer also runs standalone and converted
Vitest unit/HTTP suites, checking exact test discovery, library injection, aliases, and inferred
target cache invalidation. Oxlint remains outside this validation.

Run the matrix with the plugin's regular Nx test and e2e targets:

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest nx-nest-e2e
yarn nx run nx-nest-e2e:e2e
```

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
`updateNxJson`, `getProjects`, `names`, `visitNotIgnoredFiles`, and `Tree` for validation
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
