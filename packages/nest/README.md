# @anarchitects/nest

Use stable **NestJS 12** applications and libraries in an Nx workspace, alongside
Angular and other projects. Generate native Nest code, adopt existing Nest
applications, and run their builds and servers through Nx.

Nest owns framework configuration, compilation, startup, and scaffolding. Nx
owns workspace integration, the project graph, task orchestration, and caching.
Choose this package when you want native Nest CLI conventions with Nx's workspace
and task tooling. The runtime contract is **NestJS 12 only**.

## Compatibility

| Component              | Supported contract                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nx and `@nx/devkit`    | `>=23.2.0 <24`; keep their versions aligned.                                                                                                                                                                                                     |
| Nest CLI and framework | Stable `>=12.0.0 <13`; other majors and prereleases are unsupported.                                                                                                                                                                             |
| Node.js                | `^22.22.3` or `^24.15.0` or `>=26.0.0`.                                                                                                                                                                                                          |
| TypeScript             | The generation runtime requires `>=6.0.0 <7`. Generated TypeScript projects use Nest 12 compiler conventions.                                                                                                                                    |
| Module systems         | Independent applications and native members support ESM and CommonJS. New Nx-native libraries are TypeScript, ESM, and source-only.                                                                                                              |
| Package managers       | Workspace registration supports npm, Yarn, Bun, and pnpm. The complete installation/build/test workflows documented here use Yarn 4 with `nodeLinker: node-modules`; equivalent end-to-end support for every manager or Yarn PnP is not claimed. |

The supported ranges are broader than the verification baseline: Nx 23.2.0,
Nest CLI 12.0.0, Nest framework 12.1.2, and TypeScript 6.0.3. Independently versioned
Nest integrations, such as Swagger, follow their own compatibility requirements.
Your application owns its framework dependencies and platform adapter.

## Installation

Run commands from an existing Nx workspace. These examples use Yarn; use your
workspace's package-manager prefix for Nx commands (`npm exec -- nx`, `pnpm nx`,
or `bunx nx` as appropriate).

Ensure a workspace or project declares stable Nest CLI 12 as a dependency or
devDependency before initialization. For a new Nest workspace:

```sh
yarn add -D @nestjs/cli@^12
yarn nx add @anarchitects/nest
```

`nx add @anarchitects/nest` installs the plugin and invokes `init`. Initialization
validates declared Nest framework versions and registers `@anarchitects/nest/plugin`
in `nx.json`. It preserves existing plugin options and does not generate application
code, change Nest configuration, or install framework dependencies.

If you installed the package with your package manager, initialize it explicitly:

```sh
yarn add -D @anarchitects/nest @nestjs/cli@^12
yarn nx g @anarchitects/nest:init
```

An existing Nest 11 workspace must be upgraded separately before initialization.
Framework dependency ranges must stay within stable v12; tags such as `latest`,
prereleases, and unresolved local protocols are not accepted as version guarantees.

## Quick start

After installation, create an independent application:

```sh
yarn nx g @anarchitects/nest:application api --directory=packages/api --packageManager=yarn
yarn nx g @anarchitects/nest:init --buildTargetName=compile --startTargetName=serve
yarn nx show project api
yarn nx run api:compile
yarn nx run api:serve
```

Open `http://localhost:3000`. Stop the server with Ctrl+C. For watch mode, run
`yarn nx run api:serve --watch`.

The generated application also exposes its native `build`, `start`, `test`,
`test:e2e`, and `lint` package scripts through Nx. This guide uses `compile` and
`serve` for the **inferred** targets because package scripts named `build` and
`start` take precedence over same-named inferred targets, including their cache
and continuous-task settings.

Add a REST resource and run the application tests:

```sh
yarn nx g @anarchitects/nest:resource orders --project=api --type=rest --crud
yarn nx run api:test
yarn nx run api:compile
yarn nx run api:serve
```

The generated resource registers with the application. `GET /orders` returns the
native placeholder response; replace its implementation with your domain logic.

## Discovery and tasks

