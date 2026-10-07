# Nest v12 E2E fixtures

This private, MIT-licensed package tests the packed `@anarchitects/nest` plugin
against real Nest applications. Run it after the workspace's immutable Yarn
install:

```sh
yarn nx e2e nx-nest-e2e
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
never changed. Generation and dry-run leave the dependency lockfile unchanged;
only explicit consumer installs update it.

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

## CI

The existing Main CI workflow runs `nx affected -t ... e2e-ci` with Nx Cloud. This
project is included in the Jest E2E inference plugin and depends on `nx-nest`, so
plugin changes affect the suite. Its `e2e-ci` dependency explicitly points to the
inferred test-file task because workspace `targetDefaults.e2e-ci.dependsOn`
overrides the inferred aggregate dependencies. That test-file task depends on
the plugin build before packing it.

Use `e2e` locally: the atomized `e2e-ci` target requires Nx Cloud. The fixture suite
and assertions are identical in both paths.
