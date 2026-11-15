# Native Node generation audit and implementation contract

Status: reviewed audit for [#608](https://github.com/anarchitects/anarchitecture-plugins/issues/608)
under [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607).
Reviewed on 2026-11-15 against Plugins
`3f20fd6f47d4d8b8786c88489c85bf76bc2226fb` and Meta
`3899558482b615aa46dd5004eae440d62cd2e222`.

The original audit below records that baseline. The final section records the
subsequent independent-application and sub-app implementations under #609/#610.
The [three-adapter generation contract](nest-three-adapter-generation-contract.md)
extends this evidence under #620, distinguishing this baseline from newer
released candidates without changing the completed Node slice.

**Explicit NodeAdapter generation is feasible with the released API, but is not
implemented or certified by this audit.** The implementation must change the
generated HTTP test bootstrap as well as the application bootstrap, preserve
Observe options, and keep shared owner dependencies. The current omitted-platform
behavior remains Nest's implicit Express adapter. This document changes no
generator schema, dependency, default, release, or existing application.

## Evidence and its limits

The package currently pins `@nestjs/schematics` 12.0.6. The local installation
initially resolved 12.0.0-alpha.7; that installation was excluded from schematic
evidence. An isolated npm installation fetched the exact released packages below
without lifecycle scripts or dependency overrides. The repository manifest and
lockfile were not changed.

| Component                                      | Audited version / constraint | Meaning                                                                          |
| ---------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| Node                                           | 24.22.3, macOS arm64         | Actual audit runtime, not a multi-runtime certification                          |
| Nx / `@nx/devkit`                              | 24.0.1                       | Isolated generator/command environment                                           |
| TypeScript                                     | 6.0.3                        | ESM/CJS API probes compiled with NodeNext                                        |
| `@nestjs/schematics`                           | 12.0.6                       | Exact plugin dependency and generated-output baseline                            |
| Angular Devkit core/schematics                 | 22.2.0                       | Schematic engine dependencies                                                    |
| `@nestjs/cli`                                  | 12.0.0                       | Existing toolchain baseline; independent of framework minor                      |
| `@nestjs/common`, core, testing, platform-node | 12.3.0 each                  | First explicit candidate set for implementation and consumer testing             |
| reflect-metadata / RxJS                        | 0.2.2 / 7.8.2                | Candidate runtime peers                                                          |
| `@types/node`                                  | 24.0.0                       | API probe typings; not a declaration of every generated consumer's types version |

Registry evidence: [schematics 12.0.6](https://registry.npmjs.org/@nestjs%2fschematics/12.0.6)
and [platform-node 12.3.0](https://registry.npmjs.org/@nestjs%2fplatform-node/12.3.0).
The tarball SHA-1 values were respectively
`663f8ee24ae94b18b561c6ce6fe5881820efd473` and
`209d0a674615ef4318301b5673c77a9b9c099a7d`; npm also verified the registry integrity
metadata. The adapter manifest records upstream git revision
`3acb8e574acdacde6022e58186a823cee4e0d05f`.

The emitted current plugin was built through Nx, copied into the isolated
environment and exercised with the released schematics. Four in-memory scenarios
covered ESM/CJS with Observe off/on, application creation and repetition,
standalone-owner conversion, sub-app repetition and a REST resource. All passed
their assertions. CLI application dry runs and a CJS sub-app dry run succeeded;
the current CLI correctly rejected `--platform=node` as absent from the schema.

Separate small authored `.mts` and `.cts` probes compiled and ran against the
exact 12.3.0 framework set. Both created a NodeAdapter app, asserted
`getHttpAdapter().getType() === 'node'`, listened on an ephemeral loopback port,
served a real HTTP GET, created an explicit NodeAdapter testing application and
closed both applications. They establish the candidate API's basic usability.
They are **not** generated Node applications, packed-plugin consumers, complete
generated build/test/lint workflows, Observe telemetry validation, or production
security/conformance evidence. Those remain #609–#614 work.

## Current implementation and upstream output

Read these boundaries together; an independent application and a native member
do not have the same ownership or repeat behavior.

| Area                                                                                        | Observed behavior                                                                                                                                                                  | Constraint for the overlay                                                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Application generator](../../packages/nest/src/generators/application/generator.ts)        | Normalizes destination/name, validates workspace registration and name collisions, delegates to the native application schematic, adds project metadata and schedules installation | Strip plugin-only platform options before native invocation; preserve all omitted-platform behavior         |
| [Sub-app/member helper](../../packages/nest/src/utils/generate-nest-member.ts)              | Selects the Nest owner, scopes the schematic, registers native members, restores custom Rspack options and moves matching sourceRoot metadata                                      | Apply the overlay only to the newly requested application member; preserve relocated original code          |
| [Schematic adapter](../../packages/nest/src/generation-adapter/run-nest-schematic.ts)       | Stages a snapshot, invokes upstream, applies guarded additions, then commits                                                                                                       | All new overlay failures must occur before caller Tree mutation                                             |
| [Additive guard](../../packages/nest/src/generation-adapter/additive-transform.ts)          | Permits missing files and non-replacing JSON additions; intentionally cannot overwrite source                                                                                      | A narrow platform transform boundary is needed; do not weaken the generic guard                             |
| [Isolated schematic worker](../../packages/nest/src/generation-adapter/schematic-worker.ts) | Bridges upstream cwd-based owner reads into the scoped Tree; production-mode execution preserves native source moves                                                               | Retain isolation; do not introduce process-wide cwd changes or filesystem writes                            |
| [Installation helper](../../packages/nest/src/utils/dependency-install.ts)                  | Returns one Nx workspace-install callback after successful generation; honors skipInstall                                                                                          | Include platform manifest changes in its change detection; never execute native task installers             |
| [Dependency validator](../../packages/nest/src/utils/validate-dependencies.ts)              | Checks a fixed framework package set; platform-node is absent; broader library peers trigger installed evidence                                                                    | Add a reviewed platform-node policy without raising every existing Nest 12 host's minimum or weakening #585 |
| [Inference](../../packages/nest/src/plugins/plugin.ts)                                      | Discovers Nest owners/members and infers build/start independently of HTTP platform                                                                                                | Preserve current `CreateNodes` API and runtime `createNodesV2` alias; add no adapter-specific targets       |

The 12.0.6 application schematic has no platform option or platform extension
hook. Its factory selects native templates by language/module system. With the
audited TypeScript defaults:

- Both modes emit `NestFactory.create(AppModule)` and dependencies on
  common/core/platform-express `^12.0.1`, plus testing `^12.0.1` in development.
  These ranges can retain an older installed framework through a lockfile;
  they do not establish a 12.3 runtime.
- ESM uses relative `.js` imports, top-level awaited bootstrap and Vitest. CJS
  uses extensionless relative imports, `void bootstrap()` and Jest. Both use
  NodeNext compiler settings, Oxlint and native Nest CLI scripts. Standalone
  Nest config leaves the builder unspecified; CLI's default is tsc.
- Observe adds its dependency and module wiring, and passes an options object
  containing `instrument: ObserveInstrument` as the second factory argument.
- HTTP specs use `INestApplication<App>`, Supertest and
  `moduleFixture.createNestApplication()` with no adapter. Core/testing's
  released implementation selects Express when an adapter is omitted.
- Native sub-app conversion moves the original source/test directories, creates
  owner and member entries, changes TypeScript references and selects Rspack.
  The plugin preserves configured Rspack options and completes hoisted build,
  ESM test and owner lint integration. It must keep doing so.
- The sub-app schema exposes neither `type` nor `observe`. Module-system imports
  follow the owner. The new sub-app does **not** inherit Observe wiring merely
  because the original owner app has it. Preserve the original instrumentation;
  do not promise a new sub-app Observe option in #610.
- Native member bootstrap uses `process.env.port`, and CJS emits
  `bootstrap()` without `void`. These are existing upstream behaviors, not
  permission for unrelated overlay fixes. The README already documents the
  possible CJS floating-promise lint warning.

Identical current application generation is a no-op. A custom/conflicting
application file is rejected. Repeating a sub-app name fails before committing
changes because upstream rejects an existing project. Preserve this distinction:
safe repeated invocation does not require making native sub-app creation into an
update operation.

## Released API and dependency contract

The [official adapter guide](https://docs.nestjs.com/http/performance#node-adapter)
was checked against the installed release, rather than used as an unversioned
support promise. In platform-node 12.3.0:

- The public root exports the `NodeAdapter` class and `NestNodeApplication`
  interface. The factory's verified overload accepts module, adapter, then
  optional Nest application options. TestingModule accepts an explicit adapter.
- Use the public package entry point and a type-only application import. Preserve
  existing module imports and bootstrap invocation. Preserve Observe by moving
  its unchanged options object to the third argument.
- `NestNodeApplication`'s type parameter is a Node HTTP/HTTPS server type, not
  Supertest's `App` type. The generated spec must use the appropriate Nest type,
  not simply rename `INestApplication<App>`.
- Today's guide mentions `inject()` and `setLocal()`, but the audited 12.3.0
  application interface and adapter do not expose those helpers. Do not generate
  calls to them at this floor. Use real HTTP for consumer evidence.
- The adapter peers are common/core `^12.0.0`; core has Node `>=20` and optional
  Express/microservice/websocket peers. The adapter itself has no engines field.
  The plugin/schematic/Devkit floor is stricter:
  `^22.22.3 || ^24.15.0 || >=26.0.0`. A loose peer range is not proof that an older
  core provides every API required by this adapter.
- There is no `fastify` or platform-fastify dependency. Upstream does use helper
  packages such as `@fastify/proxy-addr` and `fast-querystring`; native Node does
  not mean a dependency-free implementation.

For the first candidate, plan common/core/testing/platform-node **12.3.0 exactly**
for fresh Node applications. Keep CLI 12.0.0 and schematics 12.0.6 independently
versioned. This is the initial test candidate, not an approved supported-version
range. #611 must verify clean installed versions/peers and select or amend the
candidate before support is advertised. Later patches require deliberate evidence
and fixture updates, not runtime registry queries or a moving `latest` pin.

An existing owner must already select a compatible, verified host for a Node
sub-app. Resolve common/core/testing and relevant peer requirements from that
owner, so a newer root installation cannot hide an older nested install. Adding
the missing adapter is allowed by explicit selection; upgrading existing host
packages, replacing incompatible declarations or forcing peer resolution is not.
Reject with the owner path, conflicting dependency and repair guidance before
mutation. `skipInstall` defers the permitted installation; it is no compatibility
bypass. Ordinary omitted-platform generation and init's existing v12-only
declaration path retain their current contract.

Give platform-node its own verified version rule when adding it to framework
coherence checks. Do not blindly extend the legacy adapters' bounded Nest 11/12
library-peer allowance to an adapter introduced in Nest 12.3.

Initially **retain** platform-express and Express typings emitted by the native
schematic. Both actual runtime and generated HTTP tests must nevertheless select
Node explicitly. Removing now-unused dependencies can be reviewed only after
source, tooling and packed-consumer evidence demonstrates safety. In a shared
owner, original apps, sibling members, tests or middleware can still need them;
never remove them based solely on the newly selected platform. Do not modify
library peers or add adapters to libraries and non-HTTP transports.

## Selection and precedence

This is a proposed implementation contract for #609/#610, **not today's CLI**.
Add optional `platform` to the HTTP application and sub-app schemas/types only.
The first implemented value is `node`; do not expose `fastify` or `express` as
working explicit selections until separately implemented and validated. Omission
means native generation. There is no new `auto`, inferred adapter, null reset,
environment variable or implicit owner inheritance.

Use Nx's existing generator defaults. Nx 24.0.1's
`combineOptionsForGenerator` / `getGeneratorDefaults` apply this precedence,
highest first:

1. Explicit CLI options.
2. The invocation's default project's fully qualified generator defaults, then
   its nested collection/generator defaults.
3. Workspace `nx.json` fully qualified generator defaults, then nested defaults.
4. Generator schema defaults; leave `platform` without a default, preserving
   omission for native generation.

Use canonical keys `@anarchitects/nest:application` and
`@anarchitects/nest:sub-app`; Nx normalizes the `app` alias to `sub-app`.
The project used for Nx defaults comes from invocation cwd/default-project
resolution. **`--project=<owner>` selects the Nest destination; it does not by
itself change Nx's default-project configuration lookup.** Do not add a second
owner-default merge in the generator. Direct programmatic invocation receives
its supplied options; it does not implicitly run the CLI merge.

| Input / context                                                                     | Required result                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No platform in CLI or applicable defaults                                           | Unmodified native bootstrap and dependency policy; implicit Express on audited Nest 12                              |
| Explicit `node`, or applicable Nx generator default `node`                          | Verified explicit Node overlay for the new HTTP app/member only                                                     |
| CLI value conflicting with configured default                                       | CLI wins, then validate; an unsupported CLI value must fail rather than fall back                                   |
| Empty string, null, boolean, unknown name, or unimplemented `express`/`fastify`     | Actionable rejection before any Tree change or install callback                                                     |
| Node configured in generator defaults, but native generation desired                | Remove/change the applicable configuration; no per-command reset is promised in the initial node-only surface       |
| Platform placed in inference plugin options, targetDefaults or Nest CLI config      | Not a supported platform-selection surface; document the generator keys instead                                     |
| Node sub-app in an existing Express/Fastify/custom owner                            | Preserve existing apps/tests/dependencies; permit only the audited compatible host/new-member path                  |
| Omitted-platform member in an owner containing Node apps                            | Native default remains native; do not infer Node from installed packages or sibling source                          |
| Library/resource/artifact/non-HTTP request with platform option                     | Do not add the option there or silently reinterpret its scope                                                       |
| JavaScript application/member with `platform=node`                                  | Initially reject: #609/#610 candidate scope is TypeScript ESM/CJS; ordinary native JavaScript behavior is unchanged |
| Incompatible owner, unverified host, duplicate member or custom bootstrap collision | Reject before committing; report the precise unsupported condition                                                  |

The node-only configuration reset limitation must be documented. Explicit
Express opt-out needs its own validation before #615 can authorize a default
switch; do not invent it as an undocumented fallback in #609.

## Minimal transform and mutation boundaries

No supported upstream HTTP-platform extension was found in schematics 12.0.6.
Use a small, dedicated structured transform on staged native output. Keep it
separate from the general additive metadata guard and reusable between the two
HTTP generators. Do not fork templates or expose unrestricted overwrite access.

Allowed platform-owned changes are limited to:

1. The **new** application's entry file: add the public adapter/type imports,
   add the application generic, and insert the adapter argument before any
   existing options object.
2. The **new** application's emitted HTTP specs: select the same adapter in
   `createNestApplication`, update the application type and remove only imports
   made unused by that change. Keep Supertest, native test runner, test semantics
   and lifecycle cleanup. Respect custom spec suffixes and absent specs.
3. The independent app's package manifest or the native member's owner manifest:
   apply the reviewed dependency plan without deleting shared requirements.

Use the TypeScript parser to identify exact call/import bindings, with bounded
edits preserving comments, `.js` versus extensionless imports, bootstrap style
and the original options expression. Require an unambiguous expected call shape;
reject unknown upstream structures, ambiguous bindings or collisions. Applying
the transform twice to its own output must be byte-stable and must not duplicate
imports or adapters. A changed template fingerprint/structure requires audit and
fixture review, not a broader regex.

All option/version checks, native execution, overlay edits and metadata checks
must succeed before applying the final snapshot. Installation remains an Nx
callback after successful commit; CLI dry runs never flush changes or run it.
The current internal adapter's `dryRun` additionally leaves its caller Tree
untouched. A later install failure is different from preflight rejection: Nx has
already written files by then, as documented today.

For independent applications, rerunning upstream directly over Node-transformed
files would conflict before post-processing. Generate the prospective native
application in an isolated staging snapshot, transform it, and compare/merge the
**final** generated bytes against the destination. Identical output is a no-op;
custom/conflicting files fail, with no overwrite or implicit adapter migration.
Do not introduce a marker that alone authorizes overwriting user source.

For sub-apps, use the existing scoped native owner snapshot and conversion path.
Find the requested new member from the resulting Nest project metadata rather
than assuming `apps/<name>/src/main.ts`. Preserve the old app/test bytes when
upstream relocates them; do not apply the platform transform to those files.
Duplicate member creation continues to reject atomically. The shared transform
itself remains idempotent. Keep member tooling/setup changes within the same
all-or-nothing operation when adding new failure paths.

## Required fixtures and consumer certification

| Delivery                   | Required evidence before acceptance                                                                                                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #609 application           | ESM/CJS × Observe off/on; unchanged omitted output; explicit runtime and HTTP-test adapter; option/version rejection; custom/spec-disabled/suffix/import collision cases; repeat no-op and dry-run/skipInstall safety                                                                    |
| #610 sub-app               | ESM/CJS owners; standalone conversion and existing native owners; custom rootDir/path; preserved original bootstrap/tests and shared dependencies; mixed-platform compatibility or explicit restriction; duplicate rejection; resource registration and existing library build ownership |
| #611 clean consumers       | Packed plugin installed with real package managers in isolated fresh workspaces; no repository framework links; resolved-version/peer assertions; actual Node adapter identity and HTTP; build/start/test/lint, resources, lifecycle and supported Observe execution                     |
| #612 HTTP/security         | Positive/negative validation and serialization, guards, errors/status/headers/cookies, body limits/parsing, raw-body signatures, proxy trust and relevant HTTPS/lifecycle behavior                                                                                                       |
| #613 optional capabilities | Independently verified Standard Schema/OpenAPI/Swagger, multipart/uploads, static assets/views and explicit unsupported/unverified states; no mandatory optional packages                                                                                                                |
| #614 readiness             | Exact version/capability matrix, regression evidence, supported configuration and limits, reviewed release plan; no premature shipped-support claim                                                                                                                                      |
| #615 conditional default   | Separate owner decision, validated alternative selections, production/security/benchmark evidence and external runtime/SSR gates; versioned rollout/rollback without existing-app migration                                                                                              |

Initial version candidates for #611 are Node 22.22.3 / Nx 23.2.0,
Node 24.21.0 / Nx 24.0.1, and Node 26.0.0 / Nx 24.0.1, following the existing
[clean library matrix](nest-published-library-compatibility.md). Use TypeScript
6.0.3, CLI 12.0.0, schematics 12.0.6 and the candidate 12.3.0 runtime set.
Re-check peer/engine intersections before selecting lanes. These are **untested
NodeAdapter matrix candidates**, not inherited support from the 12.1.2 Express
library fixtures. Start with Yarn 4.17.0/node-modules and a meaningful npm lane;
do not imply PnP, pnpm or Bun runtime coverage from workspace-registration tests.

Keep the default-Nest and #585 regression suites. #508 owns future opt-in Fastify
scaffolding independently; do not require its unfinished implementation to finish
Node generation or claim it is already certified. Bricks 3-Tier #506 and Community
#33 continue to own presentation/SSR integration, not this generator's output.

## Architecture preflight and conflicts

All 24 Meta ADR files were enumerated from the untruncated recursive tree and
read at the revision above, including the duplicate historical numbering and
short `ADR-0001.md` record. The inventory is:

| Meta records                                                                                                              | Status at review                                                |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0001 cooperative governance enrichment                                                                                    | Proposed                                                        |
| 0001 two core implementation styles; 0002 modulith-first; 0003 cross-repo AI; 0004 landscape contracts                    | Accepted                                                        |
| 0005 governance inheritance; 0006 Archi reference; 0007 workspace layering                                                | Proposed                                                        |
| 0008 HTTP independence; 0008 Modern Angular                                                                               | Accepted                                                        |
| 0009 native Node preference; 0010 Nest-first; 0011 authentication safety; 0012 canonical contracts                        | Accepted                                                        |
| 0013 versioning; 0014 dependency management; 0015 Nx caching/distribution                                                 | Accepted                                                        |
| 0016 authority; 0017 release authority; 0018 upstream exceptions; 0019 projects; 0020 Infra boundary; 0021 consumer reuse | Accepted, effective on adopting merge; present on reviewed main |
| ADR-0001 repository landscape                                                                                             | Accepted                                                        |

All six local ADRs were read; no other local ADR directory was found:
[historical generation strategy](../adr/adr-nest-generation-strategy.md),
[proposed public documentation](../adr/adr-public-package-documentation.md),
[accepted Angular policy](../adr/modern-angular-22-signal-forms.md),
[accepted release policy](../adr/adr-package-initial-release-and-nx-versioning.md),
[accepted HTTP overlay policy](../adr/adr-nest-http-platform-scaffolding.md), and
[accepted first-party policy](../adr/adr-nest12-first-party-defaults-and-compatibility.md).
The repository agent/contributor instructions, current package README, published
library compatibility guide, Angular repository applicability notes and Meta's
proposed Nest development guide were also reviewed.

Relevant constraints and reconciliations:

- Meta 0004/0016 retain source implementation ownership within ecosystem rules.
  Meta HTTP 0008, amended 0009 and 0010 prioritize Node without activating a
  default, removing existing compatibility or adding Nest 11 feature support.
- The local HTTP amendment's reference to pending Meta approval is now satisfied
  by the accepted amendment on reviewed Meta main. This does not satisfy its
  independent implementation, production or default gates.
- The historical generation ADR's prerelease guidance and obsolete generator
  description do not override the current stable package implementation.
- The local first-party ADR's pending-contract-owner wording is superseded on
  that point by accepted Meta 0012. This audit authors no shared HTTP contract;
  generated OpenAPI is implementation evidence.
- Accepted Meta 0013's zero-major clarification governs over older local release
  wording. Meta 0017 keeps publication owner-authorized and independent of a
  successful audit/PR. This documentation work carries no release intent.
- Meta 0015 preserves correct cache inputs and isolated, distributable E2E
  scenarios. Temporary audit probes ran uncached; no production caching or CI
  topology was changed. Governance proposals and Angular implementation rules
  do not add requirements/dependencies to this Node-only scope.

No policy conflict requires an architecture exception. Technical support is
still gated: the host/version matrix, generated Node build/test/lint/Observe,
safe dependency removal, optional capabilities and production/default acceptance
are not established by this audit. The implementation contract requires review
before #609/#610 use it as an accepted local refinement.

## Reproduction and validation record

Use an isolated temporary workspace, retain exact package versions and keep
fixture snapshots outside project discovery (for example through `.nxignore`).
Do not repair a prerelease installation by editing installed version metadata.

1. Build the current plugin through `yarn nx run nx-nest:build`. Use the emitted
   package, schemas and generator collection with the exact released dependencies
   listed above in the isolated workspace. This audit used a copied build for
   source/API inspection; #611 must replace it with a clean tarball install.
2. Run `nx list @anarchitects/nest` and generator help through the workspace's
   package manager. For each ESM/CJS and Observe choice, dry-run and generate an
   application with an explicit directory, `--skipInstall` and `--no-interactive`.
   Compare the entry file, HTTP spec, manifest, TS/Nest config and test/lint scripts.
3. Repeat application generation and compare snapshots. Add a native `worker`
   sub-app and a REST resource; compare moved original bootstrap/test bytes and
   member output. Repeat the member and assert rejection without Tree mutation.
   Use the existing adapter's in-memory dry-run to assert no caller Tree writes.
4. For the API-only check, compile small ESM/CJS modules with the candidate
   framework set using TypeScript NodeNext. Exercise the public factory and
   testing-module overloads with explicit NodeAdapter, assert adapter identity,
   make a real GET on loopback port zero and close the apps. Do not substitute an
   implicit Express application or compilation alone for this check.

For example, these commands reproduce the native output inspection in that
isolated npm workspace; substitute `cjs` and `--observe=true` for the other cases:

```sh
npm exec -- nx g @anarchitects/nest:application api --directory=apps/api --type=esm --skipInstall --dry-run --no-interactive
npm exec -- nx g @anarchitects/nest:application api --directory=apps/api --type=esm --skipInstall --no-interactive
npm exec -- nx g @anarchitects/nest:sub-app worker --project=api --skipInstall --dry-run --no-interactive
npm exec -- nx g @anarchitects/nest:sub-app worker --project=api --skipInstall --no-interactive
npm exec -- nx g @anarchitects/nest:resource orders --project=api-worker --type=rest --crud --skipInstall --no-interactive
```

Before another Nx command, install any tooling added by member generation or use
the existing in-memory generator tests for output-only inspection. `skipInstall`
does not make an uninstalled generated workspace runnable.

Executed on 2026-11-15: repository Nx build (including a cache-bypassed task
invocation), four isolated output scenarios, application/sub-app CLI dry runs,
negative platform-schema check, and ESM/CJS compiled API/HTTP/testing/lifecycle
probes. Nx daemon/plugin isolation and cloud were disabled for local sandbox
execution, following the existing consumer environment pattern. Repository
build emitted existing unrelated Jest-config module warnings; audit checks passed.
The source repository's full test/lint suites were not rerun for this
documentation-only change, and its stale local schematic install is not a green
consumer baseline. No release, migration or default activation was performed.

## Independent application implementation (#609)

The explicit independent-application path now implements the reviewed candidate
contract: `platform: 'node'` is consumed by the wrapper, while omission retains
the original native path. Native 12.0.6 output is staged independently, the
bootstrap and HTTP spec receive bounded TypeScript edits, and final bytes are
compared before any caller Tree mutation. Conflicts reject instead of migrating
existing applications. The ordinary additive guard is unchanged. Runtime
common/core/testing/platform-node are pinned to 12.3.0; adapter validation does
not inherit the older adapters' Nest 11/12 peer allowance. Dependencies are
ordered deterministically so Yarn installation does not break repeat generation.

For this implementation preflight, all 24 Meta ADRs and all six local ADRs were
re-enumerated against Meta `3899558482b615aa46dd5004eae440d62cd2e222` and Plugins
`7daaef6ad9b293fbf373f296d0b19975e89d6a8c`. Their contents are unchanged from the
complete review above. The audit, contributor rules, package documentation and
published-library guide were reviewed for this scope. The same accepted
constraints and conflict reconciliations apply: explicit selection, native
schematic ownership, platform-neutral inference, preserved compatibility,
separate release/default authority, and no Angular runtime dependency. No new
architecture exception is needed. Sub-app selection remains separate work.

The focused clean-consumer scenario is
`nx-nest-e2e:e2e-ci--src/nest-scenarios/node-application.spec.ts`. It installs the
packed plugin and framework through Yarn without repository framework links,
checks the four exact runtime versions, tests generator defaults/dry-run/install
and repeat behavior, runs generated build/test/lint workflows, asserts the actual
Node adapter in the HTTP test, starts the application over HTTP, and exercises a
subsequently generated REST resource. CommonJS uses the already documented
package-manager-resolved Jest invocation with default Yarn hoisting; the native
local-Jest script limitation is not changed by this overlay. Native unit and HTTP
tests and lifecycle cleanup remain authoritative.

This is focused implementation evidence, not the full packed version matrix,
production/security conformance, Observe telemetry certification, optional
capability matrix or default activation. Those gates remain with #611–#615.

Validation on 2026-11-15 used Node 24.22.3, Nx 24.0.1 and TypeScript 6.0.3:
Nx build, all 561 unit tests (33 suites), lint/typecheck for the plugin and E2E
package, both clean installed Node consumer cases, and all 13 existing
published-library-peer regression cases passed. The application suite also
checks ESM/CJS × Observe, whole-transform idempotency, native byte parity outside
the overlay, rejection/atomicity, custom spec suffixes, spec-disabled generation,
formatting, skip-install and dry-run safety, and adapter-free libraries and
microservice resources. Final added application assertions passed separately.

Local execution disabled Nx daemon/plugin isolation/cloud for sandbox sockets;
SWC's native cache was redirected to a writable temporary directory after its
default user-cache write was denied. No repository cache/CI policy changed. The
workspace was installed immutably from its lockfile, resolving schematics 12.0.6;
no dependency manifest/lockfile or installed version metadata was rewritten to
manufacture compatibility. Existing unrelated lint/module warnings remain.

## Shared-owner sub-app implementation (#610)

Explicit `sub-app --platform=node` (including the `app` alias) now applies the
bounded bootstrap/HTTP-spec overlay only to the requested new member. Native
12.0.6 still owns member layout, conversion and templates. The existing owner's
source and tests retain their bytes through native relocation, including custom
adapters and Observe setup. Subsequent members without platform selection retain
native behavior. Libraries and their bounded Nest 11/12 peer contracts are
unchanged.

The preflight re-enumerated all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local ADRs at Plugins
`51cef57`. Unchanged records retain the complete review above; changed Meta
0008–0012 and new 0022, local amendments, this audit, the published-library guide
and contributor/package guidance were read for this implementation. Accepted
source-ownership and HTTP decisions require explicit opt-in, native templates,
platform-neutral inference and preservation of existing consumers. Meta 0022's
latest-stable-first and time-bounded previous-major maintenance rules do not
silently upgrade owners or withdraw the existing #585 compatibility evidence;
no end-of-maintenance date or release/default activation is asserted here.

The selected owner's installed common/core/testing and retained HTTP adapters
must resolve to the audited 12.3.0 runtime; CLI must resolve to stable v12 and
satisfy its owner declaration. The CLI has its own release sequence: the clean
consumer resolves 12.0.13, while the original API audit used 12.0.0. Runtime
versions are not inferred from the CLI version. Existing manifest declarations
are preserved and must admit the installed host; bounded library peer ranges
remain supported. A missing platform-node dependency is added at exactly 12.3.0.
Conflicts, stale or missing installed evidence and unsupported languages fail
without caller Tree changes, including with skip-install. Native generation and
subsequent Nx tooling updates are staged together so late failures also roll back.

Clean installed probes found native 12.0.6 sub-app compiler/start templates
hard-code `../../tsconfig.json` and `dist/apps/<name>` while the custom Rspack
container output differs. Consequently the Node path supports the native
`apps/<name>` layout; custom rootDir/path containers and path-qualified names
reject before mutation. The native path schema also rejects `rootDir=.`. This
bounded restriction avoids shipping broken compiler/start paths or extending the
reviewed source/dependency overlay into compiler-template rewrites. Omitted-platform
behavior is unchanged. Repeating a member name retains native rejection; the
transform itself is idempotent.

Focused installed coverage uses the packed plugin in clean ESM and CJS owners,
including an explicitly configured Fastify owner, CLI dry-run, normal and skipped
installation, retained source/test bytes, inferred owner build/start targets,
real HTTP responses, adapter identity in the generated HTTP test, REST resource
registration and native library builds. CJS retains the previously documented
package-manager Jest invocation and upstream floating-promise lint limitation.
Observe preservation is tested in memory across ESM/CJS; telemetry certification,
the complete packed version/capability matrix and default activation remain
#611–#615 work.

Validation on 2026-11-15 used Node 24.22.3, Nx 24.0.1 and TypeScript 6.0.3:
all 588 unit tests (35 suites), plugin build, plugin/E2E lint and typecheck,
both packed Node sub-app consumers, all 13 published-library peer regressions,
and the existing TypeScript/custom publication and member-build scenarios passed.
The repository lint tasks retain 16 existing warnings and no errors. Local runs
used the same daemon/isolation/cloud and temporary SWC-cache settings described
above. No dependency manifest, lockfile, release setting or platform default was
changed.
