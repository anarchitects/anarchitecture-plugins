# Internal Governance Core Boundary Implementation

## Purpose

This document records the implemented internal Governance Core boundary after
#218 and supports package split readiness decisions for `@anarchitects/nx-governance`.

This is implemented-state documentation. It describes what is currently in the
repo after the #241-#254 slices, not only the target architecture from the
runway docs.

This issue does not refactor code, move files, split packages, change exports,
or change runtime behavior.

## Implemented Boundary Summary

The implemented internal Core boundary now exists primarily in
`packages/governance/src/core`, with compatibility shims and host wiring still
around it.

What is actually implemented today:

- Workspace, project, dependency, ownership, violation, measurement, health,
  assessment, snapshot, drift, and AI request/result contracts now live under
  `packages/governance/src/core/models.ts`.
- Signal contracts were re-homed under `packages/governance/src/core/signals.ts`.
  `packages/governance/src/core` no longer imports signal types from
  `packages/governance/src/signal-engine`.
- Adapter result, capability, and diagnostic contracts now live under
  `packages/governance/src/core/adapter.ts`.
- Rule engine contracts and execution flow now live under
  `packages/governance/src/core/rules.ts` and
  `packages/governance/src/core/rule-engine.ts`.
- The built-in rule pack now exists under `packages/governance/src/core` with
  pack id `core`. The implemented built-in rules are:
  `domain-boundary`, `layer-boundary`, `ownership-presence`,
  `project-name-convention`, `tag-convention`, `missing-domain`, and
  `missing-layer`.
- The migrated built-in boundary and ownership rules are implemented in
  `packages/governance/src/core/built-in-rules.ts`. `packages/governance/src/policy-engine`
  is now a compatibility wrapper that delegates to
  `evaluateCoreBuiltInPolicyViolations`.
- Generic convention and metadata rules are implemented, but only for
  `project-name-convention`, `tag-convention`, `missing-domain`, and
  `missing-layer`. `project-root-convention` and documentation/metadata
  presence rules are not implemented in the current code.
- Profile normalization now maps the current runtime profile shape into
  normalized rule configuration in `packages/governance/src/core/profile.ts`.
  The migrated compatibility mapping currently auto-populates normalized
  configuration for `domain-boundary`, `layer-boundary`, and
  `ownership-presence`, preserves scoring thresholds/weights, and carries
  compatibility metadata such as `boundaryPolicySource`.
- Deterministic assessment/result assembly now lives under
  `packages/governance/src/core/assessment.ts`, including signal breakdown,
  metric breakdown, top issue assembly, and report-type filtering.
- Snapshot and drift contracts now live under `packages/governance/src/core`,
  with pure snapshot building in `core/snapshots.ts` and pure comparison/drift
  logic in `core/drift.ts`.
- AI-ready contracts now exist in `core/models.ts`, and core-owned AI handoff
  payload builders now exist in `core/ai.ts` for `root-cause`, `drift`,
  `pr-impact`, and `scorecard`.
- Diagnostics and capability contracts are implemented in `core/adapter.ts`.
- `packages/governance/src/inventory` no longer consumes Nx adapter snapshot
  types directly. It now consumes the core-owned
  `GovernanceWorkspaceAdapterResult`.
- `packages/governance/src/nx-adapter/to-governance-workspace-adapter-result.ts`
  now maps `AdapterWorkspaceSnapshot` into the core-owned adapter result shape
  before inventory normalization.

What is not fully inside the clean Core boundary yet:

- `packages/governance/src/signal-engine/builders.ts` still builds graph and
  conformance signals directly from `WorkspaceGraphSnapshot` and
  `ConformanceSnapshot`.
- `packages/governance/src/extensions/contracts.ts` still exposes
  `AdapterWorkspaceSnapshot` in extension context.
- `packages/governance/src/plugin/run-governance.ts` still owns Nx host
  orchestration, reporting selection, snapshot persistence, drift workflows, AI
  workflow orchestration, and extension registration.
