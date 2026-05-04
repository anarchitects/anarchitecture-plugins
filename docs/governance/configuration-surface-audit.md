# Nx Governance Configuration Surface Audit

## Purpose

This audit prepares epic #182 and the target-inference work in #181 by
documenting the current Nx Governance configuration surface before cleanup or
Project Crystal inference changes start.

The goal is to capture the current generator, target, executor, profile, and
documentation surface as it exists today so the follow-up cleanup issues can
change behavior intentionally instead of by accident.

## Scope

This audit is limited to the current governance surface visible in:

- `packages/governance/`
- `docs/`
- `.github/`
- `package.json`
- `nx.json`

The audit is based on concrete code and config locations such as:

- `packages/governance/src/generators/init/generator.ts`
- `packages/governance/src/generators/eslint-integration/generator.ts`
- `packages/governance/src/index.json`
- `packages/governance/src/plugin/index.ts`
- `packages/governance/src/presets/angular-cleanup/profile.ts`
- `packages/governance/src/plugin/run-governance.ts`
- `packages/governance/README.md`
- root `package.json`
- root `nx.json`

## Current Init Behavior

The governance init generator is implemented in
`packages/governance/src/generators/init/generator.ts` as `initGenerator()`.

Today it:

- registers the governance plugin in `nx.json` via `ensureNxPluginRegistration()`
- writes explicit root targets into `package.json > nx.targets` via
  `ensureRootTargets()`
- creates `tools/governance/profiles/angular-cleanup.json` via
  `ensureProfileConfig()` if the file does not already exist
- optionally invokes the ESLint integration generator via
  `eslintIntegrationGenerator(tree, { skipFormat: true })`
- formats generated files unless `skipFormat` is set

Preservation behavior is additive, not destructive:

- `ensureNxPluginRegistration()` avoids duplicate plugin registration
- `ensureRootTargets()` merges generated target defaults with existing target
  config through `mergeRootTarget()`
- existing target `options`, `metadata`, and extra keys win over generated
  defaults when already present
- existing profile JSON is preserved because `ensureProfileConfig()` exits early
  if the generated file already exists

The init generator still writes a large explicit target surface even though the
plugin also exposes a `createNodesV2` hook in
`packages/governance/src/plugin/index.ts`. That hook currently returns `[]`, so
there is no active inference behavior yet.

## Current Root Targets

The generated root target set is defined in `GOVERNANCE_TARGETS` in
`packages/governance/src/generators/init/generator.ts`.

The committed root `package.json` currently mirrors most of that surface under
`nx.targets`, but it does not currently contain `governance-graph`. That means
generator behavior, committed workspace config, and README guidance have already
started to drift.

