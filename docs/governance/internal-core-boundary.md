# Internal Core Boundary

## Purpose

This document establishes the **internal Core boundary** for
`@anarchitects/nx-governance` without splitting the package or changing runtime
behavior.

It is a preparation step for later extraction work. It does **not**:

- extract a new package
- refactor the Nx adapter
- change executors, generators, or `createNodesV2`
- change reporting, snapshot, AI handoff, graph, or profile behavior

## Internal Boundary Summary

Within the current package, the future platform-independent Core candidate
surface is:

- `packages/governance/src/core`
- `packages/governance/src/policy-engine`
- `packages/governance/src/signal-engine`
- `packages/governance/src/metric-engine`
- `packages/governance/src/health-engine`
- `packages/governance/src/inventory`

These folders are the current candidates for later extraction into
`@anarchitects/governance-core`.

The following folders stay **outside** the internal Core boundary:

- `packages/governance/src/nx-adapter`
- `packages/governance/src/plugin`
- `packages/governance/src/executors`
- `packages/governance/src/generators`

Related current runtime areas also remain outside the internal Core boundary for
now:

- `packages/governance/src/conformance-adapter`
- `packages/governance/src/reporting`
- `packages/governance/src/snapshot-store`
- `packages/governance/src/drift-analysis`
- `packages/governance/src/ai-analysis`
- `packages/governance/src/ai-handoff`

## What Belongs In Core

Core-facing modules should own or converge toward:

- governance contracts and result models
- profile contracts and profile-derived rule inputs
- policy evaluation
- signal modeling and deterministic signal/result shaping
- metric calculation
- health scoring and recommendations
- workspace inventory normalization into platform-independent shapes

## What Must Stay Outside Core

The future Core must not own:

- Nx project graph loading
- Nx workspace discovery
- Project Crystal `createNodesV2`
- executors
- generators
- Nx logger, `workspaceRoot`, and `ExecutorContext` behavior
- root-target compatibility behavior
- filesystem/process orchestration that exists only to serve the Nx plugin host

## Allowed Dependencies For Core-Facing Modules

Core-facing modules should depend only on:

- other Core-facing candidate folders when the dependency is still part of the
  current in-package boundary
- stable governance contracts that are expected to move with Core later
- Node standard library where the logic is still deterministic and
  platform-independent

Core-facing modules should avoid importing from non-Core runtime folders even
when the current package still allows it.

## Forbidden Dependencies For Core-Facing Modules

Core-facing modules must not introduce new dependencies on:

- `@nx/devkit`
- `nx`
- `@nx/*`
- `../plugin`
- `../plugin/*`
- `../executors`
- `../executors/*`
- `../generators`
- `../generators/*`
- direct Project Crystal APIs
- direct Nx workspace or project-graph APIs
- direct Nx logger/output behavior
- direct host-only `process.stdout` / stderr orchestration

Additional boundary rule for later cleanup:

- `core` contracts should not permanently depend on derived `signal-engine`,
  `conformance-adapter`, or Nx adapter shapes

## Current Folder Ownership

| Folder              | Current role                                                                                       | Internal boundary classification                    |
| ------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/core`          | governance contracts, profiles, exceptions, assessment/result models                               | core-candidate                                      |
| `src/policy-engine` | deterministic policy evaluation over normalized workspace input                                    | core-candidate                                      |
| `src/signal-engine` | signal contracts and mapping from current graph/conformance/policy inputs                          | core-candidate with temporary adapter-shaped inputs |
| `src/metric-engine` | deterministic metric aggregation and scoring inputs                                                | core-candidate                                      |
| `src/health-engine` | health score, explainability, recommendations                                                      | core-candidate                                      |
| `src/inventory`     | normalization from adapter snapshot into `GovernanceWorkspace`                                     | core-candidate with temporary adapter dependency    |
| `src/nx-adapter`    | Nx graph and workspace loading, CODEOWNERS mapping, adapter snapshot types                         | future Nx adapter                                   |
| `src/plugin`        | Nx host orchestration, conformance resolution, extension registration, runtime output coordination | Nx plugin host                                      |
| `src/executors`     | public Nx executor entrypoints and compatibility surface                                           | Nx plugin host                                      |
| `src/generators`    | public Nx generator entrypoints and compatibility surface                                          | Nx plugin host                                      |

## Known Temporary Boundary Violations

These are intentionally left in place in #241 and must be removed by follow-up
issues rather than fixed opportunistically here.

| File                                                   | Current dependency                              | Why it violates the boundary                                                                     | Follow-up |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------- |
| `packages/governance/src/core/models.ts`               | `../signal-engine/types.js`                     | core contracts currently depend on signal types defined outside `core`                           | `#242`    |
| `packages/governance/src/core/exceptions.ts`           | `../conformance-adapter/conformance-adapter.js` | core exception contracts depend on conformance category types outside `core`                     | `#242`    |
| `packages/governance/src/signal-engine/types.ts`       | `../conformance-adapter/conformance-adapter.js` | signal contracts still reuse conformance category types instead of Core-owned category contracts | `#242`    |
| `packages/governance/src/signal-engine/builders.ts`    | `../conformance-adapter/conformance-adapter.js` | signal-building logic still consumes conformance adapter shapes directly                         | `#248`    |
| `packages/governance/src/signal-engine/builders.ts`    | `../nx-adapter/graph-adapter.js`                | signal-building logic still consumes Nx adapter graph snapshot types directly                    | `#248`    |
| `packages/governance/src/inventory/build-inventory.ts` | `../nx-adapter/types.js`                        | inventory normalization still takes adapter-shaped workspace snapshots directly                  | `#248`    |

## Guardrail Enforcement In This Package

The package lint config now enforces a lightweight import guardrail for
Core-facing candidate folders.

Current guardrail intent:

- block new imports from Nx packages in Core-facing candidate folders
- block new imports from `plugin`, `executors`, and `generators`
- block new `nx-adapter` imports in Core-facing folders that do not already
  have a documented temporary exception
- block new `signal-engine` / `conformance-adapter` imports from `core`
  except for documented temporary exceptions

Current guardrail limits:

- it is import-based, not full architectural analysis
- it does not replace later extraction work
- it does not yet rewrite the existing temporary violations above

## Follow-Up Issue Ownership

This document leaves the next steps to the later extraction issues:

- `#242`
  - move shared contracts/types fully under `core`
  - remove current `core` and `signal-engine` contract leaks
- `#247`
  - isolate Nx host orchestration concerns more cleanly from Core-facing logic
  - keep public Nx runtime behavior stable while boundaries tighten
- `#248`
  - replace adapter-shaped inputs with an internal workspace adapter contract
  - remove current `inventory` and `signal-engine` dependencies on Nx adapter
    and conformance adapter shapes
- `#249`
  - preserve and codify Nx plugin compatibility surfaces while later extraction
    work proceeds

## Non-Goals For #241

This boundary document does **not** do any of the following:

- no package split
- no executor rename
- no generator rename
- no schema changes
- no inference changes
- no runtime output changes
- no adapter refactor
- no Extension Host v2
- no CLI support
