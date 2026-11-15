# Three-adapter generation audit and implementation contract

Status: reviewed implementation contract for [#620](https://github.com/anarchitects/anarchitecture-plugins/issues/620),
under [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607).
Audited 2026-11-15 against Plugins `0388420` and Meta
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`.

**All three released adapters support the same baseline HTTP and Standard Schema
application. Explicit generation needs a small adapter-specific bootstrap and
test transformation.** This contract extends the
[Node audit and implementation record](nest-native-node-generation-audit.md);
the original #620 audit did not reopen #608–#610 or implement Express/Fastify
selection. #620 was reviewed and merged in [#623](https://github.com/anarchitects/anarchitecture-plugins/pull/623).
The #621 implementation below adds explicit Express alongside Node. Omission
remains native Nest generation. #509 adds independent Fastify applications and
#622 adds Fastify members below. Runtime rebaselining, defaults, production
certification and releases retain their separate gates.

## Evidence and version boundaries

The reproducible [audit runner](../../tools/testing/nest-adapters/audit.cjs) and
[typed HTTP probe](../../tools/testing/nest-adapters/probe.cts) use disposable npm
installations, without workspace links, overrides or lifecycle scripts. The
[evidence record](../audits/nest-three-adapter-generation-2026-11-15.json) records
versions, registry provenance and results. Runtime: Node 24.22.3 on macOS arm64;
orchestration: Nx 24.0.1; compiler: TypeScript 6.0.3 with NodeNext, strict mode and
decorator metadata. `skipLibCheck` skips dependency declaration checking; the
probe's typed public calls are checked. This is not a multi-OS/runtime or packed
plugin certification.

| Component                                                                | Existing Node baseline                                       | Current released candidate audited here                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| common, core, testing, platform-node, platform-express, platform-fastify | 12.3.0 each                                                  | 12.5.0 each, published 2026-11-12                                    |
| Native schematics                                                        | 12.0.6                                                       | 12.0.13, published 2026-11-06                                        |
| Native CLI installed for source inspection                               | 12.0.0                                                       | 12.0.13, published 2026-11-13                                        |
| Schematics' Angular Devkit core/schematics                               | 22.2.0                                                       | 22.2.6                                                               |
| Runtime probe peers                                                      | reflect-metadata 0.2.2, RxJS 7.8.2                           | Same                                                                 |
| HTTP probe client / typings                                              | supertest 7.1.4, @types/supertest 6.0.3, @types/node 24.10.1 | Same                                                                 |
| Swagger public API inspection                                            | Not newly certified                                          | 12.1.2, published 2026-11-13                                         |
| Observe registry / template inspection                                   | Native template requests ^0.3.0                              | Latest registry version 0.3.26; no new Observe runtime certification |

The twelve runtime cells (two framework versions × three adapters × ESM/CJS)
passed typed factory creation, loopback HTTP GET, testing-module creation,
Supertest GET, valid/invalid Standard Schema POST, response field removal and
shutdown. The probe uses one small Standard Schema implementation without a
schema-library dependency; it does not certify every Zod/Valibot/ArkType version,
schema edge case or security limit.

Eight native generation cells (two schematics versions × ESM/CJS × Observe
off/on) generated an independent app, converted it to a native owner with a
sub-app, and generated a REST resource. All preserved the relocated original
bootstrap and HTTP test byte-for-byte. Resource hashes match across Observe
choices and schematic versions within each module format. These are native
schematic observations, **not successful future Express/Fastify plugin commands**.

### Version policy for implementation

Keep the completed 12.3.0 Node boundary valid. The twelve API cells justify a
12.5.0 candidate, not an immediate dependency bump: the plugin still pins
schematics 12.0.6 and its Node transforms deliberately validate that version.
Latest stable framework support is the direction required by Meta ADR-0022;
implementation must explicitly rebaseline the schematic engine and all affected
transforms, then pass installed-consumer checks before advertising it.

For #621/#509, first land the shared adapter contract on the existing
schematics 12.0.6 / coherent runtime 12.3.0 baseline. Keep a separate, explicit
rebaseline change in the #611 certification work for schematics/CLI 12.0.13 and
runtime 12.5.0 (or a newer stable set re-audited at implementation time). Do not
freeze new production support permanently on 12.3.0. A new default runtime set
must be applied consistently to all three selections, with regression coverage
for existing 12.3.0 owners; never widen an exact guard to all `12.x` based on
these two samples. No installation or generation automatically upgrades an
existing owner. Retain #585's published-library compatibility guarantees.

## Native output and public API boundary

Both schematic releases still emit an implicit `NestFactory.create(Module)` and
implicit testing-module application. Their application schema has no `platform`
option. Native runtime ranges remain common/core/platform-express `^12.0.1`,
testing `^12.0.1`, CLI/schematics `^12.0.0`; these ranges are not exact resolved
runtime evidence. Explicit selection belongs to the bounded Plugins overlay.

| Selection | Public package           | Constructor    | Application type       | Test initialization after explicit construction                    |
| --------- | ------------------------ | -------------- | ---------------------- | ------------------------------------------------------------------ |
| node      | @nestjs/platform-node    | NodeAdapter    | NestNodeApplication    | await app.init()                                                   |
| express   | @nestjs/platform-express | ExpressAdapter | NestExpressApplication | await app.init()                                                   |
| fastify   | @nestjs/platform-fastify | FastifyAdapter | NestFastifyApplication | await app.init(); await app.getHttpAdapter().getInstance().ready() |

Each constructor is the second argument of `NestFactory.create<ApplicationType>`
and the first argument of `moduleFixture.createNestApplication<ApplicationType>`.
Existing factory options, including `instrument: ObserveInstrument`, move to the
third factory argument unchanged. Use the adapter package's public type exports;
replace the generated `INestApplication<App>` annotation and remove only imports
made unused by that replacement. Keep native Supertest assertions, hooks and
shutdown; the Fastify readiness call is the only extra baseline test lifecycle
step. Preserve the native listen expression and host policy.

The selected runtime package must be a direct application dependency. Common,
core, testing and all installed HTTP adapters used by one owner must form a
coherent admitted runtime set. Express selection is explicit construction even
though Nest currently defaults to Express. Node/Fastify selection retains the
native Express dependency and typings: removal is a separate migration and is
unsafe for mixed owners. Do not add a direct `express`, `fastify`, multipart,
Swagger or schema-library dependency just for basic selection; the adapter owns
its underlying server dependency. The current adapter manifests declare Express
5.3.0 and Fastify 5.12.8; see the evidence record for complete package dependencies
and peer metadata, including optional Fastify integrations.

One existing Node follow-up needs explicit ownership: #609 pins common/core,
testing and platform-node to 12.3.0 but retains native platform-express
`^12.0.1`. A fresh install can therefore resolve a newer Express adapter and then
fail #610's coherent-owner guard. Preserve the earlier tested Node slice, but
do not describe every new resolution of that range as an admitted mixed owner.
#621/#509 should pin the retained Express adapter to the chosen runtime set in
**new explicit application output**; #611 must apply and test the same fresh-app
correction for Node when consolidating the matrix. Existing manifests remain
unchanged and receive a diagnostic if their resolved set is incompatible.
Omitted-platform generation keeps native ranges. This is a recorded gap, not a
dependency change made by this audit.

Node 12.5.0 exposes `inject()` and `setLocal()` that are absent from the 12.3.0
Node application interface. Keep Supertest for shared generated tests; do not
backport current living documentation into the earlier baseline. Fastify has its
own `inject()` API in both audited versions, but selection need not replace the
test client.

ESM keeps native `.js` relative imports, top-level `await` and Vitest; CJS keeps
native imports and Jest. Observe is an application option; native sub-app schema
has no Observe switch and the new member does not inherit instrumentation just
because the owner has it. Preserve instrumentation in relocated existing apps.
Schematics 12.0.13 fixes the native CJS member's floating `bootstrap()` promise
with `void bootstrap()` and changes ESM test tooling from `vite-tsconfig-paths`
to Vite. These are upstream differences to reverify during rebaselining, not
adapter-specific templates to copy into Plugins.

## Selection, defaults and precedence contract

Extend the optional schema field to `platform: node | express | fastify` for
`application` and `sub-app`; `app` remains the alias of `sub-app`, not an alias
for an independent application. Keep the schema without a `platform` default or
prompt. Only `undefined` means omission. Reject empty strings, null, booleans,
unknown names and case variants before mutation, including programmatic calls.
Initial explicit support is TypeScript ESM/CJS; reject explicit selection with
JavaScript until its own native-output and installed-consumer evidence exists.

Use Nx's normal generator option resolution once. Highest precedence wins:

1. Explicit invocation options.
2. Generator defaults on Nx's invocation-context/default project.
3. Workspace generator defaults in `nx.json`.
4. Schema defaults, which intentionally contain no platform choice.
5. Native omitted-platform behavior if still absent.

This follows inspected Nx 24.0.1 `combineOptionsForGenerator` and
`getGeneratorDefaults`: within a scope, the fully qualified
`@anarchitects/nest:sub-app` key overrides the nested collection form. Nx
normalizes the `app` alias before combining defaults; document the canonical
`sub-app` key. Application defaults do not flow into sub-app defaults.

Crucially, Nx derives the default-project context from the invocation directory;
`--project=owner` selects the Nest owner but does not itself retarget Nx's
project-default lookup. Do not add a second owner-default merge inside the
generator. Programmatic generator calls receive already-resolved options; they
must not silently re-read Nx defaults. #611 must exercise the actual CLI from
workspace root and project directories, including an explicitly different
`--project`, rather than only calling generator functions.

| Inputs                                                  | Effective behavior                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| No platform anywhere                                    | Native generation; no explicit adapter transform                          |
| Workspace node; invocation-project express              | Explicit Express                                                          |
| Workspace node; invocation-project express; CLI fastify | Explicit Fastify                                                          |
| Platform default set; CLI flag omitted                  | Apply that deliberate default; omission is not an opt-out                 |
| Native Express owner; explicit Node/Fastify new member  | Preserve owner; construct selected adapter only in new member             |
| Node owner; no effective member platform                | Native implicit member; do not infer platform from bootstrap/dependencies |
| Invalid highest-precedence value                        | Reject, rather than fall back to a lower default                          |

No `auto`, `native`, `none` or inference-from-installed-dependency mode is added.
Users who configure a platform default must change/remove it or explicitly
select an alternative to change the resulting behavior. Activating a repository
Node default remains #615, separately reviewed after the three-adapter gates.

## Preservation, transactions and layout

Generalize the existing structured Node transform using adapter metadata for
package, constructor, application type and test readiness. Share the syntax
analysis and validation. Native Nest owns source templates, controllers,
resources, module wiring, builder configuration and framework behavior; Nx owns
registration, dependency installation and inferred orchestration targets.

Bound changes to the newly generated bootstrap/test and necessary manifest
entries. For a native owner conversion, permit native relocation/configuration
changes while preserving existing bootstrap/test bytes and all unrelated
dependency ranges. A custom existing owner bootstrap may be preserved unchanged;
it is not a target for rewriting. A customized destination bootstrap or HTTP test
that would need rewriting is rejected. Identical independent-app regeneration
remains a no-op; duplicate native members remain an upstream rejection. A
different requested platform at an existing destination is not a migration.

Apply the transactional member staging introduced in #610 to every explicit
selection. Complete owner/runtime, path, schema, AST and Nx registration checks
before committing Tree edits. Reject unsupported schematic versions, ambiguous
bindings, extra bootstrap calls, conflicting files, unresolved runtime versions,
mixed installed framework versions, prereleases, incompatible ranges or an
adapter declared only in devDependencies. `skipInstall` skips installation only;
it cannot bypass compatibility checks. External installation happens after a
successful Tree commit and is not covered by filesystem rollback.

For a member, retain every existing declaration and validate its actual resolved
version in the selected owner's resolution context. A compatible declared
adapter is reused; an absent selected adapter is added at the owner's admitted
exact runtime version. Preserve other adapters because other members may need
them. Adding Express to a Node/Fastify owner follows the same rule. Uninstalled
or incompatible owners receive an actionable install/upgrade diagnostic, never
a silent version rewrite. Bounded mixed Nest 11/12 library peers remain untouched;
they are not an application runtime-set conflict by themselves.

The initial explicit member layout remains **`apps/<single-segment-name>` inside
the selected Nest owner**, including an owner nested in an Nx workspace. This
is not a restriction that all Nx owners live at workspace root. In both audited
schematic releases the member tsconfig still extends `../../tsconfig.json`, uses
`rootDir: ../..`, and writes to `../../dist/apps/<name>`. The #610 installed
consumer evidence found deeper paths broken and custom containers inconsistent
with native start output. The new source audit does not establish that CLI
12.0.13 repairs those cases. Keep the guard for all explicit adapters until a
separate fix/rebaseline passes real build/start/test from each proposed layout.
Omitted selection retains the existing native path behavior.

## Shared schema APIs and optional capability ownership

The common package's `@Body({ schema })`, `StandardSchemaValidationPipe`,
`@SerializeOptions({ schema })` and `StandardSchemaSerializerInterceptor` worked
unchanged across all twelve runtime cells. Controllers/resources do not need
Fastify-specific validation decorators, DTO forks or replacement serializers.
Canonical public contracts remain owned by the Contracts repository. #612 owns
the broader security/HTTP matrix, not this small positive/negative smoke probe.

Swagger 12.1.2 exposes a shared `standardSchemaConverter(schema, { schemaType })`
document option and supports Standard JSON Schema input/output conversion.
Standard Schema validation alone does not imply that every schema library can
produce OpenAPI. Configure/test the converter or the library's Standard JSON
Schema support in the shared contract. No Fastify-specific validation generator
is required. This is an inspection of the installed public declarations and
converter source; OpenAPI route/schema and UI runtime tests remain follow-ups.

| Capability                                                                                           | Evidence / boundary                                                                                                                          | Delivery owner                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Baseline adapter package, explicit bootstrap and HTTP test                                           | Required for selection                                                                                                                       | #621 Express; #509 Fastify applications; #622 Fastify members          |
| Shared validation, serialization, authorization and HTTP/security behavior                           | Common APIs; extend runtime coverage without forks                                                                                           | #612                                                                   |
| Common OpenAPI schemas and schema conversion                                                         | Shared Swagger API                                                                                                                           | #612, with documentation in #614                                       |
| Fastify Swagger hosting extras                                                                       | Audit native Swagger setup before adding static/plugin wiring                                                                                | #508 / #510                                                            |
| Fastify multipart                                                                                    | Both installed adapter versions export first-party multipart interceptors/module; optional @fastify/multipart peer is still required for use | #508 / #511                                                            |
| Fastify static assets and views                                                                      | Optional platform integrations; absent from baseline selection                                                                               | #508 / #512                                                            |
| Fastify raw-body, hooks and composition                                                              | Use supported native APIs first; prove any extra wiring                                                                                      | #508 / #513 and #514                                                   |
| Optional capabilities across all adapters: sessions, uploads, SSE, websockets, streaming, views, SSR | Explicit support/limitation matrix, not blanket parity                                                                                       | #613; Bricks 3-Tier #506 and Community #33 own presentation/SSR parity |
| Optional integration documentation                                                                   | Link the common guide; avoid duplicated adapter setup                                                                                        | #508 / #515 and #614                                                   |

The multipart audit specifically rules out assuming that Nest needs a new
third-party interceptor layer. Its Fastify adapter already detects native
multipart interceptors and can register the optional plugin; #511 must verify
version-specific registration, limits and streaming behavior before generating
anything. Baseline Fastify creation and the HTTP probe passed without installing
the optional multipart/static/view peers. #558 continues to own integration
migration. Optional #508 features do not block basic adapter selection.

## Implementation handoffs and remaining certification

| Work                                  | Required handoff / proof                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| #621, after this contract is reviewed | Shared enum/metadata/transform boundary; explicit Express application and sub-app/app; preserve current Node behavior; no implicit-default shortcut |
| #509, after this contract is reviewed | Explicit Fastify independent application; third-argument Observe preservation; ready-before-Supertest; coordinate shared files with #621            |
| #622, after #509                      | Fastify sub-app/app; transactional mixed-owner handling and retained dependencies; same layout constraints as Node/Express                          |
| #611, after all three selections      | Packed, genuinely installed consumers for every adapter and form; version rebaseline; no repository hardlinks as compatibility evidence             |
| #612 and #613                         | Shared security/schema/HTTP tests and capability matrix; can proceed in parallel once their generation prerequisites exist                          |
| #614 then #615                        | Consolidated install/default/precedence/limits guide and readiness evidence, then separate default-activation decision                              |

The packed matrix must include each adapter × independent/member × ESM/CJS;
Observe on/off for independent apps; an Observe owner retained during member
generation; root/nested owners; all existing-owner/new-member adapter pairs;
application no-op regeneration and member rejection; defaults/CLI alias behavior;
custom-source conflicts with unchanged Tree bytes; missing/incompatible runtime
dependencies; admitted legacy owners and the newly rebaselined set. Run build,
unit tests, generated HTTP tests, lint, typecheck, start/HTTP/shutdown and verify
Project Crystal inference. Include #585 library regressions, current native
omission and explicit Node regressions. Preserve consumer customization and
existing compiler/bundler choices.

This audit supplies public-API feasibility and native-source evidence. It does
not replace those installed generated-consumer, optional feature, transport,
OpenAPI, Observe or production readiness gates.

## Architecture review record

Before writing the probes, enumerated and read all 25 Meta ADR files at the
revision above and all six repository ADRs; no additional local ADR locations
were found. The evidence JSON records every path. Relevant engineering inputs:
the Node audit including #609/#610 appendices, published-library compatibility
guide, portable-core README, CONTRIBUTING and Meta's proposed NestJS
AI-assisted-development guide. The latter is guidance, not an accepted override.

Applied accepted Meta HTTP independence (0008), Node preference with activation
gates (0009), Nest-first policy (0010), authorization/schema contracts (0011),
canonical contract ownership (0012), release/dependency/Nx policy (0013–0015),
authority/upstream/public reuse (0016–0021), and lifecycle (0022). Preserve the
portable MIT core and native source ownership. All proposed records, including
governance alternatives and the local documentation/generation proposals, retain
their status. Angular decisions do not introduce Angular runtime dependencies
into Nest applications; the Devkit remains generation tooling.

Explicit conflicts resolved by status and scope:

- Local HTTP scaffolding's old pending-Meta references and unsupported-Node
  wording describe an earlier state. Meta's accepted decisions and the completed
  #609/#610 slice now apply; they still do not certify production/default activation.
- Local first-party scaffolding's pending canonical-owner wording is superseded
  by accepted Meta 0012's Contracts ownership; do not fork public DTO contracts.
- Local release wording predating the Meta 0013 zero-major amendment does not
  authorize a 1.0 release. This audit requests no publication or version bump.
- Latest-stable lifecycle policy requires a verified rebaseline, not automatic
  upgrades, guessed previous-major end dates or abandonment of #585 guarantees.

## Reproducing the audit

Create two fresh disposable directories outside the checkout. Install exact
dependencies from the evidence record's `fixtures` objects with npm
`--ignore-scripts --no-audit --no-fund`. Keep the resulting package-lock files
with local logs; transitive resolution may change on a later rerun. The recorded
lockfile hashes identify this run, not a claim of indefinitely reproducible
registry resolution. Run from the repository, substituting absolute paths:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true corepack yarn nx exec --projects=nx-nest -- node /absolute/checkout/tools/testing/nest-adapters/audit.cjs /absolute/disposable/baseline
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true corepack yarn nx exec --projects=nx-nest -- node /absolute/checkout/tools/testing/nest-adapters/audit.cjs /absolute/disposable/current
corepack yarn nx run-many -t build,lint,test,typecheck -p nx-nest
```

The audit runner previews generation in memory, materializes native directory
deletions, preserves the original owner files for comparison, and writes native
output and results only into the supplied fixture. It refuses an existing
generated destination. It compiles the same original probe as `.cts` and `.mts`,
then tests the three adapters in separate application lifecycles. It needs local
loopback sockets. It neither installs dependencies nor invokes package scripts.
The registry record and installed package declarations are the versioned API
evidence; living [Nest testing](https://docs.nestjs.com/fundamentals/testing),
[Fastify](https://docs.nestjs.com/http/performance) and
[upload](https://docs.nestjs.com/techniques/file-upload) guides are supplementary
and must be checked against the pinned release.

## #621 implementation record: explicit Express

Before implementation, re-enumerated and read every ADR: all 25 Meta records at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local records at Plugins
`b9a67d0ea6b67d0cf64c7c1a94bbede04052590f`. The full inventory is recorded in the
linked audit evidence. Re-read this contract, the Node implementation audit,
published-library compatibility guide, package README and repository engineering
instructions. The decisions, proposal statuses and conflicts recorded above apply
unchanged. Native Nest owns generated source; Nx supplies orchestration and a
bounded adapter transform. Meta's lifecycle policy requires verification before
changing the runtime baseline; #611 retains the 12.5.0 rebaseline decision.

`application` and `sub-app` (alias `app`) now accept `platform: node | express`,
without a schema default. Shared adapter metadata selects the package, constructor
and application type. The bounded AST transform changes only fresh native bootstrap
and HTTP-test output. Express is always explicitly constructed, never represented
by an omitted adapter. Native options, including independent-application Observe,
remain owned by the pinned schematics 12.0.6. New Express packages pin
common/core/testing/platform-express to 12.3.0 and retain Express typings.

Existing member owners must resolve the audited 12.3.0 framework set and stable
v12 CLI. Compatible declarations and existing Node/Express/Fastify/custom source
are preserved. A missing selected adapter is added at 12.3.0. Owner validation,
native conversion, adapter transformation and Nx tooling are staged transactionally;
invalid owners, duplicate members and late tooling failures leave the caller tree
unchanged. Root and nested owners use the same native `apps/<name>` constraint.
The original application's Observe setup is preserved, not inherited by a member.

The packed consumer scenarios are now shared across Node and Express:
`http-application.spec.ts` and `http-sub-app.spec.ts`. They cover both ESM and
CommonJS, actual adapter identity and HTTP, native conversion, mixed Node/Fastify
owners, dependency retention, dry-run, install/skipInstall, repeated generation,
resource registration and inferred build/start. Express CLI selection overrides a
configured Node or Fastify default before schema validation, including through
the canonical `sub-app` defaults when invoking the `app` alias. Unit coverage also preserves
native output/Observe, exercises root owners and verifies rollback and compatibility.

The existing native CommonJS member floating-promise lint limitation remains;
no compiler or lint template rewrite is introduced. Node's retained Express range
gap above remains assigned to #611. These checks do not certify production HTTP
security, optional integrations, the full host matrix or a changed default.

Validation on 2026-11-15 used Node 24.22.3 (macOS arm64), Nx 24.0.1,
TypeScript 6.0.3 and Yarn 4.17.0. The plugin resolves schematics 12.0.6;
the installed member owner resolves CLI/schematics 12.0.13. Express runtime
common/core/testing/platform-express resolve 12.3.0, with Node/Fastify 12.3.0
in the corresponding mixed-owner fixtures. These are clean consumer installations,
not repository framework links. Registry resolution is not a frozen lockfile matrix.

Passed: plugin build, lint and typecheck; all **619 unit tests in 35 suites**;
e2e-package lint/typecheck; all **eight packed Node/Express ESM/CJS application
and member cases**; and all **13 published-library peer compatibility checks**.
Plugin lint reports 16 existing warnings and no errors. The packed checks exercise
build/start, actual HTTP, native tests and resources. They retain the documented
CommonJS Jest invocation workaround and expected native-member lint failure;
Observe generation/preservation is unit-covered, while broader Observe runtime
certification remains in #611.

```sh
corepack yarn nx run nx-nest:test --runInBand
corepack yarn nx run-many -t lint,typecheck -p nx-nest,nx-nest-e2e
corepack yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/http-application.spec.ts src/nest-scenarios/http-sub-app.spec.ts src/nest-scenarios/published-library-peers.spec.ts
```

## #509 implementation record: independent Fastify applications

Before code changes, re-enumerated and read all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local ADRs at Plugins
`a7872993c81827d1e6f9ab2b3fad72de3628af57`. The inventory is unchanged from the
linked audit evidence. Revisited this shared contract, the Node implementation
record, published-library compatibility guide, package/contributor instructions
and proposed Meta Nest development guide. The accepted decisions and explicit
historical/local conflicts recorded above apply unchanged. Angular runtime policy
does not introduce Angular into generated Nest applications. This implements the
approved baseline before the separate #611 version rebaseline; no owner upgrade,
release or default activation follows from this change.

The independent `application` schema now accepts all three selections without a
default. Fastify metadata reuses the bounded bootstrap/type/import transformation
and adds exactly one awaited `app.getHttpAdapter().getInstance().ready()` after
`await app.init()` in the generated HTTP test. The AST guard verifies the assigned
application, unambiguous initialization and statement ordering; malformed,
duplicate, misplaced or unawaited lifecycle calls fail. Reapplying a complete
transform is byte-identical; an incomplete explicit test is not silently repaired.
Native assertions, shutdown, Observe factory options, listen policy, compiler and
test-runner choices remain native-owned.

New Fastify applications pin common/core/testing/platform-fastify and retained
platform-express to 12.3.0. They retain Express typings without adding a direct
server, schema library or optional Fastify integration dependency. Generic
controllers/resources remain shared. Libraries and published peer compatibility
remain unchanged. Node's previously recorded retained-Express range gap stays
with #611.

At completion of #509, Fastify members were still rejected by the public
sub-app/app schema, programmatic member generator and schematic boundary before
caller mutation. The shared metadata/readiness logic is reused by #622 below
after member-specific validation. #509 enabled independent applications only.
Existing applications are never
converted through platform selection; conflicting source or a different adapter
at the same destination still rejects atomically.

The shared packed application scenario covers Node/Express ESM/CJS and Fastify
ESM/CJS with Observe off/on. Fastify command options override Node/Express defaults;
separate cases exercise a deliberate Fastify default with the CLI flag omitted.
It verifies actual adapter identity, HTTP startup, native HTTP tests, resource
registration, dry-run/install/skip-install, repeat generation and exact runtime
resolution from the clean consumer. Optional integrations under #508 are not
prerequisites. Broader transport/security/schema conformance, telemetry export,
full host-version certification and default activation retain their own gates.

Validation on 2026-11-15 used Node 24.22.3 (macOS arm64), Nx 24.0.1,
TypeScript 6.0.3 and Yarn 4.17.0. The plugin uses schematics 12.0.6;
clean Fastify consumers resolved CLI/schematics 12.0.13, Observe 0.3.26,
common/core/testing/platform-fastify/platform-express 12.3.0 and the adapter-owned
Fastify server 5.12.7. These are consumer-local installations, not repository
framework links. Registry resolution is not a frozen lockfile matrix.

Passed: plugin build, all **652 unit tests in 35 suites**, plugin/e2e lint and
typecheck, **eight packed application cases** (four Node/Express and four Fastify),
**four retained Node/Express member cases**, and **13 published-library peer
compatibility checks**. Plugin lint reports 16 existing warnings and no errors.
The final lifecycle guard also passed 50 focused adapter tests. Packed Fastify
checks compile and execute native tests, start the built application and exercise
HTTP/resources with Observe off/on. They retain the documented CommonJS Jest
invocation workaround; member regressions retain their expected native lint
limitation. Observe exporter delivery and broader telemetry certification are
outside these checks.

```sh
corepack yarn nx run nx-nest:test --runInBand
corepack yarn nx run-many -t lint,typecheck -p nx-nest,nx-nest-e2e
corepack yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/http-application.spec.ts
corepack yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/http-sub-app.spec.ts src/nest-scenarios/published-library-peers.spec.ts
```

## #622 implementation record: Fastify members and mixed owners

Before implementation, re-enumerated and read all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all six local ADRs at Plugins
`d085b51883ff3668c8aa74d8ef9ea59d620cc372`, including proposed and historical
records. Revisited this contract, the Node audit, published-library compatibility
guide, package/contributor instructions and proposed Meta Nest development guide.
The accepted constraints and historical/local conflicts recorded above apply
unchanged: native schematic ownership, explicit selection, portable MIT core,
platform-neutral contracts/inference, preserved library guarantees and separate
release/default authority. Angular runtime rules do not add Angular dependencies.
Meta 0012 supplies canonical Contracts ownership despite older local wording;
Meta 0013 supplies the zero-major release rule. No architecture exception,
publication, owner upgrade or default activation is introduced.

`sub-app` and its `app` alias now accept Fastify through the same shared metadata,
owner validation, staged native conversion and bootstrap/HTTP-test transform as
the other adapters. Only the requested new member selects Fastify; its HTTP test
awaits readiness. Existing owner and sibling source/tests, including Observe and
custom adapters, are preserved. Native library/resource generation and Nx target
ownership remain unchanged. The native `apps/<single-segment-name>` constraint
applies within root or nested owners; unsupported containers and JavaScript
selection reject before mutation.

Owners must resolve the already audited coherent 12.3.0 framework/adapter set and
stable v12 CLI. Existing compatible declarations remain unchanged. A missing
Fastify adapter is added once at 12.3.0; later members reuse it. Dev-only selected
adapters, stale/missing installations, incompatible declarations and malformed
evidence fail without changing the caller Tree. The same transaction includes
post-generation Nx tooling, so late failures also roll back. Duplicate members
retain native rejection, while the transform itself is idempotent. Omission and
Nx's canonical `sub-app` default/explicit-option precedence are unchanged.

Coverage extends the shared member scenarios with Fastify under Express, Node
and a custom Express-derived adapter, in both ESM and CommonJS. These clean
packed consumers preserve and execute the original Observe application, verify
the new member's actual Fastify adapter and HTTP readiness, exercise owner/member
build/start, resource registration, dependency reuse, dry-run/skip-install and
duplicate rejection. The custom-owner cases resolve a Fastify `sub-app` default
through the `app` alias; the other cases explicitly override Node/Express defaults.
In-memory cases also cover root owners, custom test suffixes, native omission,
idempotent transforms, invalid layouts and late-failure rollback. The full host
matrix/version rebaseline remains #611; optional Fastify features remain #508.

Validation on 2026-11-15 used Node 24.22.3 (macOS arm64), Nx 24.0.1,
TypeScript 6.0.3 and Yarn 4.17.0. The plugin still resolves schematics 12.0.6;
clean Fastify member owners resolved common/core/testing/platform-fastify and
retained platform-express 12.3.0, CLI/schematics 12.0.13 and Observe 0.3.26.
Node owners additionally resolve platform-node 12.3.0. Runtime versions are
asserted from consumer-local installations. Registry resolution is not a frozen
lockfile matrix; the separate published-library fixtures retain their documented
versions and linked/clean installation boundaries.

Passed: plugin build, **666 unit tests in 35 suites**, plugin/e2e lint and
typecheck, **10 packed member cases**, **eight packed application cases**,
**13 published-library peer checks**, and **two published-library build/ownership
cases**. The focused member/owner/schematic suites passed 68 tests before
the full suite. Lint retains 16 existing warnings and no errors. The generated
CommonJS checks retain the documented Yarn/Jest invocation workaround and
expected native-member floating-promise lint failure. These results verify basic
HTTP, resource registration and preservation/execution of Observe owners, not
exporter delivery, arbitrary custom-adapter semantics or production conformance.

```sh
corepack yarn nx run nx-nest:test --runInBand
corepack yarn nx run-many -t lint,typecheck -p nx-nest,nx-nest-e2e
corepack yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/http-sub-app.spec.ts
corepack yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/http-application.spec.ts src/nest-scenarios/published-library-peers.spec.ts src/nest-scenarios/published-tsc-build.spec.ts src/nest-scenarios/published-custom-build.spec.ts
```
