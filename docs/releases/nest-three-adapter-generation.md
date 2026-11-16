# Three-adapter generation: milestone-1 release readiness

Preparation record for [#614](https://github.com/anarchitects/anarchitecture-plugins/issues/614)
under [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607),
prepared **15–16 November 2026**. The implementation baseline is merged main
`08d2ad6` after the optional-capability slice. Consumer commands and restrictions
live in the [package README](../../packages/nest/README.md); exact versions and
request assertions live in the [HTTP consumer matrix](../guides/nest-http-consumer-matrix.md).

This record consolidates the bounded milestone-1 implementation and its prior
installed-consumer evidence. **Fresh combined validation is pending:** system
sleep interrupted the current candidate's unit and consumer runs. It prepares an
unreleased candidate, not a publication or a claim of unrestricted production
parity. Review, successful validation and CI for this documentation PR remain
release gates; CI is not monitored or asserted here.

## Delivered behavior

New TypeScript independent applications and native sub-apps support explicit
`node`, `express` and `fastify` selection in ESM and CJS. Explicit selection affects
the new application's bootstrap and HTTP test. Existing member source and shared
dependencies are preserved, including conversion into a native monorepo. All nine
owner/member adapter pairs have installed-consumer coverage.

With no effective platform option, native generation still uses **Express**.
Command options override invocation-project defaults, then workspace defaults;
fully qualified generator keys win over collection-style keys at each level.
The canonical `sub-app` key serves the `app` alias. `--project` selects the Nest
owner, not Nx's invocation-project defaults. Application defaults are not inherited
by sub-app generation. Direct programmatic calls use supplied options.

New explicit applications use coherent Nest runtime/adapters **12.5.0**. Member
generation admits coherent audited **12.3.0** or **12.5.0** owners, preserves
compatible declarations, and adds the selected adapter at the owner's version.
It resolves installed packages from the declaring owner; mixed or unverified
hosts fail before mutation. No automatic framework or adapter migration is added.
Platform dependencies belong to the independent package or shared native owner.
Node/Fastify generation retains Express dependencies required by native tooling;
it does not prune dependencies used by other members.

Nest owns native templates, compiler and runtime behavior. The MIT plugin owns
the bounded generation integration and Nx Project Crystal inference; tests/lint
retain their native or dedicated-plugin owners. No copied framework templates,
mandatory schema vendor or application-specific runtime policy is introduced.
Contracts remains the canonical API/schema owner. Runtime presentation and SSR
remain with [Bricks #506](https://github.com/anarchitects/anarchitecture-bricks-3tier/issues/506)
and [Community #33](https://github.com/anarchitects/anarchitecture-community/issues/33).

## Focused implementation and evidence

The PRs below are present in the merged baseline. Merge status is not used as
proof of successful CI; the local records state their own commands and outcomes.

| Slice | Merged PR                                                               | Responsibility                                            |
| ----- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| #608  | [#616](https://github.com/anarchitects/anarchitecture-plugins/pull/616) | Native Node API and generation audit                      |
| #609  | [#617](https://github.com/anarchitects/anarchitecture-plugins/pull/617) | Explicit independent Node applications                    |
| #610  | [#619](https://github.com/anarchitects/anarchitecture-plugins/pull/619) | Node members and preservation of existing owners          |
| #620  | [#623](https://github.com/anarchitects/anarchitecture-plugins/pull/623) | Shared three-adapter contract and selection precedence    |
| #621  | [#624](https://github.com/anarchitects/anarchitecture-plugins/pull/624) | Explicit Express applications and members                 |
| #509  | [#625](https://github.com/anarchitects/anarchitecture-plugins/pull/625) | Baseline Fastify applications                             |
| #622  | [#626](https://github.com/anarchitects/anarchitecture-plugins/pull/626) | Fastify members and mixed owners                          |
| #611  | [#627](https://github.com/anarchitects/anarchitecture-plugins/pull/627) | Nest 12.5 rebaseline and frozen installed-consumer matrix |
| #612  | [#628](https://github.com/anarchitects/anarchitecture-plugins/pull/628) | Shared HTTP/security conformance and implicit control     |
| #613  | [#629](https://github.com/anarchitects/anarchitecture-plugins/pull/629) | Bounded optional HTTP capabilities on all three adapters  |

| Public claim                                                            | Implementation / contract                                                                                                                                                                                                      | Installed-consumer evidence                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit application selection, ESM/CJS and Observe                     | [Application generator](../../packages/nest/src/generators/application/generator.ts), [HTTP transform](../../packages/nest/src/generation-adapter/http-application.ts), [schema](../../packages/nest/schemas/application.json) | `http-node22`, `http-node24`, `http-node26`, `http-npm`: 24 scenarios; native build/tests/lint, actual adapter identity and loopback HTTP                                                                                     |
| Member selection, mixed owners, defaults and non-destructive conversion | [Member integration](../../packages/nest/src/utils/generate-nest-member.ts), [sub-app schema](../../packages/nest/schemas/sub-app.json), [selection contract](../guides/nest-three-adapter-generation-contract.md)             | Same four lanes cover all nine pairs, CLI/default precedence, alias, dry runs, repeat generation, duplicate rejection, preserved source and resource registration; `http-sub-app` retains 12.3.0 and custom-owner regressions |
| Omission remains native Express                                         | [Native generation adapter](../../packages/nest/src/generation-adapter/run-nest-schematic.ts)                                                                                                                                  | Implicit sibling in baseline matrix; `http-contract-implicit` verifies ESM/CJS HTTP behavior and unchanged native bootstrap                                                                                                   |
| Shared HTTP/security behavior                                           | [Conformance suite and exact assertions](../guides/nest-http-consumer-matrix.md#shared-http-and-security-conformance)                                                                                                          | Four `http-contract-*` specs: eight consumers, 32 application starts; [versioned evidence](../audits/nest-http-contracts-2026-11-15.json)                                                                                     |
| Bounded optional capabilities                                           | [Capability matrix and configuration differences](../guides/nest-http-consumer-matrix.md#optional-http-capabilities)                                                                                                           | Three `http-capability-*` specs: six consumers, 12 enabled/disabled application starts; [versioned evidence](../audits/nest-http-capabilities-2026-11-15.json)                                                                |
| Library adoption and build/export guarantees remain intact              | [Published-library contract](../guides/nest-published-library-compatibility.md)                                                                                                                                                | `published-library-peers`, `published-tsc-build`, `published-custom-build` and six `packed-library-node22/24/26` cases; [prior release record](nest-published-library-adoption.md)                                            |
| Published commands, aliases, peers, exports and MIT packaging           | [Packed-package tests](../../packages/nest/src/package.spec.ts)                                                                                                                                                                | Packed README equality and schema option checks; public runtime/type exports; no source/spec/build-info files in archive                                                                                                      |

All spec names above refer to files under
[`packages/nest-e2e/src/nest-scenarios`](../../packages/nest-e2e/src/nest-scenarios).
The [baseline evidence](../audits/nest-http-consumers-2026-11-15.json) records exact
resolved versions, lock hashes, commands, cache probes and exclusions. Consumers
install the real packed plugin into isolated workspaces, compare frozen registry
records and require immutable install/npm ci. Linked framework stubs or forced
peer installs do not supply the HTTP support evidence.

## Scope of certification

The baseline samples Node/Nx **22.22.3/23.2.0**, **24.21.0/24.0.1** and
**26.0.0/24.0.1** using Yarn **4.17.0** with node-modules; the npm **11.19.1**
lane uses Node **24.21.0** / Nx **24.0.1**. All use TypeScript **6.0.3** and
CLI/schematics **12.0.13**. Observe **0.3.26** is on in the Node 24 and npm lanes;
startup is verified, exporter delivery is not. Native CJS Jest is unsupported
on Node 22; those cases assert the upstream ESM-loading failure and still verify
build, real HTTP and lint. ESM/Vitest and Node 24/26 CJS tests execute normally.

HTTP/security checks cover shared Standard Schema validation/serialization,
raw body, cookies, CORS, CSRF, guards, security headers, proxy trust, HTTPS and
representative streaming on Node **24.21.0**. Parser differences are explicit:
unsupported content types return 415 on Fastify and schema-driven 400 on
Node/Express. Explicit limits and proxy configurations are tested; the results
do not establish production authentication, deployment or full authorization policy.

Optional checks use that Node 24 Yarn lane and independent ESM/CJS applications:
Swagger **12.1.2**, Standard Schema spec **1.1.0**, EJS **5.0.1**, and Fastify peers
static **10.1.11**, multipart **10.1.8**, view **12.0.1**. Validation-only Standard
Schema needs an explicit JSON-schema converter for OpenAPI. Upload evidence is
bounded memory storage, not content safety, persistence or streaming uploads.
Fastify static serving explicitly hides dotfiles and avoids duplicate reply
decoration alongside Swagger; its native upload interceptor registers multipart.
Optional native-member/Observe/Rspack composition, browser Swagger execution,
other engines, SSE reconnect, WebSockets, HTTP/2 and frontend SSR remain unverified.

The library controls deliberately retain Nest framework **12.1.2** and CLI
**12.0.0**. The host still runs stable Nest 12 while libraries may retain verified
bounded Nest 11/12 peers. Initialization does not rewrite library peers, exports,
declarations, output formats, custom/`@nx/js:tsc` builds or publishing ownership.
Nx-native generated libraries remain source-only. Library authors own evidence
for each advertised runtime major; three-adapter success does not prove an
arbitrary library's Nest 11 compatibility.

These are macOS arm64 local results, not every OS, version, builder, package
manager or Yarn PnP combination. The existing CI `e2e-ci` wildcard discovers the
43 spec tasks; this record does not assert their remote execution or cache reuse.

## Current candidate validation

Local host: macOS arm64, Node **24.22.3**, Yarn **4.17.0**, Nx **24.0.1**.
The consumer lanes verify their separately installed exact Node binaries.

| Gate                                           | Observed result                                                                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin build and both projects' lint/typecheck | Passed: five tasks, two local cache hits; 16 existing plugin lint warnings, no errors.                                                                                                                               |
| Unit suite                                     | Pending a clean rerun: initial run passed 674/675 tests in 34/35 suites; one subprocess timed out. The affected 33-test suite subsequently passed 29 and 32 tests in two attempts, with timeouts in different cases. |
| Full installed-consumer suite                  | Pending a clean rerun: 46/110 tests and 24/43 suites passed; remaining suites reported subprocess/install/test timeouts during repeated system sleep. The follow-up run was stopped for draft review.                |
| Package inspection                             | 188 files; README matches source; MIT license and public runtime/type exports present; no source, specs or build-info files.                                                                                         |
| Version and full release preview               | Passed in dry-run mode; derived 0.1.1 without an explicit specifier.                                                                                                                                                 |

The macOS power log confirms repeated system sleep and dark wakes during these
runs, including 15–17-minute sleep intervals. Command-scoped idle-sleep prevention
did not stop those interruptions. No assertion, deadline, dependency or source
was changed to obtain a pass. The original failing unit case passed on retry,
but the interrupted runs are **not** recorded as successful full validation.
The owner requested draft review with validation pending. Re-run the unit and
consumer commands below on an awake host before completing candidate certification;
the earlier #611–#613 records remain dated evidence for their respective baselines.

The inspected local archive retains development version 0.1.0. Its identity is
recorded here for reproducibility, not as the registry artifact or a future
versioned release. No archive is committed.

Packed README SHA-256:

```text
6f099ecf3df010fb462b575702acf2de16e273049ef62b7d90796e67c3a5ba48
```

Candidate archive integrity:

```text
sha512-iaE4bgrb5RUH1JbsosAKkCyRh7vCgPOB0dTCKkwOub5PW7lbbGfhu1etfroc/xcmzMG/RSUg3BW9mF3xPn0hUw==
```

Reproduce from the repository root with registry access, Corepack/npm, OpenSSL
`req -addext`, and permission to bind loopback HTTP/HTTPS ports:

```sh
corepack yarn nx run-many -t build,lint,typecheck -p nx-nest,nx-nest-e2e --output-style=static
corepack yarn nx run nx-nest:test --runInBand --output-style=static
corepack yarn nx run nx-nest-e2e:e2e --output-style=static
corepack yarn nx release version --projects=nx-nest --dry-run
corepack yarn nx release --projects=nx-nest --dry-run --skip-publish
```

Local execution disables daemon/plugin isolation/cloud with `NX_DAEMON=false`,
`NX_ISOLATE_PLUGINS=false`, `NX_NO_CLOUD=true` and uses a temporary SWC cache.
This changes local execution only, not the repository's CI distribution strategy.
The full E2E target runs two Jest workers; CI infers individual spec targets.

## Release impact and handoff

Registry inspection on **15 November 2026** found `latest` at **0.1.0** with
history `0.0.0-stage`, `0.0.1`, `0.0.2`, `0.0.3`, `0.1.0`. The checked-in package
version remains 0.1.0. A locally packed archive with that version contains this
candidate, not the registry's existing 0.1.0 artifact. These features are unreleased.

The additions are opt-in; omission, library guarantees and supported major ranges
remain unchanged. Nx independent release and Conventional Commits determine the
next version. Accepted Meta ADR 0013 uses zero-major semantics: additive `feat`
changes on 0.x receive a patch; breaking changes require a minor. Nx's effective
`adjustSemverBumpsForZeroMajorVersion` defaults to true. The exact project scope
is `nx-nest`; this documentation commit is non-bumping. No manual manifest bump,
version plan, `--first-release`, history rewrite or automatic 1.0 promotion belongs
in this preparation. Recompute the preview on the final merged candidate.

The local version and full release dry runs both passed without a supplied
specifier. Nx reads `nx-nest@0.1.0`, classifies the additive commits as `minor`
before zero-major adjustment, and derives **0.1.1**, with tag `nx-nest@0.1.1` and
a project GitHub changelog. This is the observed preview, not a reserved version.

The release checklist is separate from milestone-1 implementation:

- Review this PR and require its CI to pass. Re-run affected evidence and release
  previews if implementation, dependencies or policy change before release.
- Obtain explicit publication authorization from the Nx Plugins capability owner
  and technical maintainer, Johan, as recorded in
  [Meta ownership](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/ownership.md).
  Starting, reviewing or merging #614 does not authorize publication.
- After authorization, use **Release (Manual)** on main with `projects=nx-nest`,
  an empty `specifier` and `first_release=false`; review the derived version first.
  **A real GitHub Release triggers npm Publish even though Release uses
  `--skip-publish`.** Do not dispatch it as a preview. Follow the
  [current release/publication handoff](../../CONTRIBUTING.md#release-publication-and-recovery).
- Verify the versioned manifest, tag and archive agree, then verify npm version,
  dist-tag, exports, peers, README and the Publish outcome. Update the dated
  unreleased notice for the actual published version during that release handoff.

No workflow, version commit, tag, GitHub Release or npm publication is performed
by this preparation.

## Follow-up boundaries

Milestone 1 covers all three explicit adapters and does **not** depend on
[#615](https://github.com/anarchitects/anarchitecture-plugins/issues/615), the
separate evidence/decision gate for future default activation. Node remains the
strategic candidate; Express remains the omitted-platform behavior. This record
does not satisfy performance/SSR/default-activation gates by implication.
The [accepted 16 November default review](nest-node-default-decision.md) records
the principle of following Nest's native default and deferring an independent
Node switch, with evidence gates for a future framework upgrade.

[#508](https://github.com/anarchitects/anarchitecture-plugins/issues/508) retains
optional Fastify presets and integration work. Baseline Fastify generation is
already delivered by #509/#622. The #613 evidence lets #510–#514 reuse shared
Swagger/schema behavior and native Fastify capabilities without unnecessary
adapter shims. [#515](https://github.com/anarchitects/anarchitecture-plugins/issues/515)
owns documentation for those future presets; this record documents the current
consumer-owned configuration only.

[#558](https://github.com/anarchitects/anarchitecture-plugins/issues/558) remains
application integration/adoption, not an adapter-migration generator. Manual
adoption and rollback guidance preserves source/configuration/manifests/lockfile
as one coherent change and retains shared adapter dependencies. The
[#585](https://github.com/anarchitects/anarchitecture-plugins/issues/585) published
library guarantees remain regression gates, not replaced by HTTP certification.

## Architecture preflight

All **25 Meta ADRs** were enumerated and read at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`, along with **all six local ADRs**,
relevant Nest engineering/audit/consumer/library guides, release records,
contributor instructions and the release/publication workflows. The inventory
matches the [capability preflight record](../audits/nest-http-capabilities-2026-11-15.json).

Accepted Meta 0008/0009 preserve HTTP independence and separate default activation;
0010 retains first-party runtime choices; 0011 governs security ownership; 0012
makes Contracts canonical; 0013/0017 and the local release ADR govern versioning
and publication authority; 0015 preserves correct Nx task inputs and distributed
validation; 0016 identifies ownership; 0022 governs stable-major maintenance.
The local Nest-first ADR keeps native scaffolding with Nest. Historical generation
records and proposed documentation/engineering guidance do not override accepted
decisions. Older local Contracts-pending and initial-release wording is interpreted
under accepted Meta 0012/0013/0017. No Angular code, default activation, policy
amendment or architecture exception is introduced.
