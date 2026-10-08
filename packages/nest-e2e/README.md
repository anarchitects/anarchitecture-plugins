# Nest v12 E2E fixtures

This private, MIT-licensed package tests the packed `@anarchitects/nest` plugin
against real Nest applications. Run it after the workspace's immutable Yarn
install:

```sh
yarn nx e2e nx-nest-e2e
# Force the outer suite to rerun while preserving nested cache assertions:
NX_DAEMON=false NX_NO_CLOUD=true yarn nx run nx-nest-e2e:e2e --skipNxCache --output-style=static
yarn nx run-many -t lint typecheck -p nx-nest-e2e
```

The E2E target builds `nx-nest` first. It packs that package into a temporary
directory, extracts it into each consumer workspace, and links the exact
dependencies from the repository's locked install. Each consumer receives the
same Yarn lockfile so Nx can hash external dependencies. No registry server,
runtime dependency download or source export condition is needed for those
linked fixtures. The lockfile
is an explicit input to the E2E project.

The baseline is Nest CLI **12.0.0**, Nest common/core/platform-express **12.1.2**,
Rspack **2.1.10**, TypeScript **6.0.3**, and Nx **23.2.0**. The suite checks the
installed Nest versions against the exact manifest pins and rejects prereleases.
Standard Schema runtime fixtures additionally pin Swagger 12.0.2, microservices
12.1.2, mapped-types 12.0.0, and interface types from `@standard-schema/spec`
1.1.0; no schema implementation is installed for the generator core.

| Fixture                              | Coverage                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standalone-esm`                     | Root application, ESM/NodeNext, `tsconfig.build.json` fallback                                                                                                                   |
| `standalone-commonjs-builder-config` | CommonJS, tsc builder `configPath` taking precedence over a decoy build config                                                                                                   |
| `nested-solution-custom-output`      | Nested project, solution references, explicit `tsConfigPath` taking precedence over builder options, shared inherited output outside the project, custom `compile`/`serve` names |
| `monorepo-tsc`                       | Nest application and shared library compiled with tsc; one Nx project per CLI config                                                                                             |
| `monorepo-rspack`                    | ESM Nest monorepo and shared library bundled with Rspack; explicit Rspack config file                                                                                            |
| `generated-esm` / `generated-cjs`    | Native application, sub-app conversion, and library generated through the packed Nx plugin; separate member discovery and real default Rspack builds                             |

Additional generation and compatibility cases cover:

| Fixture                                           | Coverage                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configuration-module` / `configuration-commonjs` | Native `config` output, inference, real build and HTTP startup for an existing application.                                                                                                                        |
| `standard-schema-esm` / `standard-schema-cjs`     | Generated REST/microservice resources, strict compilation, live HTTP/TCP validation and serialization, and Standard Schema-aware OpenAPI.                                                                          |
| `multi-owner-esm` / `multi-owner-cjs`             | Two independent nested Nest owners with opposite module systems and same-named native members; application/sub-app/library/resource/configuration plus all fourteen artifacts through canonical names and aliases. |

The multi-owner workflow asserts that generation changes only the selected
owner/member, checks explicit `nestProject` selection and ambiguous-selection
failure, previews resources with Nx dry-run, and builds the selected native
sub-app through inference. Gateway/resolver generation uses `skipImport` because
transport setup is consumer-owned; their runtime startup is not claimed here.
The other owner's files are compared byte-for-byte before and after the workflow.

The five pre-existing application fixtures run the packed `init` generator twice through Nx, checks repeat
safety and unchanged package/Nest configs, then checks discovery, build/start command and metadata, cache and
continuous settings, and absence of inferred test/lint targets even when those
tools' config files exist. It runs the inferred build through Nx, checks actual
emission, deletes the output, and verifies cache restoration. It then runs the
inferred start target and checks a real HTTP response on an ephemeral loopback
port. Child process groups and temporary files are cleaned up, with bounded
startup and shutdown timeouts. Local execution is validated on macOS; CI runs on
Linux.

A negative adoption case rejects an incompatible framework declaration without
partially registering the plugin.

