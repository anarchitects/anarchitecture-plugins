# Nx Governance Compatibility Contract

## Purpose

This document defines the compatibility contract for existing `@anarchitects/nx-governance` users while the architecture evolves toward Governance Core, adapters, extensions, and CLI support.

It implements #230 and provides guardrails for #218 and related implementation epics.

This is a documentation-only contract. It does not change executor behavior, generator behavior, target inference, profile loading, artifact output, schemas, or runtime implementation.

## Compatibility Principle

`@anarchitects/nx-governance` remains the stable Nx product surface during the Governance Core extraction.

Architecture work may introduce internal boundaries and future packages, but existing Nx users should be able to keep using the same commands, targets, generated configuration, profile conventions, and artifact paths unless a later migration explicitly documents and implements a breaking change.

## Compatibility Classification

This document classifies behavior as:

| Classification | Meaning |
|---|---|
| Stable | Must remain compatible during #218 unless a later breaking-change issue explicitly changes it. |
| Compatibility-preserved | Existing behavior should keep working, but implementation may move behind new boundaries. |
| Internal | Can change if public behavior remains stable. |
| Deferred decision | Not changed by #218; later architecture/implementation issue must decide. |

## Stable Nx Target and Executor Surface

The following target/executor names are part of the current public Nx Governance surface and should remain stable.

| Target / executor id | Current purpose | Compatibility classification |
|---|---|---|
| `repo-health` | Governance health report. | Stable |
| `repo-boundaries` | Boundary-focused report. | Stable |
| `repo-ownership` | Ownership-focused report. | Stable |
| `repo-architecture` | Architecture-focused report. | Stable |
| `repo-snapshot` | Persist metric snapshot. | Stable |
| `repo-drift` | Compare snapshots and report drift. | Stable |
| `workspace-graph` | Workspace graph diagnostics. | Stable |
| `workspace-conformance` | Conformance input integration. | Stable |
| `governance-graph` | Governance graph artifact output. | Stable |
| `repo-ai-root-cause` | AI root-cause payload/prompt generation. | Stable |
| `repo-ai-drift` | AI drift payload/prompt generation. | Stable |
| `repo-ai-pr-impact` | AI PR impact payload/prompt generation. | Stable |
| `repo-ai-cognitive-load` | AI cognitive-load payload/prompt generation. | Stable |
| `repo-ai-recommendations` | AI recommendations payload/prompt generation. | Stable |
| `repo-ai-smell-clusters` | AI smell-cluster payload/prompt generation. | Stable |
| `repo-ai-refactoring-suggestions` | AI refactoring suggestions payload/prompt generation. | Stable |
| `repo-ai-scorecard` | AI scorecard payload/prompt generation. | Stable |
| `repo-ai-onboarding` | AI onboarding payload/prompt generation. | Stable |

## Stable Generator Surface

The current public generators remain part of the Nx host compatibility surface.

| Generator | Current purpose | Compatibility classification |
|---|---|---|
| `init` | Sets up Nx Governance targets, plugin registration, profiles, and optional ESLint integration. | Stable |
| `eslint-integration` | Configures governance-aware ESLint dependency constraints helper integration. | Stable |

## Executor Option Compatibility

Existing executor option names and common defaults should remain compatible.

### Shared report executor options

Applicable to the core report executors such as `repo-health`, `repo-boundaries`, `repo-ownership`, and `repo-architecture`.

| Option | Compatibility expectation |
|---|---|
| `profile` | Stable. Continue accepting profile name override. |
| `output` | Stable. Continue supporting current `cli` / `json` behavior where supported. |
| `failOnViolation` | Stable. Preserve current failure behavior. |
| `conformanceJson` | Stable where currently supported. Preserve explicit override behavior and fallback behavior. |

### Snapshot and drift options

| Target | Options / behavior to preserve |
|---|---|
| `repo-snapshot` | Preserve `profile`, `output`, `failOnViolation`, `snapshotDir`, `metricSchemaVersion`, and returned relative snapshot path behavior. |
| `repo-drift` | Preserve `output`, `snapshotDir`, `baseline`, `current`, and deterministic failure guidance when insufficient snapshots exist. |

### Graph and diagnostic options