The plugin discovers `nest-cli.json` at the workspace root or in nested
directories. Its directory must also contain `package.json` or `project.json`.
Nx resolves the project name from that metadata; use `yarn nx show projects`
and `yarn nx show project api` to inspect it.

| Default inferred target | Behavior                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `build`                 | Runs `nest build` from the Nest owner's directory. Cacheable; waits for dependency projects' `build` targets where present. |
| `start`                 | Runs `nest start` from the Nest owner's directory. Continuous, uncached; Nest handles compilation and startup.              |

For an adopted project without overriding package scripts, the defaults work as:

```sh
yarn nx build api
yarn nx start api
```

Change target names with `init`, as in the quick start, or merge options into the
existing plugin registration in `nx.json`:

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

Names must be nonempty and different. Renaming replaces the inferred names;
`compile` then depends on `^compile`. Repeating `init` without name options keeps
existing choices. Preserve other plugins and any registration include/exclude scopes.
Nx target defaults and explicit project configuration retain their usual precedence.

Build caching includes project and dependency source (`production`/`^production`,
or `default`/`^default`), Nest CLI, and relevant TypeScript configuration. Outputs
follow the effective TypeScript `outDir`, including inherited configuration;
`dist` is the fallback. Selection uses Nest's `tsConfigPath`, then a tsc builder's
`configPath`, then `tsconfig.build.json` or `tsconfig.json`. If a custom bundler
writes elsewhere or copies assets outside that output, declare those additional
Nx `outputs` yourself. Preserve dependency inputs when customizing cache settings.

An existing Nest monorepo is discovered as one owner project. Native members with
Nx project metadata also receive their own named build targets; application
members receive start targets. The member generators below add this metadata.

### Adopt an existing application

If it already has `nest-cli.json` and project/package metadata, install the plugin
and run `init`. No source regeneration is necessary. To add a missing native Nest
configuration to an existing Nx project:

```sh
yarn nx g @anarchitects/nest:configuration --project=api --dry-run
yarn nx g @anarchitects/nest:configuration --project=api
yarn nx show project api
```

Alternatively use `--directory=packages/api`. Supply one selector; with neither,
configuration targets the workspace root. The directory must contain project or
package metadata. This command adds Nest CLI configuration, not an application,
TypeScript setup, dependencies, or a package-manager workspace link. Existing
conflicting configuration is not overwritten; edit it explicitly.

## Applications and native sub-apps

`application` creates an independent Nest package. `--directory` is the complete
workspace-relative destination; without it, the normalized application name is
the directory. Existing conflicting files or project names are rejected.

```sh
yarn nx g @anarchitects/nest:application api --directory=packages/api --type=esm
yarn nx g @anarchitects/nest:application legacy-api --directory=packages/legacy-api --type=cjs
```

| Option                       | Behavior                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `--type=esm` / `--type=cjs`  | ESM with Vitest is the default; CommonJS uses Jest. Both retain native Nest tooling and Oxlint. |
| `--directory`                | Exact destination for the independent package.                                                  |
| `--strict`                   | Strict TypeScript; enabled by default.                                                          |
| `--packageManager`           | Forwarded to Nest; the containing workspace determines actual installation.                     |
| `--spec`, `--specFileSuffix` | Native generated test options.                                                                  |
| `--observe`                  | Opt into native Nest observe instrumentation.                                                   |
| `--format`                   | Opt into native source formatting.                                                              |
| `--skipInstall`              | Write the package and workspace changes without installing.                                     |

Generation registers the package in the workspace and installs required
changes automatically after successful generation. `--dry-run` previews without
writing files or installing. After an intentional `--skipInstall`, run your normal
workspace install before executing tasks.

Use `sub-app` (alias **`app`**) to add an application inside an existing Nest owner:

```sh
yarn nx g @anarchitects/nest:sub-app worker --project=api
yarn nx show project api-worker
yarn nx run api-worker:compile
yarn nx run api-worker:serve
```

