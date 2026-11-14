# Published Nest library compatibility preflight

Status: implementation and validation contract for [#594](https://github.com/anarchitects/anarchitecture-plugins/issues/594)
build-ownership evidence for [#595](https://github.com/anarchitects/anarchitecture-plugins/issues/595),
and clean-consumer evidence for [#596](https://github.com/anarchitects/anarchitecture-plugins/issues/596),
building on the reproduction in [#593](https://github.com/anarchitects/anarchitecture-plugins/issues/593)
under [#585](https://github.com/anarchitects/anarchitecture-plugins/issues/585).
This describes the current development branch; it does not retroactively change
published versions or amend an ADR.

## Reproduction and ownership

`packages/nest-e2e/src/nest-scenarios/published-library-peers.spec.ts` creates a
generic publishable CommonJS library with public JavaScript/declaration exports
and Nest common/core peers. It builds through an existing custom Nx target,
packs with npm, extracts the archive into a Nest 12 consumer, and resolves the
library through its public package entry point. A real Nest application context
resolves the library's injectable service before the packed plugin runs `init`.

The host uses the E2E package's locked dependencies: Nest CLI 12.0.0 and
common/core 12.1.2. Assertions read the resolved versions in the consumer process.
Both `^11 || ^12` and `^11.0.0 || ^12.0.0`, plus the equivalent `>=11 <13`,
initialize twice successfully. A separate `^12.0.0` control also passes. The
control is a distinct fixture, not a workaround that narrows a real library's
published compatibility range.

Successful dry runs and negative preflights preserve `nx.json`; all cases preserve library
source, build configuration, compiled output, exported declarations, installed
artifact bytes, host source/configuration, package manifests and the lockfile.
The original rejection characterization has become an acceptance regression.
Negative packed-plugin cases cover nested Nest 10/11/13 and prerelease metadata,
incompatible peers, missing installs and conflicting declarations. These negative
metadata fixtures prove preflight behavior; they do not run unsupported frameworks.

This uses the existing linked-dependency E2E harness: the plugin and library are
real tarballs, while framework/tool dependencies are linked from the immutable
repository install. It proves loading and dependency injection on one Nest 12
baseline. It does not prove a fresh package-manager install, Nest 11 runtime
compatibility, full ESM/CJS interoperability, secondary exports, or an entire
Node/Nx/TypeScript support range. The separate build-ownership scenarios below
cover module formats and secondary exports on this baseline. No registry publication
occurs, and no claim is made that this fixture is a released third-party package.

## Publishable build ownership

The `published-tsc-build` and `published-custom-build` packed E2E scenarios
exercise an existing publishable library alongside a native Nest owner, an
application member and a native library member. They use original application
fixtures rather than copies of Nest schematic templates. No production inference
or generator change is needed for these layouts.

- The `@nx/js:tsc` package owns its CommonJS/declaration output in `dist`. Its
  authored exports remain authoritative (`generatePackageJson: false`).
- The custom build uses TypeScript to produce ESM and CommonJS JavaScript and
  declarations in separate `output` directories, with conditional exports and
  explicit module types. It is not a Vite fixture.
- Both expose a root Nest module/service and a secondary public entry point.
  The tests pack them before adoption and after a forced rebuild, comparing all
  extracted file bytes. A separate consumer executes import and require,
  resolves Nest providers, checks `.mts`/`.cts` declarations (including rejection
  of an incorrect return type), and confirms Nx is not resolvable there.
- Dry-run and repeated initialization preserve owner and library source,
  manifests, TypeScript configuration, package exports, build/release targets,
  compiled output and the dependency lockfile. Resolved library targets remain
  equal before/after inference. No release target is executed.
- Package/import metadata supplies static project edges; there are no explicit
  implicit-dependency edges or source path-alias workarounds. The task graph
  requires the library build before the native application build. Deleting
  library and app outputs exercises local cache restoration; library source and
  TypeScript configuration changes must invalidate the consuming app build.
- Default `build` depends on `^build`. When Nest targets are renamed to
  `compile`, consumers of existing `build` targets explicitly add `^build` to
  their own prerequisites. The fixture proves this configuration without
  converting or renaming the library build.

The framework/tool install and workspace links are controlled fixtures based on
the repository lockfile. The isolated consumer uses the extracted tarball and
linked framework dependencies. This does not certify a fresh install, arbitrary
custom builders, every supported platform/version, remote cache reuse, or Nest
11 runtime support. The separate clean-install matrix is described below. Existing
source-only generator contracts remain covered by their separate regression
tests; this adoption evidence does not change those defaults.

## Clean packed consumers and sampled versions

The three `packed-library-node*.spec.ts` scenarios install the actual plugin
tarball, build and pack an original publishable library, and install that library
through Yarn into independent consumers. Framework/tool dependencies are fetched
by the consumer's package manager, with no links to the repository installation.
The shared library fixture also remains covered by the build-ownership scenarios
above; the clean-install lanes use its `@nx/js:tsc` CommonJS output.

| Lane     | Exact Node runtime | Exact Nx / `@nx/devkit` / `@nx/js` | TypeScript |
| -------- | ------------------ | ---------------------------------- | ---------- |
| `node22` | 22.22.3            | 23.2.0                             | 6.0.3      |
| `node24` | 24.21.0            | 24.0.1                             | 6.0.3      |
| `node26` | 26.0.0             | 24.0.1                             | 6.0.3      |

All lanes select Nest CLI 12.0.0, common/core/platform-express 12.1.2,
reflect-metadata 0.2.2 and RxJS 7.8.2, using the repository's pinned Yarn
package manager (4.17.0 at implementation). The npm `node` package installs an
exact platform-specific runtime separately from the consumer dependency graph.
Each lane verifies that binary's version, uses it for every consumer Nx/Nest/TS
process, and asserts installed framework/tool versions and local resolution.
These are samples of the declared ranges, not a full Cartesian matrix or evidence
for every patch, TypeScript 6 minor, Node 24 lower bound, operating system, or
future Node major. Nest 11 runtime compatibility remains outside this plugin.

Each lane proves:

- An existing standalone publishable root keeps its dual-major peers, exports,
  source, declarations, build targets and lockfile through dry-run, first and
  repeated initialization, and a forced library rebuild.
- A clean runtime consumer installs the library tarball, runs both `import` and
  `require` through the root and secondary exports, and resolves its provider in
  a real Nest application context. `.mts` and `.cts` consumers check the public
  declarations, including rejection of an incorrect return type. Nx is absent
  from this runtime installation. Adding the packed plugin as development tooling
  afterward preserves the artifact and existing declaration-check target.
- A separate mixed monorepo installs both tarballs. An existing publishable
  library keeps its resolved build targets while native Nest owner, application
  member and library member builds run. The application resolves the installed
  tarball, not workspace source, and owner/member native start tasks resolve the
  packed provider. Their one-shot application contexts close cleanly; these
  scenarios need no fixed ports or background servers. HTTP startup remains
  covered by the build-ownership scenarios.
- The Node 24 lane rejects unsupported/excluding peers, missing installs,
  malformed nearer evidence, and actual installed Nest 11 metadata at nested and
  root locations. The older package is installed normally in a separate fixture
  and moved intact to model a stale/conflicting install; no successful lane
  narrows peers or changes installed version metadata. Normal and dry-run
  rejection preserve authored files, compiled output, manifests, lockfile,
  installed library bytes and package-manager installation state.

First installs start from the checked-in `src/consumer-locks/yarn.lock` registry
fixture. Yarn creates only the run-specific workspace/local-tarball records and
prunes unused entries. The harness checks every resulting registry resolution
and its dependency metadata against that fixture, then requires an immutable
install. Unexpected transitive resolution fails the test. Optional platform
package checksums may be added when fetched on another OS; existing checksums
remain Yarn-validated. All installs reject missing/incompatible peer warnings.
There are no force installs, resolutions overrides or peer-range rewrites.
As with the existing installed-consumer harness, lifecycle scripts are disabled
in framework/tool consumers; actual native binaries, compilation and execution
are still exercised. This does not certify lifecycle-script side effects or
non-Yarn/PnP installation layouts.

The fixed fixtures keep the inferred per-spec tasks cacheable and eligible for
Nx Agents. Inputs include the registry fixture, lane definitions, plugin source,
repository lockfile/package-manager selection, `.nvmrc`, outer Node version,
OS/architecture and npm version. The existing `e2e-ci` wildcard and main CI
affected-task run discover the new files without new CI partitions; the normal
plugin build prerequisite remains in place. Each spec owns its
temporary workspaces and tarball, isolates inner Nx state, bounds subprocesses,
and removes the fixtures afterward. Registry access and Corepack/npm are required.

Release readiness still requires green CI on the release candidate and owner
approval under #597. Failed sampled lanes, install/peer conflicts, or missing
runtime/declaration evidence block that claim; successful local samples neither
authorize publication nor certify the entire advertised support range. This is
reproducible installed-artifact compatibility evidence, not a live check of
whatever transitive versions are newest in the registry.

## Host selection and library compatibility

The plugin runtime remains stable Nest 12 only. A library peer declaration
describes the consumers that its published artifact supports; it does not select
the framework used to run this workspace. A verified dual-major library must not
lose its Nest 11 compatibility declaration merely to initialize Nest 12 tooling.

Validation distinguishes:

- **Host/tool declarations:** dependencies, devDependencies and
  optionalDependencies selecting Nest packages must remain within the supported
  stable v12 range. The CLI remains v12-only, including its peer declarations;
  a CLI peer alone is not an installed tool requirement.
- **Runtime library peers:** accept a bounded, stable semantic range within
  Nest 11/12 that includes a stable v12 candidate, provided it admits the actual
  selected and installed Nest 12 version. Equivalent range spellings have the
  same meaning; do not special-case package names or the literal `^11 || ^12`.
- **Installed evidence:** resolve from the relevant package/owner context.
  A root v12 install cannot mask a nested v11 install or an installed version
  inconsistent with its declaration. Validate each declared framework peer
  against the version that package actually resolves. Common/core and other
  framework packages must form a compatible host; independently versioned
  integrations such as Swagger retain their own compatibility requirements.

The installed-evidence phase runs only when at least one valid runtime peer
range extends below v12. It then checks all supported framework declarations
from their own package contexts, including the CLI, and the installed packages'
Nest peer requirements. Absent optionalDependencies and absent optional peers
of installed framework packages are permitted; an explicitly declared library
peer and the CLI still require evidence. No filesystem resolution is added to
the existing v12-only declaration path.

Resolution reads metadata in Node's package search order within the canonical
workspace directory. It supports hoisted/nested node_modules and package-manager
symlinks without executing framework code or relying on package.json exports.
A broken nearer install fails rather than falling back to a root install.
Parent/global installations and PnP do not count as supported evidence. The
resolver reads fresh metadata per invocation; it does not cache across installs.

Do not infer library eligibility solely from `private`, directory names, the
presence of `exports`, or an Nx build executor. A standalone publishable root
may have dual-major peers and v12 development dependencies, just as a nested
workspace library may. Check every relevant manifest and dependency section;
one section must not hide a conflicting declaration in another.

Accepting a peer range establishes compatibility with this host for tooling
preflight. It does not certify the library author's broader support matrix.
That author remains responsible for packed runtime evidence on every advertised
major. Nest 11 hosts remain outside this plugin's runtime contract.

## Acceptance and rejection cases

| Input                                                                                                            | Required outcome                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stable CLI 12, installed common/core 12.1.2 matching v12 host declarations, library peers `^11 \|\| ^12`         | Accept without rewriting peers.                                                              |
| Same host, peers `^11.0.0 \|\| ^12.0.0` or `>=11 <13`                                                            | Same acceptance; semantic range handling.                                                    |
| Same host, peers `^12.0.0`                                                                                       | Preserve existing successful initialization and repeat safety.                               |
| Publishable root with dual peers and compatible v12 development dependencies/install                             | Accept; root libraries are not classified as unsupported merely by location.                 |
| Nest 10/11/13 runtime host, even with CLI 12 or dual-major peers                                                 | Reject before mutation, with framework-upgrade guidance.                                     |
| A host dependency or optional dependency selecting `^11 \|\| ^12`                                                | Reject ambiguous host selection; library-peer permission does not widen host declarations.   |
| Root v12 but nested package resolves v11, or installed v12 disagrees with a v11 declaration                      | Reject the conflicting package and report its path/evidence.                                 |
| Peers `^11`, `^13`, or `^11 \|\| >=12.2 <13` with installed 12.1.2                                               | Reject: the selected host does not satisfy the peer.                                         |
| Peers `^10 \|\| ^12`, `^12 \|\| ^13`, `*`, or `>=11`                                                             | Reject outside the bounded Nest 11/12 compatibility scope of this epic.                      |
| Prerelease runtime or prerelease peer branch, tags, aliases, unresolved local protocols, invalid or empty ranges | Reject unprovable/unsupported compatibility, even if another branch mentions stable v12.     |
| Dual peers without resolvable installed framework evidence                                                       | Fail closed with installation guidance; neither peer text nor a root CLI proves the runtime. |
| Missing CLI or peer-only CLI                                                                                     | Preserve existing actionable rejection.                                                      |
| Independently versioned integration such as Swagger                                                              | Do not apply framework-major equality to its package version.                                |

All rejection paths must precede mutation and name the manifest, section,
package, declaration and conflicting/missing installed evidence as applicable.
Do not install dependencies, rewrite manifests/locks, or upgrade application
source during preflight. Keep declaration-only validation for existing cases
that do not introduce broader library peers unless a separately justified
compatibility change requires stronger evidence.

## Delivery boundaries and architecture review

The preflight enumerated and read all 24 records in Meta's `adr/` and all six
records in this repository's `docs/adr/` on 2026-11-11, including proposals and
historical records. Before #594 implementation, both inventories were enumerated
again; all Meta contents and local ADRs were unchanged from that full review.
For #595 on 2026-11-12, both inventories were enumerated again and all 24 fetched
Meta ADR contents matched the prior full review. All six local ADRs and relevant
package/contributor guides were reviewed for the build/export/cache scope.
No other repository ADR location was found.

For #596 on 2026-11-14, the inventories were enumerated again: all 24 Meta ADRs
were fetched at `b2cc857bef3ecc4180ca8180db015ba5537bc497` (the same reviewed
revision), and the six local ADRs were unchanged. The contributor instructions,
package ownership/compatibility contract and proposed Meta Nest development guide
were reviewed for clean installation and runtime-matrix validation. The proposed
guide does not supersede accepted ADRs. No new architecture conflict was found.

Relevant rules:

- Accepted Meta 0004, 0010 and 0016 retain local implementation ownership,
  Nest 12 feature development and ecosystem architecture authority. Honoring
  library peers does not make the plugin a Nest 11 runtime integration.
- Accepted Meta 0008/0009 and the local HTTP scaffolding ADR preserve HTTP
  platform independence and existing defaults. No HTTP overlay is introduced.
- The accepted local Nest 12 first-party ADR keeps native framework scaffolding
  with Nest and the plugin focused on Nx integration. The generation-strategy
  ADR is historical; its proposed generators and prerelease guidance do not
  override the current package contract.
- Accepted Meta 0013/0017 and the local release ADR preserve independent Nx
  versioning and separate publication authority. Meta's newer zero-major
  clarification governs over older local wording; this slice changes no version.
- Accepted Meta 0015 requires suitable Nx caching and distributed task inputs.
  The new scenario uses the existing inferred per-spec E2E task and lockfile
  inputs. #596 adds a pinned registry-resolution fixture and explicit runtime
  inputs, preserving cacheability and existing atomization for Nx Agents.
- The local public-package-documentation ADR remains proposed. Contributor
  evidence belongs here; the package README describes the added acceptance path
  and its installed-evidence limits without claiming Nest 11 runtime support.
- The accepted Angular ADR is read but its Angular implementation policies are
  outside this Node/Nx-only scope. No Angular dependency is introduced.

No applicable decision conflicts with this validation change. Some historical/local
text predates current generators and Meta's canonical Contracts ownership; the
current package contract and accepted Meta decisions take precedence. This work
does not author HTTP contracts or change framework source ownership.

[#595](https://github.com/anarchitects/anarchitecture-plugins/issues/595) owns
`@nx/js`/custom build coexistence, exports and inference evidence;
[#596](https://github.com/anarchitects/anarchitecture-plugins/issues/596) owns
clean consumer/matrix validation; [#597](https://github.com/anarchitects/anarchitecture-plugins/issues/597)
owns adoption docs and release readiness. Application migration stays with
[#558](https://github.com/anarchitects/anarchitecture-plugins/issues/558) and
optional Fastify scaffolding with [#508](https://github.com/anarchitects/anarchitecture-plugins/issues/508).

## Focused validation

Run the reproduction through Nx (the E2E target builds the plugin first):

```sh
yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/published-library-peers.spec.ts
yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/published-tsc-build.spec.ts src/nest-scenarios/published-custom-build.spec.ts
yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/packed-library-node22.spec.ts src/nest-scenarios/packed-library-node24.spec.ts src/nest-scenarios/packed-library-node26.spec.ts
yarn nx run-many -t lint typecheck -p nx-nest-e2e
```

The pure validator and filesystem resolver have focused unit coverage for root
libraries, equivalent ranges, conflicting sections, version/declaration mismatches,
framework peer requirements, missing or malformed metadata, nested precedence,
symlinked installations and unchanged declaration-only behavior.

Local #596 evidence on 2026-11-14 (macOS arm64, outer Node 24.22.3): all 21 tests
across the six peer/build/clean-consumer suites passed. After pinning registry
resolutions, all six clean-consumer tests passed again on the exact runtimes in
the table; lint, typecheck, plugin build prerequisite and formatting also passed.
The resolved atomized Node 24 CI target passed, replayed from local cache, missed
cache and passed after a harmless fixture-lock comment change, then replayed
again after byte-for-byte restoration. Linux/Nx Cloud execution and remote cache
reuse still require the PR's CI run; local results do not claim those outcomes.

Completion of this validation slice is not completion of #585 or release approval.