| Target | Executor | Default profile/config | Output path | Current role | Classification |
| --- | --- | --- | --- | --- | --- |
| `repo-health` | `@anarchitects/nx-governance:repo-health` | `profile: angular-cleanup`, `output: cli` | `n/a` | Primary workspace governance report | `essential-default, inference-candidate` |
| `repo-boundaries` | `@anarchitects/nx-governance:repo-boundaries` | `profile: angular-cleanup`, `output: cli` | `n/a` | Boundary-focused drilldown | `optional-convenience, inference-candidate` |
| `repo-ownership` | `@anarchitects/nx-governance:repo-ownership` | `profile: angular-cleanup`, `output: cli` | `n/a` | Ownership-focused drilldown | `optional-convenience, inference-candidate` |
| `repo-architecture` | `@anarchitects/nx-governance:repo-architecture` | `profile: angular-cleanup`, `output: cli` | `n/a` | Architecture-focused drilldown | `optional-convenience, inference-candidate` |
| `repo-snapshot` | `@anarchitects/nx-governance:repo-snapshot` | `profile: angular-cleanup`, `output: cli` | `snapshot dir at runtime` | Snapshot persistence for drift and AI flows | `optional-convenience` |
| `repo-drift` | `@anarchitects/nx-governance:repo-drift` | `output: cli` | `n/a` | Drift comparison workflow | `optional-convenience` |
| `workspace-graph` | `@anarchitects/nx-governance:workspace-graph` | no profile | `n/a` | Nx graph baseline diagnostic | `diagnostic` |
| `workspace-conformance` | `@anarchitects/nx-governance:workspace-conformance` | `conformanceJson: dist/conformance-result.json` | `n/a` | Nx Conformance baseline diagnostic | `diagnostic` |
| `governance-graph` | `@anarchitects/nx-governance:governance-graph` | `format: html` | `dist/governance/graph.html` | Governance graph JSON/HTML artifact | `optional-convenience, inference-candidate` |
| `repo-ai-root-cause` | `@anarchitects/nx-governance:repo-ai-root-cause` | `profile: angular-cleanup`, `output: json`, `topViolations: 10` | handoff payload/prompt files at runtime | AI root-cause preparation | `ai-workflow, optional-convenience` |
| `repo-ai-drift` | `@anarchitects/nx-governance:repo-ai-drift` | `profile: angular-cleanup`, `output: json` | handoff payload/prompt files at runtime | AI drift interpretation | `ai-workflow, optional-convenience` |
| `repo-ai-pr-impact` | `@anarchitects/nx-governance:repo-ai-pr-impact` | `profile: angular-cleanup`, `output: json`, `baseRef: main`, `headRef: HEAD` | handoff payload/prompt files at runtime | AI PR impact preparation | `ai-workflow, optional-convenience` |
| `repo-ai-cognitive-load` | `@anarchitects/nx-governance:repo-ai-cognitive-load` | `profile: angular-cleanup`, `output: json`, `topProjects: 10` | `n/a` | AI cognitive-load briefing | `ai-workflow, optional-convenience` |
| `repo-ai-recommendations` | `@anarchitects/nx-governance:repo-ai-recommendations` | `profile: angular-cleanup`, `output: json`, `topViolations: 10` | `n/a` | AI recommendations briefing | `ai-workflow, optional-convenience` |
| `repo-ai-smell-clusters` | `@anarchitects/nx-governance:repo-ai-smell-clusters` | `profile: angular-cleanup`, `output: json`, `topViolations: 10` | `n/a` | AI smell-cluster briefing | `ai-workflow, optional-convenience` |
| `repo-ai-refactoring-suggestions` | `@anarchitects/nx-governance:repo-ai-refactoring-suggestions` | `profile: angular-cleanup`, `output: json`, `topViolations: 10`, `topProjects: 5` | `n/a` | AI refactoring briefing | `ai-workflow, optional-convenience` |
| `repo-ai-scorecard` | `@anarchitects/nx-governance:repo-ai-scorecard` | `profile: angular-cleanup`, `output: json` | handoff payload/prompt files at runtime | AI scorecard briefing | `ai-workflow, optional-convenience` |
| `repo-ai-onboarding` | `@anarchitects/nx-governance:repo-ai-onboarding` | `profile: angular-cleanup`, `output: json`, `topViolations: 10`, `topProjects: 5` | `n/a` | AI onboarding briefing | `ai-workflow, optional-convenience` |

## Current Executors

The public executor registry lives in `packages/governance/src/index.json`.
`packages/governance/package.json` points both `executors` and `generators` to
`dist/index.json`, so `src/index.json` is the authored registry surface.