These commands assume the quick start's custom target names. Nest may convert the
original standalone application into a native monorepo; its application member
then becomes `api-api`. Members share the owner's package, Nest configuration,
and tooling. New member Nx names are `<owner>-<member>`; existing explicit names
are preserved. `app` is **not** an alias for independent `application` generation.

## Choose a library model

Supply **exactly one** of `--project` or `--directory` to `library`/`lib`.

|                        | Native Nest CLI library                       | Nx-native Nest library                                                                  |
| ---------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Command selector       | `--project=api`                               | `--directory=libs/users`                                                                |
| Ownership              | Member of the existing Nest owner             | Independent Nx project and package                                                      |
| Package manifest       | Shares the owner's manifest                   | Own manifest and framework dependencies                                                 |
| Workspace registration | No separate package-manager workspace         | Registered as a workspace package                                                       |
| Nest configuration     | Entry in the owner's `nest-cli.json`          | No `nest-cli.json` membership                                                           |
| Build/tooling          | Owner's native compiler and test/lint tools   | Source-only; consumer chooses compilation/test/lint tooling                             |
| Choose when            | Code belongs inside one native Nest workspace | Code needs an independent package identity and dependency edges across the Nx workspace |

### Native Nest CLI library

```sh
yarn nx g @anarchitects/nest:library internal --project=api
yarn nx g @anarchitects/nest:service cache --project=api-internal
yarn nx run api-internal:compile
```

Nest creates `packages/api/libs/internal` by default and registers the library in
`packages/api/nest-cli.json`. Use native `--rootDir`, `--path`, or `--prefix` to
customize its layout/import alias. Paths are relative to the owner. Extra directory
depth may require adjusting the member's relative TypeScript config inheritance.
Libraries have a build target and no start target. Test/lint tasks remain on the owner.

### Independent Nx-native Nest library

```sh
yarn nx g @anarchitects/nest:library users --directory=libs/users
yarn nx g @anarchitects/nest:service audit --project=users
yarn nx g @anarchitects/nest:resource users --project=users --type=rest --crud
```

This creates a private TypeScript package with `package.json`, `project.json`,
local TypeScript configuration, `src/index.ts`, and a Nest module. The package
and Nx project name are the same. Scoped identities also work:

```sh
yarn nx g @anarchitects/nest:lib @acme/support --directory=libs/support
yarn nx g @anarchitects/nest:service tickets --project=@acme/support
```

The package owns `@nestjs/common`, `reflect-metadata`, and `rxjs`. Additional
native resource dependencies belong to that package, not the workspace root.
Names and destinations must be available; repeating library creation does not
update an existing library. `--rootDir`, `--path`, and `--prefix` are native-library
options and cannot be combined with `--directory`.

The initial package is **ESM and source-only**, with exports pointing to
`src/index.ts`. It is not a precompiled Node package or a publishing setup, and
has no generated build, start, test, or lint target. Use TypeScript-aware consumer
tooling as shown below. Other installed Nx plugins may infer their own tasks.

A same-name resource can be generated into the initial module. When both native
classes are named `UsersModule`, the import is aliased to avoid a compilation
collision; their exported names remain unchanged. If registration is ambiguous,
use `--skipImport` and register the resource module yourself.

## Generator reference

Run `yarn nx g @anarchitects/nest:<generator> --help` for its complete option list.
All framework scaffolding follows stable NestJS 12 conventions.

| Generator       | Alias    | Purpose                                                     |
| --------------- | -------- | ----------------------------------------------------------- |
| `init`          | —        | Validate Nest versions and register inference.              |
| `application`   | —        | Independent Nest application/package.                       |
| `sub-app`       | `app`    | Application member of a native Nest owner.                  |
| `library`       | `lib`    | Native member or independent Nx-native library.             |
| `configuration` | `config` | Add native Nest CLI configuration to an existing project.   |
| `resource`      | `res`    | Transport-specific resource and optional CRUD entry points. |
| `class`         | `cl`     | Class.                                                      |
| `interface`     | `itf`    | TypeScript interface.                                       |
| `module`        | `mo`     | Nest module.                                                |
| `provider`      | `pr`     | Provider.                                                   |
| `service`       | `s`      | Injectable service.                                         |
| `controller`    | `co`     | Controller.                                                 |
| `decorator`     | `d`      | Reflector decorator.                                        |
| `filter`        | `f`      | Exception filter.                                           |
| `gateway`       | `ga`     | WebSocket gateway.                                          |
| `guard`         | `gu`     | Guard.                                                      |
| `interceptor`   | `itc`    | Interceptor.                                                |
| `middleware`    | `mi`     | Middleware.                                                 |
| `pipe`          | `pi`     | Pipe.                                                       |
| `resolver`      | `r`      | GraphQL resolver.                                           |