- `packages/governance/src/ai-analysis` and
  `packages/governance/src/reporting` remain outside `src/core` even though
  they operate on Core contracts.

## Current Module Ownership

| Area/path                                | Current owner boundary | Notes                                                                                                                                                                                                                            |
| ---------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/governance/src/core`           | `core`                 | Owns the implemented contracts and deterministic logic for signals, adapter results, rule execution, built-in rules, profile normalization, assessment assembly, snapshots, drift, exceptions, and AI handoff payload contracts. |
| `packages/governance/src/policy-engine`  | `core-engine`          | Thin compatibility wrapper over `evaluateCoreBuiltInPolicyViolations`; no longer owns separate policy semantics.                                                                                                                 |
| `packages/governance/src/signal-engine`  | `still-mixed`          | Signal type contracts now come from Core, but signal builders still depend on conformance and Nx graph snapshot inputs.                                                                                                          |
| `packages/governance/src/metric-engine`  | `core-engine`          | Deterministic metric aggregation over `GovernanceWorkspace` and `GovernanceSignal`; Nx-free, but still imports the signal barrel.                                                                                                |
| `packages/governance/src/health-engine`  | `core-engine`          | Deterministic health scoring, explainability, and recommendations over Core contracts.                                                                                                                                           |
| `packages/governance/src/inventory`      | `core-adjacent`        | Normalizes the core-owned adapter result into `GovernanceWorkspace`; no longer imports Nx adapter snapshot types.                                                                                                                |
| `packages/governance/src/nx-adapter`     | `nx-adapter`           | Reads Nx graph/workspace/CODEOWNERS data and maps adapter snapshots into the core-owned adapter result contract.                                                                                                                 |
| `packages/governance/src/plugin`         | `nx-host`              | Owns `createNodesV2`, runtime orchestration, exception application, conformance wiring, and remaining host concerns in `run-governance.ts`.                                                                                      |
| `packages/governance/src/executors`      | `nx-host`              | Public executor ids and compatibility wrappers for the Nx plugin surface.                                                                                                                                                        |
| `packages/governance/src/generators`     | `nx-host`              | Public generator surface and additive workspace setup behavior.                                                                                                                                                                  |
| `packages/governance/src/reporting`      | `reporting-renderer`   | CLI/JSON renderers for `GovernanceAssessment`; deterministic formatting, but still host output rather than Core ownership.                                                                                                       |
| `packages/governance/src/snapshot-store` | `host-storage`         | Filesystem persistence, git metadata inference, and workspace-root-relative snapshot storage.                                                                                                                                    |
| `packages/governance/src/drift-analysis` | `core-adjacent`        | Physical folder remains outside Core, but current implementation is only a shim re-export of `core/drift.ts`.                                                                                                                    |
| `packages/governance/src/ai-analysis`    | `deferred`             | Deterministic AI request builders and summarizers over Core contracts; current code is pure, but long-term package ownership is still undecided.                                                                                 |
| `packages/governance/src/ai-handoff`     | `ai-host-output`       | Writes AI payload/prompt artifacts under workspace-local output paths.                                                                                                                                                           |
| `packages/governance/src/extensions`     | `still-mixed`          | Contracts and host remain Nx-coupled through `AdapterWorkspaceSnapshot`, `@nx/devkit`, `nx.json` discovery, and plugin probing.                                                                                                  |

## Import Boundary Status

Core-facing modules that are currently Nx-free:

- `packages/governance/src/core`
- `packages/governance/src/policy-engine`
- `packages/governance/src/metric-engine`
- `packages/governance/src/health-engine`
- `packages/governance/src/inventory`

Factual current status:

- The `core -> signal-engine` dependency has been removed. `src/core` now owns
  signal contracts in `core/signals.ts`, and internal Core imports point at
  `./signals.js`.
- The `inventory -> nx-adapter/types` dependency has been removed.
  `buildInventory` now accepts `GovernanceWorkspaceAdapterResult` from
  `src/core`, and the Nx adapter performs snapshot-to-adapter-result mapping in
  `to-governance-workspace-adapter-result.ts`.
- Remaining allowed or temporary boundary exceptions still exist:
  - `packages/governance/src/signal-engine/builders.ts` imports
    `../conformance-adapter/conformance-adapter.js` and
    `../nx-adapter/graph-adapter.js`.
  - `packages/governance/src/extensions/contracts.ts` still depends on
    `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js`.
  - `packages/governance/src/extensions/contracts.ts` still imports
    `GovernanceSignal` from `../signal-engine/index.js` instead of the Core
    barrel.
  - `packages/governance/src/extensions/host.ts` still imports `@nx/devkit`,
    reads `nx.json`, and probes installed Nx plugins for
    `governance-extension`.
- Extension contracts were not fully decoupled from Nx adapter types in these
  slices. That work is still left for #219.
- `packages/governance/src/plugin/run-governance.ts` still contains host
  orchestration concerns. It imports `@nx/devkit` logger/workspace root,
  runtime profile loading, Nx workspace loading, inventory normalization,
  reporting, snapshot storage, drift analysis, AI request/handoff flows,
  extension registration, and host-side process/file operations.

## Behavior Preserved

Current compatibility that remains preserved:

- Public Nx target names remain:
  `repo-health`, `repo-boundaries`, `repo-ownership`, `repo-architecture`,
  `repo-snapshot`, `repo-drift`, `repo-ai-root-cause`, `repo-ai-drift`,
  `repo-ai-pr-impact`, `repo-ai-cognitive-load`, `repo-ai-recommendations`,
  `repo-ai-smell-clusters`, `repo-ai-refactoring-suggestions`,
  `repo-ai-scorecard`, `repo-ai-onboarding`, `workspace-graph`,
  `workspace-conformance`, and `governance-graph`.
- Public executor ids remain the same ids defined in
  `packages/governance/src/index.json`.
- Public generator names remain `init` and `eslint-integration`.
- Runtime profile location remains
  `tools/governance/profiles/<profile-name>.json`.
- The default runtime profile remains `frontend-layered`.
- The legacy `layered-workspace` alias is still supported when
  `frontend-layered` falls back to an existing runtime profile file with the
  legacy name.
- Project Crystal `createNodesV2` still infers only `repo-health`,
  `repo-boundaries`, `repo-ownership`, and `repo-architecture`, attaches them
  to the root project, prefers `frontend-layered` when present, and leaves
  explicit targets authoritative.
- Snapshot output remains under `.governance-metrics/snapshots`.
- AI handoff artifacts remain under `.governance-metrics/ai`, including
  deterministic `*.payload.json` and `*.prompt.md` files.
- Governance graph output defaults remain `dist/governance/graph.html` and
  `dist/governance/graph.json`.
- The init generator remains additive and idempotent. It preserves existing
  targets when present, avoids duplicate plugin registration, and seeds runtime
  profile files without broad destructive rewrites.
- CLI and JSON report compatibility is still exercised by the reporting specs.

## Test Coverage Added

Relevant coverage that now protects the internal Core boundary:

- Nx-independent Core fixtures:
  `packages/governance/src/core/core-fixture-coverage.spec.ts`
- Signal contract coverage:
  `packages/governance/src/core/core-fixture-coverage.spec.ts`
- Adapter result contract tests:
  `packages/governance/src/nx-adapter/to-governance-workspace-adapter-result.spec.ts`
- Rule engine tests:
  `packages/governance/src/core/rule-engine.spec.ts`
- Boundary and ownership rule tests:
  `packages/governance/src/core/built-in-rules.spec.ts`
- Profile normalization tests:
  `packages/governance/src/core/profile.spec.ts`
- Convention and metadata rule tests:
  `packages/governance/src/core/built-in-rules.spec.ts`
- Assessment/result assembly tests:
  `packages/governance/src/core/assessment.spec.ts`
- Snapshot/drift tests:
  `packages/governance/src/core/snapshots.spec.ts` and
  `packages/governance/src/core/drift.spec.ts`
- AI payload tests:
  `packages/governance/src/core/ai.spec.ts`
- Inventory normalization from the Core-owned adapter result:
  `packages/governance/src/inventory/build-inventory.spec.ts`
- Executor compatibility tests:
  `packages/governance/src/executors/report-executors.spec.ts`,
  `packages/governance/src/executors/repo-snapshot/executor.spec.ts`,
  `packages/governance/src/executors/repo-drift/executor.spec.ts`,
  `packages/governance/src/executors/governance-graph/executor.spec.ts`
- Nx host compatibility tests:
  `packages/governance/src/plugin/index.spec.ts`,
  `packages/governance/src/generators/init/generator.spec.ts`,
  `packages/governance/src/reporting/rendering.spec.ts`,
  `packages/governance/src/ai-handoff/index.spec.ts`

## Package Split Readiness

- [x] Core contracts are internally stable. The Core contract surface now has
      working tests for signals, adapter results, rule execution, profile
      normalization, assessment assembly, snapshots, drift, exceptions, and AI
      payload builders. Public extracted package naming is still deferred.
- [x] Core-facing modules are free of Nx imports. `src/core`,
      `policy-engine`, `metric-engine`, `health-engine`, and `inventory` do not
      import `@nx/*`.
- [ ] Core-facing modules are free of Nx adapter snapshot imports.
      `signal-engine/builders.ts` still consumes `WorkspaceGraphSnapshot`, and
      `extensions/contracts.ts` still exposes `AdapterWorkspaceSnapshot`.
- [ ] Nx adapter boundary is stable. The core-owned adapter result exists and
      is tested, but not every consumer uses it yet.
- [x] Nx host/executor compatibility is verified. Executor, generator, Project
      Crystal inference, graph output, reporting, snapshot, drift, and AI handoff
      compatibility all have current spec coverage.
- [ ] Extension Host v2 contracts are ready or scheduled. #219 is scheduled,
      but current extension contracts and discovery are still Nx-coupled.
- [ ] CLI MVP proves non-Nx execution. Not implemented.
- [ ] TypeScript adapter proves non-Nx source discovery. Not implemented.
- [ ] Build/export/release implications are designed. There is no implemented
      split-specific export map, build graph, or release plan yet.
- [ ] Package split can be implemented mechanically. Remaining boundary leaks
      and host packaging decisions still require follow-up work.

## Remaining Work Before Physical Package Split

- Implement #219 Extension Host v2 so extension contracts stop depending on
  `AdapterWorkspaceSnapshot` and Nx plugin probing.
- Implement #220 standalone CLI MVP to prove that Governance Core can execute
  outside the Nx host.
- Implement #221 generic TypeScript adapter to prove non-Nx workspace/source
  discovery.
- Finish moving remaining signal-builder inputs behind a clean Core-owned
  adapter or host contract, or explicitly keep those builders outside the Core
  extraction set.
- Decide long-term ownership of `packages/governance/src/ai-analysis` and
  `packages/governance/src/reporting`.
- Design extracted package entrypoints, export maps, and final public type
  names.
- Design build, test, release, and versioning workflow for separate packages.
- Add a package-level integration matrix across future Core, Nx adapter, Nx
  host, and CLI packages.
- Retarget supporting documentation once package names and ownership settle.

## Known Deferred Decisions

- Exact package split timing.
- Final public type names.
- Export map structure.
- Whether AI request/payload builders move to a future `governance-ai`
  package.
- Whether renderers move to a future `governance-reporting` package.
- Long-term CODEOWNERS ownership mapping location.
- Extension registration location.
- CLI profile and config conventions.
- Long-term ownership of graph/conformance signal builders.

## Acceptance Check for #255

- [x] Implemented internal Core boundary is documented.
- [x] Remaining mixed or host-owned areas are documented.
- [x] Package split readiness is assessed.
- [x] Existing Nx compatibility is summarized.
- [x] Remaining work before physical package split is explicit.
- [x] No implementation behavior is changed.
