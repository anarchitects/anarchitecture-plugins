# Nest Nx workspace integration: capabilities and acceptance

Date: 2026-11-20. Status: proposed delivery contract; expanded acceptance is pending.

- [Proposed architecture decision](../adr/adr-nest-nx-workspace-integration.md)
- Delivery epic: [Epic #646](https://github.com/anarchitects/anarchitecture-plugins/issues/646)
- Capability owner / technical maintainer: Johan; no implementation assignees or dates are allocated here.
- Document executor: Codex at the maintainer's request. Review and acceptance are not claimed.

## Review baseline and evidence limits

The baseline is published `@anarchitects/nest@0.1.1`, inspected in an installed
consumer and against Plugins main at
`31a5e31bdf00c4a408db5b59bf3fc9391a0ef165`. Meta main was checked at
`dd0bda9ca3692a45366fb3156ca7b57d5fdf5f0b`. This documentation change does not
include concurrent uncommitted TypeORM work or claim its results.

Source inspection establishes implementation shape, not fresh test execution.
Prior release records retain their own exact tested lanes. The new scenarios
below are **pending**, including those which reuse existing fixture mechanisms.
No runtime implementation, dependency change, new test run or support expansion
is delivered by this document.

### Source evidence

All repository paths in this table refer to the immutable Plugins revision above.

| ID  | Inspected source                                                                                                                  | Observation                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| E01 | `packages/nest/src/plugins/plugin.ts`; `src/utils/build-target.ts`, `start-target.ts`, `read-build-outputs.ts` under that package | Native config discovery, build/start inference, effective outputs/config inputs and conservative native-owner inputs exist                 |
| E02 | `packages/nest/src/generators/application/generator.ts`; `packages/nest/schemas/application.json`                                 | Official schematic invocation, workspace registration and project metadata; no application linter/formatter/test-runner policy selection   |
| E03 | `packages/nest/src/utils/setup-vitest.ts`, `setup-lint.ts`; package README testing section                                        | Native-member integration adds tooling that independent application generation does not apply equivalently                                 |
| E04 | `packages/nest/src/utils/library-typescript-linking.ts`, `generate-nx-nest-library.ts`; package README consumption recipe         | Linking-model-aware source-only libraries; manual application bundler/test setup is documented; other library modes are not thereby proven |
| E05 | `packages/nest/src/utils/register-package-workspace.ts`, `dependency-install.ts`, `validate-dependencies.ts`                      | Workspace registration, deferred installs and host compatibility mechanisms exist                                                          |
| E06 | `packages/nest/package.json`, `generators.json`, `src/nx-api-boundary.spec.ts`                                                    | Public exports/schemas and Nx API boundary checks exist; no package migration collection; explicit Nx/devkit peers                         |
| E07 | `packages/nest/src/generation-adapter/`; generator and inference specs                                                            | Staged transforms, conflict handling and deterministic-inference checks exist; not proof of every new scenario                             |
| E08 | Fresh 0.1.1 application output and resolved Nx consumer targets reviewed on 2026-11-20                                            | Local Prettier/Oxlint/TS/Vitest defaults; package-script build/test/lint; separate inferred compile/serve retain richer metadata           |

The consumer observation in E08 motivated this audit but defines no generic
directory, domain, database, licensing or deployment requirement. It is not
evidence that all native defaults are incorrect. Project-local config is valid
when its ownership and inheritance are intentional.

### Applicable decisions and unresolved questions

Read root AGENTS and CONTRIBUTING before implementation. The relevant design
sources include the accepted local first-party scaffolding and HTTP-overlay ADRs,
the historical generation proposal (not governing), and the package-versioning
and public-documentation decisions with their recorded statuses. Meta ADRs
0008 HTTP independence, 0009 native defaults, 0010 Nest-first, 0013 versioning,
0014 dependency maintenance, 0015 Nx caching, 0016 ownership, 0017 release authority,
0018 upstream-first, 0022 framework lifecycle and 0024 public documentation apply
within their scopes. Meta ownership records identify Johan as Nx Plugins capability
owner and technical maintainer; ecosystem policy authority remains separate.

This is a documentation/design review, not a substitute for the mandatory complete
current local/Meta ADR and engineering-guide preflight before implementation.
Re-enumerate and read all required decisions when implementation scope/revisions
change. Do not apply Blueprint's standalone exception to generic plugin consumers.

Decisions still needing review: initial supported tool-choice set and fallbacks;
target collision/migration strategy; admitted builder/library combinations;
package-manager/OS fixture lanes; public dependency distribution policy; handling
custom dynamic configs. The proposed ADR establishes behavior requirements without
inventing shipped CLI options or preselecting these mechanisms.

## Capability matrix

Baseline labels: **Present** means inspected mechanisms exist; **Partial** means
coverage/behavior is uneven; **Gap** means the inspected public surface lacks the
proposed integration; **Audit** means evidence is insufficient for a conclusion.
None of these labels means the new acceptance scenarios have passed.

| ID  | Capability / baseline                                                                  | Required outcome                                                                                                                                                         | Verification / workstream |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| C01 | Workspace/project discovery — Present (E01/E05)                                        | Preserve explicit roots/names, scope/exclusions and metadata across root, nested, mixed and owner/member layouts                                                         | S01–S04, S12; W2          |
| C02 | Policy resolution — Partial (E02/E04)                                                  | Document explicit-option/default/workspace/fallback resolution; preserve existing custom configs; diagnose ambiguity before mutation                                     | S01–S04, S11; W1/W2       |
| C03 | Formatting/editor/ignore integration — Gap (E02/E08)                                   | Honor selected formatter and shared config; local exceptions deliberate; check/write semantics separate; no accidental Prettier shadowing or duplicate tool installation | S02/S03/S10/S11; W3       |
| C04 | Linter integration — Gap for independent apps (E02/E03)                                | Reuse supported workspace linter and Nx integration; accurate source/test/tooling scope and optional boundary rules                                                      | S02/S03/S07/S10; W3       |
| C05 | TypeScript scopes/linking/sync — Partial (E04)                                         | Respect admitted references/aliases/independent models; keep Nest settings and test globals in correct scopes; use existing sync authority                               | S02/S05/S06/S10; W4       |
| C06 | Tests/coverage/typecheck — Partial (E03/E08)                                           | Supported unit/HTTP test transforms, production/test/tooling typechecks, project-specific report outputs; runner compatibility explicit                                  | S05/S07/S08; W3/W4        |
| C07 | Task naming/ownership — Partial (E01/E08)                                              | Resolved ordinary commands preserve declared task semantics despite scripts, target defaults and competing inference; unsupported conflicts diagnosed                    | S04/S07/S11; W2           |
| C08 | Cache/affected/parallel behavior — Partial (E01)                                       | Complete inputs/outputs; clean restoration; correct affected closure; isolated reports/ports; non-cacheable external mutations                                           | S08–S10/S12; W5           |
| C09 | Dependency ownership and linking — Partial (E05)                                       | Correct runtime/tooling/peer placement under admitted installation layouts; no accidental parent/global dependency resolution                                            | S01/S05/S06/S13; W4       |
| C10 | Library consumption and boundaries — Partial (E04)                                     | Declare supported source/buildable/publishable modes; prove transitive runtime consumption; preserve existing external build/release owners and workspace tags/rules     | S05/S06/S10; W4           |
| C11 | Production artifact contract — Audit (E01/E04)                                         | Entry/module format, runtime dependencies, assets and packaging proven in clean runtime; custom builders supported explicitly or classified for manual review            | S06/S08/S11; W5           |
| C12 | Safe generation/adoption — Present mechanisms (E05/E07)                                | Dry-run/rejection zero mutation; setup reruns idempotent; atomic planned edits and deferred installs; existing source preserved during adoption                          | S01/S04/S11; W2/W6        |
| C13 | Upgrade/migration lifecycle — Gap for new integration policy (E06)                     | Versioned migration path and rollback for plugin-owned changes; preserve customization and delegate legacy conversion to #558                                            | S11/S13; W6               |
| C14 | Public UX and documentation — Partial (E02/E06/E08)                                    | Accurate schemas/Nx Console options, diagnostics, workspace commands and support boundaries; no accidental deployment/telemetry commitment in generated guides           | S01/S03/S13; W7           |
| C15 | Portable plugin/runtime/distribution — Present mechanisms, further Audit (E01/E06/E07) | Public APIs, deterministic fast inference, packed exports/licenses/schemas, reviewed dependency strategy and truthful compatibility matrix                               | S12/S13; W7/W8            |
| C16 | Cross-plugin composition — Audit                                                       | Coexist with Angular, JS, test/lint and optional persistence plugins without conflicting target/config/dependency ownership                                              | S02/S07/S14; W4/W8        |

## Scenario acceptance matrix

Every row is **pending**. Capture before/after files and resolved projects/tasks,
exact commands, exit codes and artifact assertions. For negative cases specify
the expected diagnostic and prove absence of side effects. A command merely
appearing in a task graph does not pass execution acceptance.

| ID  | Fixture / action                                                                                                        | Exact expected result                                                                                                                                                   | Negative / preservation assertion                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Empty Nx workspace; generate an app using explicitly selected supported policy                                          | One correctly named project at requested root; workspace membership established once; selected tasks execute; effective policy recorded                                 | Non-interactive ambiguous/unsupported choice fails before file/install changes; dry-run leaves zero changed files                                              |
| S02 | Existing Angular/JS workspace with shared lint/format/TS/test configs; add Nest                                         | Existing policy reused through supported composition; Nest requirements local; existing projects still build/test; correct shared config dependency                     | Existing project source/config and unrelated plugin options unchanged; no second formatter/linter or global Nest compiler settings                             |
| S03 | Add a second independent app with intentional local overrides                                                           | Shared policy not duplicated; overrides preserved; both apps use their own names/roots and report paths                                                                 | No implicit policy replacement or overwriting of first app; local formatter config does not accidentally mask selected shared policy                           |
| S04 | Adopt standalone Nest and owner/member workspaces; include script/explicit/inferred target conflicts                    | Deterministic ownership report; supported adoption preserves source bytes and identities; resolved commands have declared cache/continuous/output behavior              | Custom/ambiguous conflict gets actionable manual-review result before mutation; init never converts source                                                     |
| S05 | App consumes explicitly declared source library A, which consumes library B; references and legacy-alias fixtures       | Graph contains app → A → B; build/typecheck/unit/HTTP tests and runtime pass using the admitted model; existing sync updates correct references                         | Missing declaration/bad export fails clearly; no reliance on root hoisting or global packages; no silent conversion of linking model                           |
| S06 | Consume existing built/publishable library and package app for clean runtime                                            | Existing library builder, exports and release config unchanged; declared entrypoint runs with only delivered artifacts and production dependencies; assets present      | Missing asset/dependency detected; source-only package is not falsely claimed runnable as untransformed external JS                                            |
| S07 | Unit/HTTP tests, lint, typecheck and format check/write across src/test/tools/config                                    | Every declared scope is checked; Nest injection/metadata path exercised; reports isolated; ordinary Nx target names resolve to intended owner                           | Controlled lint/type/test failure produces nonzero result; formatter check does not write; writes/fixes are not falsely replayed from cache                    |
| S08 | Build/test/check miss then hit; delete outputs and restore in clean checkout                                            | Eligible tasks replay; required outputs byte-match prior result; restored production artifact runs; report outputs restored                                             | Undeclared/missing outputs fail the check; mutating database/deploy/publish tasks remain uncached                                                              |
| S09 | Change source, transitive dependency, shared config, compiler/builder version and declared environment input separately | Each relevant change invalidates/selects expected consumer tasks; unchanged repeat reuses eligible results                                                              | Unrelated project change does not select unrelated work unless a documented conservative owner scope requires it; missing base fails safely                    |
| S10 | Tags and dependency constraints, source/test/tooling scopes and concurrent tasks                                        | Valid architecture passes; prohibited dependency fails via selected workspace mechanism; independent tasks run without report/output/port collisions                    | Plugin preserves tag taxonomy and exceptions; no invented business layers; tests/tooling cannot evade their declared checks                                    |
| S11 | Customized configs, malformed files, occupied destinations, install failure and migration rerun/rollback                | Supported transforms preserve custom content; repeat setup has zero diff; unsupported state has exact file/option diagnosis; install failure documented and recoverable | Dry-run/rejected preflight has no Tree/filesystem/lockfile/install mutation; migration rollback restores fixture; no partial failed transform                  |
| S12 | Root/nested/owner-member layouts, include/exclude scopes, symlink/path cases; cold/warm graph load                      | Stable project/edge/task result with no inference subprocesses or writes; measured graph cost stays within a reviewed budget                                            | Excluded projects stay excluded; unrelated directories not scanned as projects; unsafe paths rejected; Windows cases required if claimed                       |
| S13 | Install packed plugin and upgrade previous supported configuration in clean supported lanes                             | Public exports, schemas, migration metadata and license files resolve; nx add/list/help and representative generation work; exact versions/OS/manager recorded          | Missing peers and unsupported framework/module/layout combinations fail honestly; no unbuilt sibling checkout dependency or implicit new support claim         |
| S14 | Nest plus Angular/JS/test/lint and optional TypeORM integration                                                         | Each plugin retains target/config/dependency ownership; Nest builds/tests and supported persistence commands execute through resolved inferred targets                  | Separate plugin defects stay separately reported; no direct CLI bypass counted as inferred-target success; no database/tool dependency added to every Nest app |

S07 includes a nontrivial dependency-injection path; a trivial smoke test alone
does not establish transform compatibility. S08–S09 must distinguish local cache
proof from any separately authorized remote-cache evidence. S14's database work
uses disposable resources only when that integration is explicitly in scope.

## Compatibility dimensions and evidence record

Select a bounded, risk-based matrix before implementation and map every advertised
combination to evidence. Do not require an unbounded Cartesian product or use one
successful lane as proof of all combinations. Include the supported Nx floor and
ceiling representatives, admitted Node/Nest/TypeScript/test-tool versions, ESM/CJS,
builders, package managers/install layouts and operating systems. Mixed-framework,
root/nested project and native-member fixtures exercise different ownership paths.
PnP or a platform without evidence must remain explicitly unsupported/unverified.

For each acceptance result record:

- Capability and scenario IDs; fixture identity and source revision.
- Plugin package version and archive integrity; exact resolved toolchain versions.
- OS/architecture, package manager/linker, module mode, builder and workspace model.
- Before/after diff; resolved Nx project/task/dependency evidence; command and exit code.
- Expected and observed positive/negative assertions, including cache provenance.
- Artifact/runtime evidence and logs with no secrets; CI URL when actually run.
- Pass/fail/blocked/not-run, limitation, executor, technical reviewer and acceptance date.

No cells currently have fresh acceptance records. Existing
[HTTP consumer evidence](nest-http-consumer-matrix.md),
[three-adapter release evidence](../releases/nest-three-adapter-generation.md)
and library fixtures are reusable baselines, with their original limitations.

## Workstreams and sequencing

W1–W8 remain epic workstreams rather than eight native child issues. The bounded
shared ESLint proposal now has child issue #652, with implementation deferred.
Split remaining work after contract review and reuse existing owners/issues.
No schedule or implementation assignee is implied.

| ID  | Deliverable                                                                          | Depends on / boundary                                                               |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| W1  | Review ADR, supported choices, ownership and fixture plan                            | First; capability owner review, Meta review only for ecosystem-policy changes       |
| W2  | Shared detection/plan/apply model; target collision contract and safe setup/adoption | W1; preserve native source and existing registration/scopes                         |
| W3  | Formatter, lint and test composition; complete check scopes and public options       | W2; reuse supported tooling APIs; standalone/member parity                          |
| W4  | TS/dependency/library/architecture and cross-plugin composition                      | W2; integrate W3 where test/TS scopes intersect; preserve established linking modes |
| W5  | Build outputs, runtime packaging, cache/affected/parallel evidence                   | W2/W4; integrate W3 task outputs; no deployment or CI rollout                       |
| W6  | Versioned upgrade path and customization/rollback evidence                           | W2 plus affected W3–W5 changes; legacy conversion remains #558                      |
| W7  | Schemas, generated/public guides, compatibility/distribution decision                | W1 then accompany every shipped slice; no future capabilities advertised as current |
| W8  | Focused packed consumer acceptance and technical readiness report                    | Evidence accumulates per slice; final review after admitted W2–W7 capabilities      |

## Bounded shared ESLint slice: SI-646.1

Tracking: [#652](https://github.com/anarchitects/anarchitecture-plugins/issues/652),
under [#646](https://github.com/anarchitects/anarchitecture-plugins/issues/646).
The maintainer requested analysis, planning and documentation only. Implementation
is explicitly deferred; all acceptance below remains pending. The ADR remains
Proposed.

### Dated source evidence

The 2026-11-20 follow-up inspected the application generator and member lint
helper at Plugins `ef118bebcba1cdacbe69111265ce4346bf325ba7`, the 0.1.1
manifest's pinned schematics 12.0.13, and published package sources for Nest CLI
12.0.15, schematics 12.0.16 and `@nx/eslint` 24.0.6 (Nx registry version
24.0.6). These are source/registry observations, not fresh scaffold execution,
installed-consumer acceptance or a supported-version expansion.

Neither the current CLI options nor application schema provides an ESLint
selector. Full TypeScript ESM/CJS templates add Oxlint; minimal templates omit
linting. The plugin invokes schematics directly, so upgrading only the CLI does
not establish shared ESLint integration. Schematics 12.0.16 also changes test
omission and adds skills: any pin upgrade needs its own compatibility review.

Nx ESLint can infer tasks from ancestor configuration and lintable files, including
a config importing a shared package. Mere presence of a config does not prove
coverage: exclusions, parser/type-aware scope, plugin scopes and resolved target
precedence still matter. The current lint-project generator can create local
config and migrate root configuration; invoking it unconditionally is not proof
of non-destructive reuse. Verify the public integration API at each admitted Nx
version and preserve consumer configuration.

[#536](https://github.com/anarchitects/anarchitecture-plugins/issues/536) is a
completed repair of native-member Oxlint scope, not an ESLint integration.
[#506](https://github.com/anarchitects/anarchitecture-plugins/issues/506) is
completed native-tooling baseline coverage. Neither is reopened by this proposal.

### Scope, dependency order and review decisions

The proposed contract is [ADR section 2a](../adr/adr-nest-nx-workspace-integration.md#2a-proposed-shared-eslint-integration-for-new-applications).
Start with new independent TypeScript ESM/CJS apps using established shared ESLint
policy. Resolve explicit choice, Nx defaults, compatible workspace policy, then a
visible native fallback. Partial/conflicting ESLint setup fails before changes.
Select exact option names, admitted config forms and version/layout lanes during
review; none is an available plugin feature today.

Review the lint-specific W1 contract and W2 preflight/target ownership decisions
before implementation. These decisions can be bounded to #652 without completing
all W2 or all #646. W7 documentation and W8 packed evidence accompany this slice.
A separate implementation instruction is still required.

Coordinate existing-project adoption with #558/#565, without duplicating their
converter or making either epic a blanket fresh-generation blocker. Member
conversion from a newly generated ESLint app needs preservation evidence or an
actionable pre-mutation rejection. Automatic empty-workspace setup, root hosts,
arbitrary dynamic/legacy configs, new library lint setup and existing-app
conversion remain outside the initial slice unless separately admitted. Do not
couple it to a schematics update, formatter/test/TS overhaul or HTTP-default change.

### Focused acceptance plan

Use the parent scenario IDs; #652 supplies the detailed checklist.

| Parent scenarios | Required evidence for this slice                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01–S03, S13     | Packed public generation for ESM/CJS at nested roots, shared policy and mixed Angular/JS coexistence; second app preserves shared config and existing app bytes; missing setup is diagnosed.                    |
| S04, S07, S12    | Effective custom/default lint target, cwd, plugin scopes and exclusions; no package-script shadowing or duplicate Nest-owned target; member conversion preserves coverage or rejects before mutation.           |
| S07, S10         | Deliberate shared-rule, type-aware and module-boundary violations fail; source, tests, tools and config are checked as selected; build/report outputs are ignored appropriately.                                |
| S08–S09          | Cache hit and invalidation for shared config/rules and relevant source/dependency changes; accurate inputs across nested projects; check cache cannot falsely satisfy fix operations.                           |
| S11              | Dry-run/rejected setup/conflicts/occupied destinations leave Tree, files, manifests and lockfile unchanged; callbacks are deferred and skip-install honored; no implicit existing-app migration.                |
| S13–S14          | No scaffold-added Oxlint artifacts/dependencies when ESLint is selected; unrelated consumer declarations and framework/test/format behavior preserved; schemas, README and rollback match the packed candidate. |

Record exact artifact integrity, resolved versions, OS/manager/linker, command
exit codes and positive/negative assertions. Native fallback must be visible and
retain evidence for its admitted lane. Do not infer native-member support from
independent-app tests, or all-version support from one Nx sample. All rows are
pending; documentation checks cannot close the implementation issue.

Sources: [Nest CLI reference](https://docs.nestjs.com/cli/usages),
[Nx ESLint integration](https://nx.dev/docs/technologies/eslint/introduction),
[inspected application generator](https://github.com/anarchitects/anarchitecture-plugins/blob/ef118bebcba1cdacbe69111265ce4346bf325ba7/packages/nest/src/generators/application/generator.ts)
and [member lint helper](https://github.com/anarchitects/anarchitecture-plugins/blob/ef118bebcba1cdacbe69111265ce4346bf325ba7/packages/nest/src/utils/setup-lint.ts).

## Existing work and closure boundaries

- [#478](https://github.com/anarchitects/anarchitecture-plugins/issues/478),
  [#498](https://github.com/anarchitects/anarchitecture-plugins/issues/498),
  [#543](https://github.com/anarchitects/anarchitecture-plugins/issues/543) and
  [#607](https://github.com/anarchitects/anarchitecture-plugins/issues/607) provide
  earlier core/generation/library/HTTP work. This epic extends their baseline;
  it does not reset completed work or claim all new criteria were previously met.
- [#558](https://github.com/anarchitects/anarchitecture-plugins/issues/558) and its
  #559–#568 children own legacy Nx-to-native conversion. Coordinate target, TS,
  tooling and packaging contracts with them; do not duplicate or reparent them.
  [#636](https://github.com/anarchitects/anarchitecture-plugins/issues/636) remains
  independently deferred bulk migration. No new blocker edge is implied.
- [#581](https://github.com/anarchitects/anarchitecture-plugins/issues/581) owns
  optional canonical contract verification; it is not a generic core dependency.
  Optional HTTP presets remain separately tracked under #635.
- TypeORM [#642](https://github.com/anarchitects/anarchitecture-plugins/issues/642)
  and [#644](https://github.com/anarchitects/anarchitecture-plugins/issues/644)
  concern another plugin. Their fixes and consumer proof are independent; this
  broader epic must not become a blanket prerequisite for bounded defect fixes.

Close the epic only after the ADR's status is resolved, all admitted capability
rows have accepted evidence (or explicit owner-accepted deferrals with rationale
and revisit criteria), upgrade/docs contracts match actual delivery, and a
technical readiness record identifies the exact artifact/revision. Deferral is
not a pass. Release/publication, consumer adoption and CI rollout require their
separate authorizations. No future package version is reserved by this plan.

## Official guidance consulted

- [Nx plugin architecture](https://nx.dev/docs/features/nx-plugins)
- [Nx TypeScript linking](https://nx.dev/docs/kb/typescript-project-linking)
- [Nx Vitest integration](https://nx.dev/docs/technologies/test-tools/vitest/introduction)
- [Nx Oxlint integration and experimental limits](https://nx.dev/docs/technologies/oxlint/introduction)
- [Nx ESLint integration](https://nx.dev/docs/technologies/eslint/introduction)
- [Nx module boundaries](https://nx.dev/docs/core-features/code-organization/enforce-module-boundaries)
- [Nx sync generators](https://nx.dev/docs/concepts/sync-generators)
- [Nx migration generators](https://nx.dev/docs/kb/migration-generators)
- [Nx deployment pruning](https://nx.dev/docs/kb/deploying-node-projects)
- [Nx public plugin distribution guidance](https://nx.dev/docs/kb/publish-plugin)
- [Prettier resolution](https://prettier.io/docs/configuration) and [shared configurations](https://prettier.io/docs/sharing-configurations/)

Consulted on 2026-11-20. Recheck exact installed-version APIs during each
implementation slice; a current web page is not proof that an API exists at every
advertised Nx version.