### Select the destination

For artifacts and resources, `--project` selects an **existing Nx project**:

```sh
yarn nx g @anarchitects/nest:controller health --project=api
yarn nx g @anarchitects/nest:service users --project=api-worker
yarn nx g @anarchitects/nest:service cache --project=api --nestProject=internal
yarn nx g @anarchitects/nest:guard access --project=users --spec=false
```

`--nestProject` selects a native member by its key in the chosen owner's
`nest-cli.json`. It is optional when selecting that member's Nx project directly;
it does not apply to independent Nx-native libraries. Without `--project`,
selection prefers the root Nest owner, then a single nested owner. Ambiguous
workspaces require an explicit project. Independent Nx-native libraries always
require their project name.

Artifact `--path` is relative to the selected source root. An explicit
`--sourceRoot` is package/owner-relative; for an Nx-native library it must stay
inside that library's configured source root. Native defaults for language,
layout, specs, and suffixes follow the selected project and its Nest configuration
where present. Use `--flat`, `--spec`, `--specFileSuffix`, `--skipImport`, and
`--format` only on generators that expose them. Guards, filters, interceptors,
middleware, and pipes are not automatically bound to routes or the application.

Application, sub-app, library, resource, and artifact generators support
`--skipInstall`. `init` and `configuration` do not install dependencies.
Nx's `--dry-run` is available for previewing generator changes. Framework/package
upgrades are separate maintenance work; there is no `upgrade`/`update` generator.

### Resources and transports

```sh
yarn nx g @anarchitects/nest:resource orders --project=api --type=rest --crud
yarn nx g @anarchitects/nest:res messages --project=users --type=microservice --crud=false
```

| `--type`               | Native resource style           |
| ---------------------- | ------------------------------- |
| `rest`                 | HTTP REST controllers; default. |
| `graphql-code-first`   | Decorator-based GraphQL schema. |
| `graphql-schema-first` | Schema-first GraphQL.           |
| `microservice`         | Message-pattern handlers.       |
| `ws`                   | WebSocket gateways.             |

`--crud=true` is the default; `--crud=false` generates the smaller resource shape.
`--spec=false` omits generated tests, `--flat` places files directly in the selected
location, and `--skipImport` leaves module registration to you. Resource dependency
changes, such as mapped types, are installed in the owning package. Transport
packages and runtime configuration remain your responsibility unless the native
schematic adds them. Generating GraphQL or WebSocket source alone does not configure
a working server for those transports.

## Workspace and TypeScript integration

Independent applications and libraries are registered only when an existing
workspace entry or glob does not already cover their directory:

| Workspace      | Registration                                                     |
| -------------- | ---------------------------------------------------------------- |
| npm, Yarn, Bun | Root `package.json` workspaces; Yarn's object form is preserved. |
| pnpm           | `pnpm-workspace.yaml` packages.                                  |

Explicit exclusions are respected and reported rather than silently removed.
Existing hoisting policies and unrelated settings are preserved. The containing
workspace's package-manager declaration and lockfile take precedence over a
new application's package-manager preference.

Nx-native libraries follow the active supported TypeScript model:

- **Project references:** an empty root solution with references (or an empty
  solution extending a composite/declaration-enabled `tsconfig.base.json`) gains
  a library reference. No path aliases are added. Existing Nx TypeScript sync
  tooling can maintain dependency references as imports are introduced.
