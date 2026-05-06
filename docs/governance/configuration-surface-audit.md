# Governance target/profile/config surface audit

## Purpose

This audit captures the **current explicit Nx Governance surface** before
Project Crystal target inference is defined for epic #181.

It is intentionally factual:

- what targets exist today
- how they are currently configured
- which files and options encode today’s behavior
- which assumptions later inference work must preserve or explicitly replace

Current plugin status:

- `packages/governance/src/plugin/index.ts` already registers a valid but
  **no-op** `createNodesV2` hook
- the file pattern is `tools/governance/profiles/*.json`
- the hook currently returns `[]`, so governance behavior still depends on
  explicit root targets

## Current explicit targets

The plugin registers these executor ids in
`packages/governance/src/index.json`, and the same names are used as the
current root target names when init writes explicit targets:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`
- `repo-snapshot`
- `repo-drift`
- `workspace-graph`
- `workspace-conformance`
- `governance-graph`
- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`

Current explicit root target generation from the init generator:

- `targetPreset: "minimal"` writes:
  - `repo-health`
  - `governance-graph`
- `targetPreset: "full"` writes the minimal set plus:
  - `repo-boundaries`
  - `repo-ownership`
  - `repo-architecture`
  - `repo-snapshot`
  - `repo-drift`
  - `workspace-graph`
  - `workspace-conformance`
  - all `repo-ai-*` targets listed above

Current checked-in repository example:

- root `package.json > nx.targets` keeps the broader explicit surface
- that checked-in repo config should not be confused with the init default for
  a new workspace

## Current executors

Executor registration source of truth:

- `packages/governance/src/index.json`
- package exports in `packages/governance/src/index.ts`

### Shared governance report executors