| Target | Options / behavior to preserve |
|---|---|
| `governance-graph` | Preserve `profile`, `failOnViolation`, `conformanceJson`, `format`, `outputPath`, HTML/JSON output behavior, and workspace-relative output path resolution. |
| `workspace-graph` | Preserve `graphJson` fallback behavior where currently supported. |
| `workspace-conformance` | Preserve required `conformanceJson` behavior where currently required. |

### AI executor options

AI target option schemas are part of the current public surface.

Compatibility expectations:

- preserve `profile` where currently supported
- preserve `output` where currently supported
- preserve `failOnViolation` where currently supported
- preserve snapshot-related options such as `snapshotDir`, `snapshotPath`, `baseline`, and `current`
- preserve PR-impact options such as `baseRef` and `headRef`
- preserve limiting options such as `topProjects` and `topViolations` where currently supported
- preserve deterministic payload and prompt artifact output behavior

## Profile Compatibility

Current profile behavior must remain compatible while profile internals evolve toward Core rule configuration.

| Profile behavior | Compatibility expectation |
|---|---|
| Runtime profile location | Preserve `tools/governance/profiles/<profile-name>.json`. |
| Profile name from file basename | Preserve. |
| Default profile | Preserve `frontend-layered`. |
| Compatibility alias | Preserve `layered-workspace` where currently supported. |
| Starter presets | Preserve `frontend-layered`, `backend-layered-3tier`, and `backend-layered-ddd` where currently supported. |
| Profile override loading | Existing file-based profile overrides should remain valid. |
| Existing profile shape | Existing profiles should continue to load during #218. Any new Core profile model must provide compatibility mapping. |
| `boundaryPolicySource` | Existing behavior should remain compatible, even if the long-term Core model no longer treats ESLint as a first-class core concept. |
| Exceptions | Existing exception configuration should remain valid. |
| Project overrides | Existing project override behavior should remain valid. |

## Project Crystal Inference Compatibility

Project Crystal inference is an Nx host responsibility and must remain compatible.

| Behavior | Compatibility expectation |
|---|---|
| File pattern | Preserve `tools/governance/profiles/*.json` unless a later explicit migration changes it. |
| Inferred targets | Preserve `repo-health`, `repo-boundaries`, `repo-ownership`, and `repo-architecture`. |
| Target names | Inferred targets must keep using the stable existing target names. |
| Default selected profile | Preserve current default selection behavior, preferring `frontend-layered` when available. |
| Explicit targets | Explicit workspace/root targets remain authoritative and must not be overwritten by inference. |
| Cache/input behavior | Preserve current inferred target cache/input assumptions unless an explicit implementation issue changes them. |
| `governance-graph` inference | Remains explicit-only in the current MVP unless a later issue deliberately changes it. |

## Init Generator Compatibility

The init generator must remain additive and non-destructive.

| Behavior | Compatibility expectation |
|---|---|
| Package file handling | Continue ensuring required workspace files exist where current behavior does. |
| Root target generation | Preserve existing target names and target option defaults. |
| Existing targets | Do not delete existing targets. |
| Existing target options | Do not overwrite existing target options. |
| Existing profile files | Do not overwrite existing profile files. |
| Plugin registration | Preserve registration of `@anarchitects/nx-governance` in `nx.json > plugins`. |
| ESLint integration | Preserve optional `configureEslint` flow and helper path conventions. |
| Preset selection | Preserve multi-select preset behavior and default selected profile behavior. |
| `targetPreset` | Preserve `minimal` and `full` behavior. |

## Artifact and Output Path Compatibility

Current output paths and artifact conventions must remain compatible.

| Artifact / output | Stable convention |
|---|---|
| Governance graph HTML | `dist/governance/graph.html` |
| Governance graph JSON | `dist/governance/graph.json` |
| Workspace conformance JSON | `dist/conformance-result.json` where currently configured by init/defaults. |
| Metric snapshots | `.governance-metrics/snapshots` |
| AI handoff artifacts | `.governance-metrics/ai` |
| AI root-cause payload/prompt examples | `.governance-metrics/ai/root-cause.payload.json`, `.governance-metrics/ai/root-cause.prompt.md` |
| AI drift payload/prompt examples | `.governance-metrics/ai/drift.payload.json`, `.governance-metrics/ai/drift.prompt.md` |
| AI PR-impact payload/prompt examples | `.governance-metrics/ai/pr-impact.payload.json`, `.governance-metrics/ai/pr-impact.prompt.md` |