| Executor | Purpose | Current category | Keep explicitly documented after inference? |
| --- | --- | --- | --- |
| `repo-health` | Full governance assessment and scoring surface through `runGovernanceExecutor(..., 'health')` in `packages/governance/src/executors/repo-health/executor.ts` | core user journey | yes |
| `repo-boundaries` | Boundary-focused governance report | core user journey | yes |
| `repo-ownership` | Ownership-focused governance report | core user journey | yes |
| `repo-architecture` | Architecture-focused governance report | core user journey | yes |
| `repo-snapshot` | Persist metric snapshots for drift and AI flows | support workflow | yes |
| `repo-drift` | Compare snapshots and surface drift | support workflow | yes |
| `workspace-graph` | Read and summarize Nx Project Graph counts in `packages/governance/src/executors/workspace-graph/executor.ts` | diagnostic | yes, but as advanced/diagnostic |
| `workspace-conformance` | Read and summarize Nx Conformance JSON counts | diagnostic | yes, but as advanced/diagnostic |
| `governance-graph` | Build graph document and emit JSON or static HTML viewer | graph/reporting | yes |
| `repo-ai-root-cause` | Prepare deterministic AI root-cause payloads | AI workflow | optional/advanced |
| `repo-ai-drift` | Prepare deterministic AI drift payloads | AI workflow | optional/advanced |
| `repo-ai-pr-impact` | Prepare deterministic AI PR impact payloads | AI workflow | optional/advanced |
| `repo-ai-cognitive-load` | Prepare deterministic AI cognitive-load payloads | AI workflow | optional/advanced |
| `repo-ai-recommendations` | Prepare deterministic AI recommendations payloads | AI workflow | optional/advanced |
| `repo-ai-smell-clusters` | Prepare deterministic AI smell-cluster payloads | AI workflow | optional/advanced |
| `repo-ai-refactoring-suggestions` | Prepare deterministic AI refactoring payloads | AI workflow | optional/advanced |
| `repo-ai-scorecard` | Prepare deterministic AI scorecard payloads | AI workflow | optional/advanced |
| `repo-ai-onboarding` | Prepare deterministic AI onboarding payloads | AI workflow | optional/advanced |

Key implementation pattern:

- the four main repo executors share `runGovernanceExecutor()` in
  `packages/governance/src/executors/shared.ts`
- most executor option contracts centralize in
  `packages/governance/src/executors/types.ts`
- AI executors are separate public commands rather than hidden support modules

## Current Profiles and Presets

Profiles are runtime governance configuration files under:

- `tools/governance/profiles/*.json`

Selection is executor-driven:

- executor schemas expose `profile`
- the default is hardcoded as `angular-cleanup` across governance executor
  schemas in `packages/governance/src/executors/*/schema.json`
- runtime loading happens through `loadProfileOverrides(workspaceRoot, profileName)`
  in `packages/governance/src/presets/angular-cleanup/profile.ts`

Built-in preset surface:

- `angularCleanupProfile` in
  `packages/governance/src/presets/angular-cleanup/profile.ts`
- description: `Angular-oriented governance defaults for Nx workspaces.`
- generated profile file: `tools/governance/profiles/angular-cleanup.json`
  from `ensureProfileConfig()` in the init generator

Important current coupling:

- `run-governance.ts` imports `angularCleanupProfile` directly from
  `../presets/angular-cleanup/profile.js`
- missing profile files fall back to `angularCleanupProfile` defaults
- init generation, executor schema defaults, README examples, and AI/root target
  generation all assume `angular-cleanup` exists

Current preset content is not Angular framework logic in the narrow sense. It is
mostly naming plus a layered default model:

- layers: `app`, `feature`, `ui`, `data-access`, `util`
- default wildcard domain dependency: `'*' -> ['shared']`
- ownership required by default
- metric defaults

There is no separate generic `src/profile/` module in the current package
layout. The `src/presets/angular-cleanup/profile.ts` module currently acts as:

- built-in preset definition
- runtime profile loader
- fallback/default profile resolver
- ESLint-assisted boundary-policy resolver

## ESLint Configuration Assumptions

The current ESLint integration surface is strongly hardcoded in
`packages/governance/src/generators/eslint-integration/generator.ts`.

Current assumptions:

- hardcoded root ESLint file path:
  `const ESLINT_CONFIG_PATH = 'eslint.config.mjs'`
- hardcoded generated helper path:
  `const HELPER_PATH = 'tools/governance/eslint/dependency-constraints.mjs'`
- hardcoded profile migration target:
  `const PROFILE_PATH = 'tools/governance/profiles/angular-cleanup.json'`
- flat-config assumption:
  the generator patches ESM `eslint.config.mjs`; there is no legacy
  `.eslintrc.*` handling path
- import injection assumption:
  the generator looks for `import nx from '@nx/eslint-plugin';` before adding the
  helper import