Generated-member cases preserve native source/config output and link dependencies
at the selected Nest package root for default Rspack externals discovery. Both
the sub-app and library receive native REST resources with CRUD disabled and
all six structural and six cross-cutting artifacts, then build through their inferred named targets
and restore cached output. Generation
runtime dependencies are resolved from the plugin package's stable install.
The plugin unit suite separately checks all resource transports, CRUD on/off,
artifact defaults/options, and ESM/CJS imports against native generated bytes.
It also checks the entire registered native catalog and aliases against the
official collection and the published README. `upgrade` / `update` are excluded
as migration operations. Native ownership and the separate optional
[Fastify epic #508](https://github.com/anarchitects/anarchitecture-plugins/issues/508)
are documented in the [plugin README](../nest/README.md).

The Rspack fixture explicitly sets the bundle filename to `main.js` while retaining
the default `dist` directory. It does not claim automatic inference of arbitrary
bundler output overrides; those remain an explicit Nx configuration concern.

## Real-install CJS consumer

The `cjs-yarn-consumer` regression packs the same plugin but installs it and the
generated application's dependencies using real Yarn installs in an isolated
temporary workspace. It uses the repository's Yarn version, the node-modules
linker, default hoisting, and disabled install scripts, matching the relevant
empty Nx workspace settings. This case requires registry access (or a populated
Yarn cache); unlike the linked fixtures it resolves the native application's
dependency ranges on each uncached run and does not use an immutable fixture
lockfile. It has a six-minute test timeout and bounded child-command timeouts.

The test reproduces the pinned native CJS Jest scripts' local-path failure, then
runs unit, HTTP integration, and coverage suites through `nx exec` with Yarn's
binary resolution and VM modules enabled. It also verifies the optional
application-scoped `installConfig.hoistingLimits` setting, executing the original
`test`, `test:e2e`, and `test:cov` targets through Nx. Native scripts and selected
source/test/configuration files remain unchanged. The root hoisting policy is
never changed. Dry-run leaves the dependency lockfile unchanged; application generation
installs its declared dependencies through the Nx callback. Explicit consumer
installs are needed only after changing the optional hoisting configuration.

This catches the dependency-layout failure tracked by
[#533](https://github.com/anarchitects/anarchitecture-plugins/issues/533), which
linked dependencies and template parity alone cannot detect. It does not test
interactive watch/debug sessions, converted-monorepo Vitest, or Oxlint.

## Real-install Rspack consumers

The `rspack-yarn-esm` and `rspack-yarn-cjs` cases use the same isolated real-install
helper as the CJS Jest regression. They generate an application, REST resource,
sub-app, and library, checking that dry runs leave lockfiles unchanged and that
member generation automatically installs the missing compiler dependencies.
No dependencies are hand-linked and default workspace hoisting stays enabled.
The generated Rspack configuration must handle the hoisted Nest framework
without installing unused transport packages or changing hoisting policy.

The three inferred native member builds must emit their expected files. Both
applications then start through their inferred Nx targets and serve HTTP requests
on temporary local ports; process groups are stopped in cleanup. Generated files
remain unchanged during build/start, and native scripts and root Yarn
configuration remain unchanged. These cases validate the default automatic
setup for [#534](https://github.com/anarchitects/anarchitecture-plugins/issues/534),
not arbitrary externalization overrides or other package managers. Each has a
six-minute test timeout; installs require registry/cache access as described above.

## Real-install Vitest consumer

The `vitest-yarn-consumer` case installs the packed plugin in an empty Yarn
workspace with default hoisting. It first runs the standalone application's unit
and HTTP integration tests, then generates a REST resource, sub-app, and library.
It verifies that native conversion removes old source/test directories while
preserving the relocated source bytes.

Both native test targets must pass after conversion. JSON reports assert the
exact file set and test counts so missing or duplicate discovery cannot produce
a false pass. A library test checks constructor injection through the generated
path alias, exercising decorator metadata. The `@nx/vitest` inferred target must
run the same unit suites; changing a library spec must invalidate the owner's
cached result. This covers #535 without hand-linked dependencies or source-template
replacements. The existing CJS and build/start regressions remain in the suite.

## Application workspace registration

The `application-workspace` scenario begins with no root workspace declarations.
It generates the default ESM application through the packed plugin, checks that
dry-run and `--skipInstall` generation leave the lockfile untouched, and verifies
repeat safety.
After a normal Yarn install, Nx must report
`metadata.js.isInPackageManagerWorkspaces: true`; the unchanged native `build`,
`test`, `test:e2e`, and `lint` scripts must all pass. The root Yarn hoisting
configuration and generated application manifest stay unchanged. Existing
consumer scenarios keep their `packages/*` glob to cover the already-included
case. npm/Bun manifest forms and pnpm YAML registration are also tested through
the plugin's Tree-based unit suite; this real-install scenario specifically
validates Yarn with the node-modules linker.

## Automatic dependency installation

The `dependency-installs` scenario starts with an empty Yarn workspace and runs
application and REST resource generation followed immediately by native build,
unit tests, HTTP tests, and lint. There is no manual install between generation
and use. It counts Yarn install invocations: one for new application dependencies,
one for a new mapped-types dependency, one combined Rspack/Vitest/SWC install,
and none for existing dependencies or plain service generation. A second owner
exercises `--skipInstall` for application and resource generation. Both skip and
dry-run preserve the lockfile and Yarn's node_modules install-state file; root
hoisting settings remain unchanged. Linked fixtures explicitly skip installation.

## CI

The existing Main CI workflow runs `nx affected -t ... e2e-ci` with Nx Cloud.
The Jest plugin atomizes the spec files in `src/nest-scenarios/` into separate
cacheable tasks for Nx distributed execution. The original consumer scenarios
remain covered, alongside child-environment and fresh workspace-registration
regressions. Real-install Rspack,
lint, member-generation, and multi-owner scenarios split ESM and CJS into separate
files; shorter discovery/configuration/Standard Schema cases remain grouped.

Each file packs its own tarball and creates a unique temporary workspace, so
agents share no fixture state. Local `e2e` runs use two Jest workers to bound
concurrent installs; CI schedules the inferred file tasks independently.

The project depends on `nx-nest`, so plugin changes affect every scenario.
The aggregate `e2e-ci` target depends on `e2e-ci--src/nest-scenarios/*.spec.ts`:
this overrides the workspace's aggregate build-only default while automatically
including new files. A scoped wildcard in `nx.json` gives each inferred file task
`dependsOn: ["^build"]`, so the plugin is built before that agent packs it.

Inspect the distribution without running Nx Cloud tasks:

```sh
yarn nx show project nx-nest-e2e --json
yarn nx run nx-nest-e2e:e2e-ci --graph=/tmp/nest-e2e-task-graph.json
```

Use `e2e` locally: the atomized `e2e-ci` target requires Nx Cloud. Both paths run
the same specs. Consumer subprocesses get their own Nx environment: outer
`NX_*` settings (including `NX_SKIP_NX_CACHE` and task identity), debugger
`NODE_OPTIONS`/`VSCODE_INSPECTOR_OPTIONS`, and Jest/ts-node overrides are removed.
This lets an uncached outer run still verify inner cache restoration, and avoids
editor auto-attach keeping consumer commands alive. Explicit consumer runtime
options, such as CJS Jest's VM-modules flag, are applied after isolation.

Real-install consumer commands emit start/end timestamps, elapsed milliseconds,
exit status, termination signal, and spawn error code in CI. Enable the same
diagnostics locally with `NEST_E2E_TRACE=true`. Environment values are not logged.
Command failures still throw, including timeouts; expected generator failures
remain checked by the scenario assertions.

Main CI bounds distributed task execution to 15 minutes and the complete job to
20 minutes, leaving time for failure diagnostics. These coordinator deadlines
also cover stalls outside a test process. The existing 120-second command and
per-test Jest timeouts remain unchanged: synchronous child processes block Jest
timers, and a child that ignores SIGTERM can outlive `spawnSync`'s timeout.
The deadlines are safeguards, not evidence of a subprocess defect; see the
[PR #570 investigation](../../docs/ci/pr-570-stall.md).

## Nx-native library container

`nx-library.spec.ts` installs the packed plugin into a fresh Yarn workspace and
generates `library users --directory=libs/users` without a Nest owner. It checks
native module output, Nx project discovery, package identity and membership,
automatic installation, a consumer-owned TypeScript check run through Nx,
collision errors, the `lib` alias, and `--skipInstall`. Dry runs preserve the
manifest, lockfile, install state, and generated directory. Root compiler
compiler options and hoisting policy remain unchanged; the existing legacy
alias map gains only the generated package entry.

`nx-library-linking.spec.ts` covers modern reference and legacy alias layouts in
fresh installed consumers. A shared contract is imported by the generated Nest
library and another ESM package imports both. Yarn workspace commands establish
real package dependencies. In the modern layout, the existing `@nx/js/typescript`
plugin and `nx sync` maintain dependency references and the inferred typecheck
compiles the consumer. The legacy layout checks both the consumer and generated
library through Nx-owned TypeScript check targets. Root Angular compiler options,
module policy, existing aliases/references, dry-run behavior, and collision
idempotence are asserted. Angular and Nest application consumption remain scoped
to the later epic scenarios.

`nx-library-artifacts.spec.ts` exercises all 14 non-resource artifact generators
through the packed plugin in a real installed Yarn consumer. It verifies scoped
placement, ESM imports, nearest-module registration, custom spec suffixes,
`skipImport`, dry-run preservation, conflict rollback, and path rejection. The
library manifest, lockfile, and install state remain unchanged by these native
artifact schematics. The unit matrix additionally compares native output in ESM,
CJS, and explicit JavaScript modes.