Relative path behavior should remain workspace-root-relative where current executors behave that way.

## Report and Exit Behavior Compatibility

| Behavior | Compatibility expectation |
|---|---|
| CLI output mode | Preserve human-readable CLI output where currently supported. |
| JSON output mode | Preserve deterministic JSON output where currently supported. |
| `failOnViolation` | Preserve current semantics. |
| Deterministic reports | Preserve deterministic report payloads suitable for automation and AI workflows. |
| Error messages | Keep existing deterministic guidance messages where tests/users may rely on them, especially for snapshot/drift workflows. |

## AI Handoff Compatibility

AI workflows are a differentiating part of the current package and must remain stable while Core extraction proceeds.

Compatibility expectations:

- payload files remain deterministic
- prompt files remain deterministic
- current AI artifact paths remain stable
- existing AI target names remain stable
- snapshot-backed AI workflows continue to resolve snapshots as they do today
- PR-impact workflows preserve current `baseRef` / `headRef` conventions
- any future AI package extraction must keep the Nx host behavior compatible

## What May Change Internally During #218

The following may change internally as long as public behavior remains stable:

- `run-governance.ts` may be decomposed.
- policy evaluation may move behind a Core rule engine boundary.
- metric and health calculation may move behind Core contracts.
- Nx graph loading may move behind an Nx adapter boundary.
- extension contracts may move toward Core-owned contracts.
- filesystem storage may move behind host storage utilities.
- AI request builders may move behind Core or AI package contracts.
- profile loading may be split into profile model and host-specific file resolution.

## What Must Not Change During #218 Without Explicit Migration

The following must not change during #218 unless a separate breaking-change issue and migration plan is created:

- public Nx target names
- public executor ids
- public generator names
- existing target option names
- default profile name `frontend-layered`
- `layered-workspace` compatibility alias where currently supported
- profile file location convention
- snapshot artifact location
- AI handoff artifact location
- graph output defaults
- init generator additive/non-destructive behavior
- explicit target precedence over inferred targets

## Compatibility Implications for #218

#218 should be implemented behind the existing Nx host surface.

Before merging #218 work, verify:

- existing executor tests still pass
- existing generator tests still pass
- profile loading tests still pass
- Project Crystal inference tests still pass
- snapshot/drift tests still pass
- AI handoff tests still pass
- public target names remain unchanged
- generated target options remain unchanged unless explicitly planned

## Compatibility Implications for #219

#219 may replace the current extension discovery model, but must avoid breaking existing Nx Governance users unexpectedly.

Recommended compatibility stance:

- introduce explicit governance extension registration as the primary model
- keep current behavior only as a transitional compatibility layer if still needed
- missing optional extensions should be skipped gracefully
- installed extensions that fail during registration should fail clearly
- Nx capabilities should be passed through context rather than direct extension dependency on Nx adapter types

## Compatibility Implications for #220 and #221

#220 and #221 introduce new non-Nx surfaces. They should not require changes to the stable Nx surface.

Compatibility expectations:

- CLI defaults should not redefine Nx defaults implicitly
- TypeScript adapter behavior should not alter Nx adapter behavior
- Core contracts should support both without making Nx users migrate immediately

## Deferred Compatibility Decisions

The following are not decided here:

- whether `governance-graph` should later be inferred by Project Crystal
- whether snapshot/drift/AI targets should later be inferred
- whether profile file locations should eventually become configurable outside Nx
- whether explicit root targets should eventually be reduced by init defaults
- whether future package names require migration notices
- whether a future major version changes profile schema
- whether extension registration eventually moves from `nx.json` to a separate governance config file

## Acceptance Check for #230

- [x] Existing Nx Governance user-facing behavior is listed and classified.
- [x] #218 has clear guardrails against accidental breaking changes.
- [x] Nx plugin host responsibilities are separated from Governance Core responsibilities.
- [x] Project Crystal inference behavior is preserved or any intended changes are explicitly deferred.
- [x] Init generator compatibility expectations are documented.
