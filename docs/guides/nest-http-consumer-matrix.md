# Packed HTTP adapter consumer matrix

[#611](https://github.com/anarchitects/anarchitecture-plugins/issues/611) verifies
the development plugin as an npm tarball installed into independent workspaces.
The shared scenario is `packages/nest-e2e/src/http-consumer-matrix.ts`; its four
small spec files use the existing packed-plugin and installed-consumer harnesses.
This complements the [adapter API audit](nest-three-adapter-generation-contract.md)
and retains the [published-library gates](nest-published-library-compatibility.md).

## Version and selection boundaries

Fresh explicit applications use a coherent **12.5.0** set of common, core,
testing, the selected adapter and retained platform-express. Existing coherent
**12.3.0** owners remain admitted: members add a missing adapter at the owner's
version and preserve existing declarations. Mixed sets and unverified releases
fail before mutation. No owner is automatically upgraded. Omission still delegates
to native Nest and does not select a plugin default.

The plugin pins schematics **12.0.13** and Angular Devkit **22.2.6**. Native
12.0.13 supplies Vite 8 path resolution, the CommonJS `void bootstrap()` fix and
Rspack dependencies. The integration preserves those changes while adding its
bounded SWC configuration and member-aware lint scope. It supplies the native
loader/checker's missing Webpack peer for strict Yarn installs, preserving any existing
version, and recognizes the known lint defaults after native custom-root rewrites. Native `minimal` is
forwarded without a platform; explicit platforms require the full TypeScript
application template. Libraries, public exports and Nest 11/12 library peers
retain their separate contracts.

| Lane   | Node    | Nx / @nx/devkit | Package manager           | Observe |
| ------ | ------- | --------------- | ------------------------- | ------- |
| node22 | 22.22.3 | 23.2.0          | Yarn 4.17.0, node-modules | off     |
| node24 | 24.21.0 | 24.0.1          | Yarn 4.17.0, node-modules | on      |
| node26 | 26.0.0  | 24.0.1          | Yarn 4.17.0, node-modules | off     |
| npm    | 24.21.0 | 24.0.1          | npm 11.19.1               | on      |

Every lane exercises Node, Express and Fastify applications in ESM and CommonJS:
24 scenarios, using TypeScript 6.0.3 and CLI 12.0.13. Observe-on cases assert
0.3.26. The Yarn lanes rotate the new member's selection by zero, one and two
positions, covering all nine owner/member pairs in both module formats. npm
repeats the Node 24 pair selection. The Node 24 Fastify ESM cases move the native
application into the workspace root before member generation; other cases use a
nested owner. This samples supported versions and layouts, not every possible
combination of the public semver ranges or operating systems.

## Assertions and isolation

Each scenario checks the selected binary and locally resolved package versions,
independent generation, repeat generation, dry-run preservation, build, unit and
HTTP tests, lint, real loopback HTTP and resource registration. Member conversion
preserves the original bootstrap and test bytes and retains dependencies. HTTP
tests assert actual adapter identity; Fastify tests retain explicit readiness.
Built bootstrap fixtures also assert the actual adapter before listening.
Shutdown checks that the listening port can be rebound.

**Node 22 CommonJS Jest is excluded:** its unit and HTTP tests fail to load
`@nestjs/testing` as ESM. Jest documents [Node 24.9+ for this require(esm) path](https://jestjs.io/docs/ecmascript-modules#require-of-esm).
The three Node 22 CJS scenarios assert that specific upstream failure both before
and after conversion, then continue real builds, HTTP/resource startup and lint.
They do not claim generated Jest support. Node 24/26 CJS tests and all ESM tests
execute normally; the evidence record distinguishes these outcomes.

CLI calls exercise workspace defaults, invocation-project defaults, explicit
options, and the canonical `sub-app` default through the `app` alias. Invocation
from a different project with `--project=api` proves that owner selection does not
retarget Nx's default-project lookup. A later call from the workspace root with
no effective platform produces a native implicit sibling. Duplicate members and
an incompatible owner declaration reject without changing the checked files.

The Node binary and npm CLI are installed by exact version; Corepack selects the pinned Yarn release. Inner processes remove outer
Nx, debugger, `NODE_OPTIONS` and `NODE_PATH` state and own their caches. Dependencies
are installed normally with scripts disabled; no framework links, forced peer
installs, metadata edits or resolution overrides supply successful evidence.
CommonJS uses Nx exec with the package manager's Jest binary resolution and
`--experimental-vm-modules`, preserving native scripts and default hoisting.
Observe startup is covered; exporter delivery is not.

## Dependency fixtures and task inputs

`src/consumer-locks/http-yarn.lock` contains the Yarn registry-resolution union.
The npm fixtures retain the dependency tree for each adapter/module scenario.
Installs seed those fixtures, reconcile only the current manifests/local packed
artifact, compare every resulting registry record, and then require Yarn's
immutable install or npm ci. Registry identity, integrity and dependency/peer
metadata cannot silently drift. Run-specific tarball paths and workspace records
are local; optional platform checksums may be added by Yarn on another OS.

Fixture refreshes require explicit dependency review and a complete matrix rerun.
Do not bypass conflicts or bless a newly resolved package merely to make a test
pass. The older library fixture was extended for the new schematic dependencies;
its Nest 12.1.2 / CLI 12.0.0 compatibility controls remain intact.

Project inputs already include each fixture/spec/helper, plugin dependencies,
repository lockfile, package-manager selection, `.nvmrc`, and outer Node, OS,
architecture and npm version. Nx infers a task for each spec; the existing
`e2e-ci` wildcard includes all four lanes. Each spec owns its temporary workspaces
and archive, bounds subprocesses and cleans up. Registry access, Corepack and npm
are required. No CI run or multi-OS result is implied by local validation.

```sh
corepack yarn nx run nx-nest:test --runInBand
corepack yarn nx run-many -t build,lint,typecheck -p nx-nest,nx-nest-e2e
corepack yarn nx run nx-nest-e2e:e2e --runTestsByPath src/nest-scenarios/http-node22.spec.ts src/nest-scenarios/http-node24.spec.ts src/nest-scenarios/http-node26.spec.ts src/nest-scenarios/http-npm.spec.ts
```

Optional Fastify integrations remain #508. Broader HTTP/security and schema
conformance remain #612; default activation and releases retain their own gates.

## Recorded validation

Local validation on 2026-11-15 passed **675 unit tests in 35 suites** and
**96 E2E tests in 36 suites**: 24 frozen HTTP matrix scenarios, 66 remaining
native/regression checks and six clean published-library checks. The four HTTP
lanes ran through their inferred CI tasks with no cache hits. The three Node 22
CommonJS combinations include the explicit Jest exclusion above; their real HTTP,
resource and lint checks pass. Plugin/e2e typecheck and lint pass, with 16 existing
plugin warnings and no lint errors.

The [versioned evidence record](../audits/nest-http-consumers-2026-11-15.json)
contains exact commands, locally resolved versions, fixture hashes, architecture
inventory and exclusions. The host was macOS arm64 / Node 24.22.3. Cache probes
on a small inferred task sharing the same input definition observed a repeat
hit, a miss after changing the HTTP lock, and a hit after restoring it. Remote
CI and other operating systems are not represented by these local results.
