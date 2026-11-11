# Published Nest library compatibility preflight

Status: implementation contract for [#593](https://github.com/anarchitects/anarchitecture-plugins/issues/593),
the first slice of [#585](https://github.com/anarchitects/anarchitecture-plugins/issues/585).
The current plugin still rejects dual-major peers. This document specifies the
next validation slice; it does not announce shipped support or amend an ADR.

## Reproduction and ownership

`packages/nest-e2e/src/nest-scenarios/published-library-peers.spec.ts` creates a
generic publishable CommonJS library with public JavaScript/declaration exports
and Nest common/core peers. It builds through an existing custom Nx target,
packs with npm, extracts the archive into a Nest 12 consumer, and resolves the
library through its public package entry point. A real Nest application context
resolves the library's injectable service before the packed plugin runs `init`.

The host uses the E2E package's locked dependencies: Nest CLI 12.0.0 and
common/core 12.1.2. Assertions read the resolved versions in the consumer process.
Both `^11 || ^12` and `^11.0.0 || ^12.0.0` then reproduce the exact library-peer
diagnostic. A separate `^12.0.0` control initializes twice successfully. The
control is a distinct fixture, not a workaround that narrows a real library's
published compatibility range.

Normal and dry-run rejection preserve `nx.json`; all cases preserve library
source, build configuration, compiled output, exported declarations, installed
artifact bytes, host source/configuration, package manifests and the lockfile.
The rejection assertions deliberately characterize the bug. Replace them with
successful initialization assertions in [#594](https://github.com/anarchitects/anarchitecture-plugins/issues/594).
Do not retain the rejection as the desired public contract.

This uses the existing linked-dependency E2E harness: the plugin and library are
real tarballs, while framework/tool dependencies are linked from the immutable
repository install. It proves loading and dependency injection on one Nest 12
baseline. It does not prove a fresh package-manager install, Nest 11 runtime
compatibility, full ESM/CJS interoperability, secondary exports, or an entire
Node/Nx/TypeScript support range. Those are later slices. No registry publication
occurs, and no claim is made that this fixture is a released third-party package.

## Host selection and library compatibility

The plugin runtime remains stable Nest 12 only. A library peer declaration
describes the consumers that its published artifact supports; it does not select
the framework used to run this workspace. A verified dual-major library must not
lose its Nest 11 compatibility declaration merely to initialize Nest 12 tooling.

The next implementation must distinguish:

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

Do not infer library eligibility solely from `private`, directory names, the
presence of `exports`, or an Nx build executor. A standalone publishable root
may have dual-major peers and v12 development dependencies, just as a nested
workspace library may. Check every relevant manifest and dependency section;
one section must not hide a conflicting declaration in another.

Accepting a peer range establishes compatibility with this host for tooling
preflight. It does not certify the library author's broader support matrix.
That author remains responsible for packed runtime evidence on every advertised
major. Nest 11 hosts remain outside this plugin's runtime contract.

## Required acceptance and rejection cases for #594

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
historical records. No other repository ADR location was found. Relevant rules:

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
  inputs; it does not add CI partitions or disable task caching.
- The local public-package-documentation ADR remains proposed. Contributor
  evidence belongs here; public README support claims stay unchanged.
- The accepted Angular ADR is read but its Angular implementation policies are
  outside this Node/Nx-only scope. No Angular dependency is introduced.

No applicable decision conflicts with this reproduction. Some historical/local
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
yarn nx run-many -t lint typecheck -p nx-nest-e2e
```

This slice deliberately leaves production validation unchanged. Completion of
the reproduction is not completion of #585 or release approval.