- **Path aliases:** an existing `tsconfig.base.json` paths map gains the library's
  package-name entry. Existing mappings and compiler policy are preserved.
- **Neither model:** the library keeps local configuration; no root linking model
  is invented.

Nest-specific compiler options stay local to the library. Generating Nest code
does not rewrite unrelated Angular project/compiler configuration. For example,
`apps/web` and `libs/contracts` can coexist with `libs/users`, `packages/api`, and
`packages/api/libs/internal`. Keep browser-safe contracts in the shared package;
do not import server-side Nest modules into Angular.

Consumers must declare workspace dependencies explicitly. Generators do not infer
which applications should consume a new library:

```sh
yarn workspace api add users@workspace:*
```

Use your package manager's workspace dependency syntax. Nx derives graph edges
from ordinary package/import metadata. For project-reference workspaces with Nx's
TypeScript sync integration, run `yarn nx sync` after introducing imports.

## Consume an Nx-native library from an application

This ESM/Yarn example extends the quick start's `packages/api` application and
uses an independent library at `libs/users`. In a fresh workspace, generate it:

```sh
yarn nx g @anarchitects/nest:library users --directory=libs/users
yarn nx g @anarchitects/nest:resource users --project=users --type=rest --crud
yarn workspace api add users@workspace:*
```

If you already created `users`, reuse it. Import its entrypoint in
`packages/api/src/app.module.ts` and add it to the existing module imports:

```ts
import { UsersModule } from 'users';

// In the existing @Module metadata:
// imports: [UsersModule],
```

Do not register this library in the application's `nest-cli.json`. Its TypeScript
and decorators must be compiled by the consumer. Plain Node execution and leaving
this source package external in the application bundle are not supported.

### Bundle the library with Nest's Rspack builder

```sh
yarn workspace api add -D @rspack/core@2.1.10 webpack-node-externals@3.0.0 tsconfig-paths-webpack-plugin@4.2.0
```

Merge this into `packages/api/nest-cli.json`'s `compilerOptions`:

```json
{
  "builder": {
    "type": "rspack",
    "options": { "configPath": "rspack.config.cjs" }
  }
}
```

Create `packages/api/rspack.config.cjs`, or merge equivalent behavior into an
existing custom configuration:

```js
const { builtinModules } = require('node:module');
const { resolve } = require('node:path');
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      modulesDir: resolve(__dirname, 'node_modules'),
      additionalModuleDirs: [resolve(__dirname, '../../node_modules')],
      allowlist: ['users'],
      importType: 'module',
    }),
    ({ request }, callback) => {
      const bare = request?.replace(/^node:/, '');
      return bare && builtinModules.includes(bare)
        ? callback(null, 'module ' + request)
        : callback();
    },
  ],
});
```

This replaces the default externalizer so the source package is bundled while
installed framework packages remain external. Add every source-only dependency,
including transitive shared packages, to the allowlist. Adjust module directories
for other layouts. Nest's ESM Rspack configuration supplies TypeScript compilation,
decorator metadata, and resolution of relative `.js` imports to TypeScript source.
A separate library build is not required for this consumption model.

### Test imported Nest modules

Vitest must retain Nest decorator metadata when compiling application and library
source. Install the transform in the application:

```sh
yarn workspace api add -D @swc/core@1.16.13 unplugin-swc@2.0.0
```

For a standalone application, use this `packages/api/vitest.config.ts`, preserving
any additional plugins or settings you already use:

```ts
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      tsconfigFile: false,
      swcrc: false,
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: { globals: true, environment: 'node', include: ['src/**/*.spec.ts'] },
});
```

Apply the same transform to a separate Vitest HTTP-test config if it imports
these modules. Library-owned tests likewise need their own test tooling and
Nest testing dependencies; the library generator does not install a test runner.

```sh
yarn nx run api:test
yarn nx run api:compile
yarn nx run api:serve
```

`GET /users` now executes the library's resource. `yarn nx graph` shows
`api → users`; library source changes invalidate the inferred application build.
For a scoped library, use its full package name consistently in dependencies,
imports, and the Rspack allowlist. This recipe covers source consumption, not
precompiled publication or default CJS/Jest consumption of source-only packages.