These are thin wrappers over `runGovernance(...)` in
`packages/governance/src/plugin/run-governance.ts`:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`

Common schema shape:

- `profile?: string`
  - default: `frontend-layered`
- `output?: "cli" | "json"`
  - default: `cli`
- `failOnViolation?: boolean`
  - default: `false`
- `conformanceJson?: string`
  - optional override
  - when omitted, runtime falls back to `nx.json > conformance.outputPath`
    before continuing without conformance signals

Current report type wiring:

- `repo-health` -> `reportType: "health"`
- `repo-boundaries` -> `reportType: "boundaries"`
- `repo-ownership` -> `reportType: "ownership"`
- `repo-architecture` -> `reportType: "architecture"`

### Snapshot and drift executors

`repo-snapshot`:

- `profile?: string`, default `frontend-layered`
- `output?: "cli" | "json"`, default `cli`
- `failOnViolation?: boolean`, default `false`
- `snapshotDir?: string`, default `.governance-metrics/snapshots`
- `metricSchemaVersion?: string`, default `1.1`
- runtime persists snapshot files and returns a relative `snapshotPath`

`repo-drift`:

- `output?: "cli" | "json"`, default `cli`
- `snapshotDir?: string`, default `.governance-metrics/snapshots`
- `baseline?: string`
- `current?: string`
- no `profile` option today
- runtime expects at least two snapshots and otherwise returns failure with a
  deterministic “run repo-snapshot first” message

### Graph and diagnostic executors

`governance-graph`:

- `profile?: string`, default `frontend-layered`
- `failOnViolation?: boolean`, default `false`
- `conformanceJson?: string`
- `format?: "json" | "html"`, default `html`
- `outputPath?: string`
- runtime default output path:
  - `dist/governance/graph.html` for `html`
  - `dist/governance/graph.json` for `json`
- executor resolves output paths relative to `workspaceRoot`
- executor writes a static HTML viewer or pretty JSON document

`workspace-graph`:

- `graphJson?: string`
- optional fallback path when Nx API graph loading fails

`workspace-conformance`:

- `conformanceJson: string`
- required schema property
- current init default sets it to `dist/conformance-result.json`

### AI executors

All AI executors remain explicit, registered, and callable. They prepare
deterministic payloads and prompt files; they do not define Project Crystal
inference behavior today.

Shared AI options:

- most use `profile?: string`, default `frontend-layered`
- most use `output?: "cli" | "json"`
- most use `failOnViolation?: boolean`, default `false`

Per-family option patterns from the schemas:

- snapshot-backed AI executors use `snapshotDir?: string`
  - default `.governance-metrics/snapshots`
- some also use `snapshotPath?: string`
  - defaults to latest snapshot in `snapshotDir`
- drift AI uses `baseline?: string` and `current?: string`
- PR impact uses `baseRef?: string` default `main` and `headRef?: string`
  default `HEAD`
- cognitive load and onboarding/refactoring flows use `topProjects?: number`
- several use `topViolations?: number`, default `10`

Current runtime output conventions from docs/tests:

- AI handoff artifacts are written under `.governance-metrics/ai/`
- examples include:
  - `root-cause.payload.json`
  - `root-cause.prompt.md`
  - `drift.payload.json`
  - `drift.prompt.md`
  - `pr-impact.payload.json`
  - `pr-impact.prompt.md`
  - `scorecard.payload.json`
  - `scorecard.prompt.md`

### Cache, inputs, and outputs assumptions visible today

Visible current assumptions:

- executor registration is explicit; no inferred targets are created yet
- governance executor schemas do not define Nx caching metadata themselves
- the `nx-governance` package project has normal `build`, `lint`, `test`, and
  `typecheck` project target metadata, but governance runtime targets are
  currently user/root targets, not inferred package project targets
- `governance-graph` has a concrete file output convention
- snapshot and AI flows persist artifacts in workspace-local directories

## Current init-generator output

Source of truth:

- `packages/governance/src/generators/init/generator.ts`
- `packages/governance/src/generators/init/schema.json`

Current behavior:

- ensures `package.json` exists
- updates `package.json > nx.targets`
- registers `@anarchitects/nx-governance` in `nx.json > plugins`
- seeds governance profile JSON files under `tools/governance/profiles/`
- optionally runs the `eslint-integration` generator
- does not delete existing targets
- does not overwrite existing target options
- does not overwrite existing profile files

Current init options:

- `configureEslint?: boolean`, default `true`
- `eslintConfigPath?: string`
- `governanceHelperPath?: string`
- `preset?: string[]`, default `["frontend-layered"]`
- `profile?: string`
- `profilePath?: string`
- `targetPreset?: "minimal" | "full"`, default `minimal`
- `skipFormat?: boolean`, default `false`

Current preset/profile seeding rules:

- default selected preset/profile is `frontend-layered`
- `preset` is multi-select
- when `profile` is omitted, the first selected preset becomes the default
  runtime profile wired into generated root targets
- built-in starter presets:
  - `frontend-layered`
  - `backend-layered-3tier`
  - `backend-layered-ddd`
- compatibility alias:
  - `layered-workspace`
- `backend-layered-3tier` and `backend-layered-ddd` are mutually exclusive

Current generated target defaults:

- governance report targets written by init include `profile: <selectedProfile>`
- report targets default to `output: "cli"`
- `governance-graph` defaults to `format: "html"` and
  `outputPath: "dist/governance/graph.html"`
- `workspace-conformance` defaults to
  `conformanceJson: "dist/conformance-result.json"`
- AI targets written by `targetPreset: "full"` default to `output: "json"`
  plus their current schema-specific helper defaults

## Current profile/config files

Runtime profile/config location:

- `tools/governance/profiles/<profile-name>.json`

Current runtime profile conventions:

- file basename is the profile name
- executors primarily accept `profile?: string`
- init optionally accepts `profilePath?: string` for seeded file location
- explicit root targets generated by init currently wire `profile`, not
  `profilePath`
- runtime default profile name is `frontend-layered`
- legacy compatibility alias is `layered-workspace`

Current profile shape described in code/docs:

- `boundaryPolicySource`
- `layers`
- optional `allowedLayerDependencies`
- `allowedDomainDependencies`
- `ownership`
- `health.statusThresholds`
- `metrics`
- `exceptions`
- `projectOverrides`
- optional runtime ESLint helper config under `eslint.helperPath`

Current profile loading behavior:

- runtime resolves built-in profile defaults first
- runtime overlays file-based overrides when a profile JSON exists
- when `boundaryPolicySource` is `eslint`, runtime still loads profile data but
  treats `allowedDomainDependencies` as fallback after reading the generated
  ESLint helper
- profile validation is enforced during load for exceptions and explicit layer
  dependency matrices

Related config files used today:

- `nx.json`
  - plugin registration
  - optional `conformance.outputPath` fallback source
- `eslint.config.mjs` / `eslint.config.cjs` / `eslint.config.js`
  - patched by the ESLint integration generator
- `tools/governance/eslint/dependency-constraints.mjs`
  - generated helper module

## Current target naming conventions

Current stable naming pattern:

- explicit root target names match executor ids exactly
- command names in docs/examples are the same as target names, for example:
  - `nx repo-health`
  - `nx repo-boundaries`
  - `nx governance-graph`

Current naming facts:

- there is no separate inferred target naming layer yet
- target names are workspace-root oriented, not project-scoped per library/app
- profiles have a compatibility alias (`layered-workspace`), but targets do
  not have alias names
- graph/reporting names are mixed by intent, not by common prefix:
  - reporting: `repo-*`
  - diagnostics: `workspace-*`
  - graph artifact: `governance-graph`

Current ambiguity to preserve for later design discussion:

- explicit target names are stable today
- there is not yet a formal naming contract for how those names should behave
  when multiple governance profile files exist

## Current output path conventions

Current explicit conventions visible in schemas, code, docs, and tests:

- governance graph:
  - html default: `dist/governance/graph.html`
  - json default: `dist/governance/graph.json`
- workspace conformance init target:
  - `dist/conformance-result.json`
- snapshot storage:
  - `.governance-metrics/snapshots`
- AI artifact storage:
  - `.governance-metrics/ai/*`

Current output mode conventions:

- report executors default to CLI output unless overridden with `--output=json`
- most AI targets generated by init default to `output: "json"`
- `repo-ai-root-cause` schema still defaults to `cli`, but init writes it with
  `output: "json"`
- `governance-graph` chooses file output by `format`, not by `output`

Current path resolution conventions:

- graph executor resolves relative `outputPath` against `workspaceRoot`
- conformance input uses explicit `--conformanceJson` first, then
  `nx.json > conformance.outputPath`
- snapshot-backed flows resolve relative snapshot paths from the workspace and
  return relative paths in JSON/CLI output

## Current tests encoding current behavior

Tests that currently encode governance target/profile/config assumptions:

- `packages/governance/src/generators/init/generator.spec.ts`
  - minimal vs full target generation
  - default target names
  - default graph wiring
  - preset/profile selection
  - preservation of existing targets and target options
  - preservation of existing profile files
- `packages/governance/src/plugin/run-governance.spec.ts`
  - explicit `profile` option resolution
  - conformance input integration
  - snapshot/drift/AI runtime output expectations
- `packages/governance/src/executors/governance-graph/executor.spec.ts`
  - graph format enum
  - json/html rendering
  - explicit `outputPath` writing behavior
  - executor registration in `src/index.json`
- `packages/governance/src/profile/load-profile-overrides.spec.ts`
  - runtime profile path resolution
  - built-in profile defaults
  - `layered-workspace` compatibility fallback
  - layer matrix validation
- `packages/governance/src/generators/eslint-integration/generator.spec.ts`
  - profile file location and migration assumptions
  - helper path conventions
  - runtime-vs-ESLint split for `allowedLayerDependencies`
- `packages/governance/src/executors/workspace-graph/executor.spec.ts`
  - graph fallback path conventions
- `packages/governance/src/executors/workspace-conformance/executor.spec.ts`
  - required `conformanceJson` behavior

These files are the main regression surface later inference issues must respect.

## Compatibility constraints

Existing users may already depend on:

- explicit root targets in `package.json > nx.targets`
- current stable target names
- `profile` as the runtime override mechanism
- `frontend-layered` as the default profile
- `layered-workspace` as a compatibility alias
- `governance-graph` being part of the current minimal target preset
- `targetPreset: "minimal" | "full"` in init
- snapshot and AI artifact locations under `.governance-metrics/`
- graph artifact defaults under `dist/governance/`

Compatibility constraints visible in code today:

- explicit targets must continue to run unchanged
- init is additive and non-destructive
- existing profile files must remain valid
- executor option schemas are already public and should be treated as stable
- the current no-op `createNodesV2` hook must not be mistaken for active
  inference behavior

## Open decisions for Project Crystal inference

The following points are **not** resolved by current code and should remain
open for #205 and later inference work:

- authoritative inference source:
  - should `tools/governance/profiles/*.json` be the only source, or should
    plugin config and explicit root targets also influence inference?
- root attachment model:
  - should inferred targets attach to the existing root project `.`
    conventions, or to a synthetic governance project?
- coexistence rules:
  - how should explicit root targets and inferred targets interact when both
    exist?
  - which side wins for options, metadata, and descriptions?
- multi-profile defaulting:
  - current runtime supports multiple profile files, but current target naming
    stays singular and stable
  - inference must define how one default profile is selected deterministically
- `governance-graph` inference:
  - today it is part of the explicit minimal target surface
  - later inference must decide whether it should also be inferred by default
    or remain explicit-only
- optional/full target inference scope:
  - should inference create only the core report targets
  - should it also infer `governance-graph`
  - should it infer snapshot/drift, diagnostics, and AI targets, or leave
    those explicit
- inferred output path conventions:
  - if targets are inferred instead of written explicitly, where should graph,
    snapshot, and AI defaults live so they remain discoverable and stable?
- plugin configuration:
  - whether future inference should support plugin options for default profile
    precedence or target selection
- init alignment:
  - `INFERENCE_REQUIREMENTS.md` currently says a later phase may stop writing
    redundant explicit targets
  - that migration path is still open and should not be decided in this audit