- runtime coupling assumption:
  when `boundaryPolicySource === 'eslint'`, `loadProfileOverrides()` in
  `packages/governance/src/presets/angular-cleanup/profile.ts` imports
  `tools/governance/eslint/dependency-constraints.mjs`

Behavior when ESLint config is missing:

- `ensureEslintConfigIntegration()` logs a warning and returns
- the helper file is still written
- governance profile migration is skipped if either `eslint.config.mjs` or
  `tools/governance/profiles/angular-cleanup.json` is missing

This means the current surface assumes:

- flat ESLint config
- root-level `eslint.config.mjs`
- root-level governance helper file
- root-level `angular-cleanup.json` as the migration anchor

## Angular-Specific Concerns in Core

Angular-specific concerns currently live in the core governance package, mostly
as naming, defaults, and positioning rather than Angular AST or framework
analysis.

| Concern | Evidence | Type of concern | Likely future direction |
| --- | --- | --- | --- |
| `angular-cleanup` preset name | `packages/governance/src/presets/angular-cleanup/profile.ts` | naming/positioning only | candidate for neutral replacement later |
| `Angular-oriented governance defaults for Nx workspaces.` description | `angularCleanupProfile.description` | naming/positioning only | move to neutral preset or extension-owned preset later |
| generated profile file `tools/governance/profiles/angular-cleanup.json` | `ensureProfileConfig()` in init generator | migration compatibility and starter default | keep compatible until migration path exists |
| default layers `app/feature/ui/data-access/util` | `angularCleanupProfile.layers` | convention default, not framework parsing logic | candidate for neutral layered preset later |
| README language around Angular cleanup | `packages/governance/README.md` profile and init sections | naming/positioning only | docs cleanup candidate |
| pervasive schema defaults to `angular-cleanup` | executor `schema.json` files | runtime defaulting choice | clarify in #187 before behavior change |
| direct runtime import of `angularCleanupProfile` | `packages/governance/src/plugin/run-governance.ts` | core runtime coupling | candidate for preset/runtime split later |

What is not currently present in the core package surface:

- Angular template parsing
- Angular compiler integration
- Angular-specific AST analysis

So the main problem is not deep Angular framework logic in core. The main
problem is that a single Angular-named preset currently acts as the runtime
identity for the whole plugin surface.

## Governance Graph Wiring

The governance graph surface currently spans:

- executor registration in `packages/governance/src/index.json`
- executor implementation in
  `packages/governance/src/executors/governance-graph/executor.ts`
- static viewer renderer in
  `packages/governance/src/executors/governance-graph/viewer.ts`
- graph document builder in `packages/governance/src/graph-document/`
- init target generation in `packages/governance/src/generators/init/generator.ts`

Current behavior:

- public executor name: `governance-graph`
- format options: `json` and `html`
- default init target output: `dist/governance/graph.html`
- graph executor reuses the existing governance assessment pipeline instead of a
  separate graph pipeline
- HTML output is a generated static viewer, not a live Nx graph integration

Current classification:

- likely `optional target`
- likely `inference candidate`
- still `undecided until #181` for long-term init behavior

Reasoning:

- it is a real user-facing artifact, so it should remain public
- it is not required for minimal governance adoption
- it is a good candidate for convention-based discovery from profile presence,
  but not necessarily for mandatory init-time target generation

Important drift already exists:

- init generator now defines `governance-graph`
- README documents it as a root target
- root `package.json` currently does not contain it

## AI Governance Wiring

AI governance wiring currently exists as explicit public root targets plus public
executors:

- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`

Evidence:

- target generation in `GOVERNANCE_TARGETS` in the init generator
- executor registry in `packages/governance/src/index.json`
- runtime orchestration in `packages/governance/src/plugin/run-governance.ts`
- README sections under the AI executor headings

Current classification:

- optional AI workflows
- not part of the minimal governance install
- should remain public for advanced users, but not necessarily generated by
  default forever

The AI surface is large relative to the core governance journey. That makes it a
strong candidate for explicit cleanup in target generation before inference is
introduced.

## Docs, Config, and Fixture Risks

1. README/inference mismatch:
   `packages/governance/README.md` says the minimum supported Nx version is
   driven by Project Crystal inferred targets, but
   `packages/governance/src/plugin/index.ts` currently returns `[]` from
   `createNodesV2`.

2. Generator/current-workspace drift:
   `packages/governance/src/generators/init/generator.ts` now generates
   `governance-graph`, but root `package.json` does not currently contain that
   target.

3. README/workflow drift:
   `packages/governance/README.md` contains governance CI examples, but
   `.github/workflows/main.yml` and `.github/workflows/publish.yml` do not
   currently run any governance targets.

4. Angular-named default drift risk:
   many docs, schemas, examples, and init defaults still assume
   `angular-cleanup`, which raises cleanup cost once a neutral profile model is
   introduced.

5. Explicit target surface as fixture risk:
   the root `package.json` currently acts as a large implicit fixture for init
   generator output. Any future cleanup to default target generation risks docs,
   examples, and local workspace config drifting independently.

6. Registry path surprise:
   there is no authored `packages/governance/executors.json` or
   `packages/governance/generators.json`; the authored surface is
   `packages/governance/src/index.json`, while `packages/governance/package.json`
   points consumers at `dist/index.json`.

7. Planning/docs overlap risk:
   `packages/governance/INFERENCE_REQUIREMENTS.md` describes desired inference
   behavior that is not yet implemented, while README language already leans on
   inferred-target positioning.

8. Ownership surface split:
   `.github/CODEOWNERS` assigns `/packages/governance/` explicitly, but
   `docs/governance/` falls back to the workspace-wide owner rule. That is not a
   product issue, but it is a documentation ownership nuance once governance
   docs expand outside the package folder.

## Classification

### Target Classification

| Item | Current state | Classification | Recommendation |
| --- | --- | --- | --- |
| `repo-health` | explicit root target generated by init and present in root `package.json` | `essential-default, inference-candidate` | keep public; make this part of the minimal surface |
| `repo-boundaries` | explicit root target generated by init and present in root `package.json` | `optional-convenience, inference-candidate` | keep public; reconsider default generation |
| `repo-ownership` | explicit root target generated by init and present in root `package.json` | `optional-convenience, inference-candidate` | keep public; reconsider default generation |
| `repo-architecture` | explicit root target generated by init and present in root `package.json` | `optional-convenience, inference-candidate` | keep public; reconsider default generation |
| `repo-snapshot` | explicit init target for downstream workflows | `optional-convenience` | keep public; do not require for minimal install |
| `repo-drift` | explicit init target for downstream workflows | `optional-convenience` | keep public; do not require for minimal install |
| `workspace-graph` | explicit diagnostic target | `diagnostic` | keep public as advanced diagnostic |
| `workspace-conformance` | explicit diagnostic target | `diagnostic` | keep public as advanced diagnostic |
| `governance-graph` | generated by init, documented, but currently absent from root `package.json` | `optional-convenience, inference-candidate` | revisit in #189 after deciding minimal install policy |
| `repo-ai-*` targets | nine explicit AI root targets | `ai-workflow, optional-convenience` | keep public, but move out of minimal default init surface |

### Profile and Preset Classification

| Item | Current state | Classification | Recommendation |
| --- | --- | --- | --- |
| `angularCleanupProfile` | built-in preset and runtime fallback in `src/presets/angular-cleanup/profile.ts` | `essential-default` | keep compatible now; split preset identity from runtime loading later |
| `tools/governance/profiles/angular-cleanup.json` | generated starter profile file | `essential-default` | keep until neutral starter and migration path exist |
| `profile` executor option | defaulted in governance executor schemas | `essential-default` | keep as runtime selector; clarify profile responsibility in #187 |
| preset module doubling as runtime loader | preset file also owns `loadProfileOverrides()` | `unknown` | split runtime config loading from preset definition in cleanup planning |
| absence of generic `src/profile/` module | profile logic lives under `src/presets/` | `unknown` | clarify intended ownership in #187 before code moves |

### Configuration Assumption Classification

| Item | Current state | Classification | Recommendation |
| --- | --- | --- | --- |
| hardcoded `eslint.config.mjs` | required by ESLint integration generator | `remove-candidate` | address in #184 |
| hardcoded helper path `tools/governance/eslint/dependency-constraints.mjs` | used by generator and runtime loader | `remove-candidate` | address in #184 |
| hardcoded migration target `tools/governance/profiles/angular-cleanup.json` | used by ESLint migration path | `remove-candidate` | address in #184 and #185 |
| README language implying inference | docs lean on inferred-target positioning | `deprecated-or-legacy` | clean up in #190 |
| large explicit init target set | current install writes many root targets | `remove-candidate` | reduce in #186 after responsibilities are clarified |
| no-op `createNodesV2` plugin hook | inference plugin exists but returns no targets | `inference-candidate` | implement only after cleanup decisions are explicit |

## Recommended Cleanup Order

Recommended order:

1. #187 Clarify profiles, presets, and executor responsibilities
2. #184 Remove hardcoded ESLint configuration assumptions
3. #185 Retire or redefine angular-cleanup preset
4. #186 Reduce default root target generation in init
5. #189 Revisit Governance Graph init wiring after MVP
6. #190 Remove stale governance docs, configs, and examples

Why this order:

- #187 should happen first because the current surface mixes runtime profiles,
  built-in presets, executor defaults, and init-generated starter files.
  Behavior-changing cleanup before that clarification would risk renaming or
  removing the wrong abstraction.
- #184 should happen before inference because current generator/runtime behavior
  assumes specific ESLint files and paths.
- #185 should happen after #187 because `angular-cleanup` is both a preset name
  and a runtime default today.
- #186 should happen after profile/preset clarification and ESLint assumption
  cleanup, otherwise init reduction will preserve the wrong surface.
- #189 should happen after init reduction because governance graph is valuable
  but not clearly part of the minimal default install surface.
- #190 should finish the sequence because docs and examples should reflect the
  final decisions, not intermediate cleanup states.

## Decisions Proposed for #182

- Profiles are runtime governance configuration.
- Presets are starter defaults or templates, not the long-term runtime identity
  of the plugin.
- Executor options control runtime behavior and may select a profile, but they
  should not be the only place where preset/runtime responsibilities are
  encoded.
- Init should install minimal setup and avoid writing every possible target
  long-term.
- Explicit targets must remain backward compatible.
- Project Crystal inference should fill missing targets rather than override
  explicit targets.
- `angular-cleanup` should remain compatible until a neutral replacement or
  migration path exists.
- Diagnostic and AI workflows should remain public commands, but they do not
  need to be part of the smallest default install surface.
- Governance Graph should remain public, but its default init status should be
  decided after the broader target-surface cleanup.

## Out of Scope for This Audit

This audit does not:

- change executor behavior
- change init behavior
- remove targets
- remove presets
- rename `angular-cleanup`
- implement Project Crystal inference
- modify ESLint integration logic
- rewrite the README
- change workflows
- touch unrelated packages

## Follow-up Issues

- #187 Clarify profiles, presets, and executor responsibilities
  - separate runtime configuration concepts from preset/starter concepts
  - decide where runtime profile loading should live
  - document the long-term role of `angular-cleanup`

- #184 Remove hardcoded ESLint configuration assumptions
  - remove assumptions around `eslint.config.mjs`
  - remove or parameterize hardcoded helper/profile paths
  - define behavior for missing or non-flat ESLint setups

- #185 Retire or redefine angular-cleanup preset
  - keep compatibility, but reduce the plugin-wide identity coupling to an
    Angular-named preset
  - decide whether the replacement is neutral core naming or extension-owned
    naming

- #186 Reduce default root target generation in init
  - define the minimal default root target surface
  - move diagnostics and AI workflows out of mandatory init generation where
    appropriate
  - keep existing explicit targets backward compatible

- #189 Revisit Governance Graph init wiring after MVP
  - decide whether `governance-graph` is part of minimal install or an opt-in
    explicit target
  - align init output, root config, and docs

- #190 Remove stale governance docs, configs, and examples
  - fix README language that currently implies inference is already active
  - align docs with actual root target generation
  - remove examples that over-assume `angular-cleanup` or current explicit target
    sprawl