## Testing, linting, and build tools

Build/start delegate to the Nest CLI and its configured builder. Test/lint tasks
come from package scripts or the appropriate Nx integrations (`@nx/jest`,
`@nx/vitest`, `@nx/eslint`, or your chosen tools), not Nest build/start inference.
Continue to orchestrate them with Nx:

```sh
yarn nx run-many -p api -t compile,test,lint
```

Generated ESM applications retain Nest's Vitest conventions; CJS uses Jest.
When generating native members, the plugin completes the native Rspack setup
for hoisted dependencies, configures Nest-compatible Vitest/SWC integration for
ESM owners, and expands the unchanged default Oxlint scope to include members.
Custom configurations remain yours to maintain. Tests/lint normally run on the
owner (`api:test`, `api:lint`), while member builds/servers use member Nx names.

## Troubleshooting

| Symptom                                                 | What to check                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project is missing from Nx                              | Register the plugin with `init`; ensure `nest-cli.json` has sibling project/package metadata and is not excluded. Inspect `yarn nx show projects`. A standalone Nx-native library intentionally has no Nest build/start inference. |
| Ambiguous generator selection                           | Pass the Nx project name with `--project`. Use `--nestProject` only to select a native member within an owner.                                                                                                                     |
| Library selector error                                  | Use exactly one of `--project=<owner>` for a native member or `--directory=<destination>` for a new independent package. Neither selector is implicit for library creation.                                                        |
| Package is not linked                                   | Check workspace entries/exclusions and the dependency in the consuming manifest. Existing globs are sufficient; explicit exclusions must be changed by you. Adopted packages need explicit workspace registration.                 |
| Dependencies are missing after generation               | If you used `--skipInstall`, run the containing workspace's install command. Otherwise resolve the reported install error; generated files may already have been written.                                                          |
| Build never restores from cache                         | A same-named package script or explicit target may override inference. Use distinct `compile`/`serve` names and inspect `yarn nx show project api`.                                                                                |
| Node cannot load a library's TypeScript/decorators      | Bundle the source-only workspace package with a TypeScript-aware compiler; see the consumption recipe.                                                                                                                             |
| A gateway/resolver cannot resolve its framework package | Install and configure the chosen transport in the owning package; scaffolding does not imply transport setup.                                                                                                                      |
| Native member is addressed incorrectly                  | `api-internal` is an Nx name; `internal` is a Nest member key used with `--project=api --nestProject=internal`. Independent `users` needs only `--project=users`.                                                                  |

### CommonJS Jest with Yarn hoisting

Native CJS scripts refer to local `node_modules/jest/bin/jest.js`. With default
Yarn hoisting, Jest may live at the workspace root instead. Keep hoisting and use
Yarn's binary resolution from the project directory through Nx (POSIX shells):

```sh
NODE_OPTIONS=--experimental-vm-modules yarn nx exec --projects=legacy-api -- yarn jest --runInBand
NODE_OPTIONS=--experimental-vm-modules yarn nx exec --projects=legacy-api -- yarn jest --config ./test/jest-e2e.json --runInBand
```

Alternatively merge `"installConfig": { "hoistingLimits": "workspaces" }` into
that application's `package.json` and run `yarn install`. Native scripts then
resolve their local Jest installation. Neither policy is imposed on other packages.

For a generated CJS sub-app, Oxlint may report the native `bootstrap();` call as
an unhandled promise. Use `void bootstrap();` or attach your startup error handler.
For a custom Vitest config that cannot be updated automatically, configure SWC
and include the native members in your test scope explicitly.

## Documentation and contribution

- [Nest documentation](https://docs.nestjs.com/)
- [Nx documentation](https://nx.dev/docs)
- [Source and contributions](https://github.com/anarchitects/anarchitecture-plugins)

The package is MIT-licensed. Its integration keeps framework behavior with Nest
and workspace orchestration with Nx.
