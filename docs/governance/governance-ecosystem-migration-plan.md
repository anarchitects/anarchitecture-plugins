# Governance Ecosystem Migration Plan

## Purpose

This document defines the migration phases and sequencing for evolving the current `@anarchitects/nx-governance` package into a Governance Core / Adapter / Extension ecosystem without a big-bang rewrite.

It implements #232 and provides sequencing guidance for #218, #219, #220, and #221.

This is a documentation-only plan. It does not move files, create packages, change exports, change runtime behavior, implement adapters, or implement the CLI.

## Migration Goal

Move from the current Nx-centered package toward a modular Governance ecosystem with:

- a platform-independent Governance Core
- a dedicated Nx workspace adapter
- a backward-compatible Nx plugin host
- explicit framework/language extensions
- a standalone CLI
- future non-Nx adapters, starting with a generic TypeScript adapter

The key migration constraint is stability: existing Nx Governance users must keep their current targets, profile conventions, generated configuration, artifact paths, and AI handoff behavior while internals are reorganized.

## Guiding Principles

1. **Architecture before implementation** — complete the #217 architecture runway before moving code.
2. **Internal boundaries before package split** — avoid package/build/release churn while boundaries are still being validated.
3. **Preserve the Nx host surface** — `@anarchitects/nx-governance` remains the user-facing Nx plugin.
4. **Core becomes platform-independent** — Core must not import Nx or host-specific concerns.
5. **Adapters provide workspace facts** — adapters map workspace/tooling data into Core contracts.
6. **Extensions add intelligence** — framework/language-specific rules and signals come through extension contracts.
7. **Profiles drive behavior** — rules, severities, thresholds, conventions, scoring, and extension options are profile-driven.
8. **Tests protect behavior before movement** — do not move logic without tests that prove existing behavior remains stable.
9. **Doc-only architecture PRs stay separate from implementation PRs** — each architecture decision should remain reviewable.
10. **Package split is a readiness milestone, not the first implementation step**.

## Phase Overview

| Phase | Name | Main output | Related issues |
|---|---|---|---|
| 1 | Architecture runway | Architecture documents and decisions | #217, #225, #226, #227, #228, #229, #230, #231, #232 |
| 2 | Internal core isolation | Core-facing internal boundary and tests | #218 |
| 3 | Adapter boundary | Internal workspace adapter contract and Nx adapter boundary | #218, #228 |
| 4 | Extension Host v2 | Nx-independent extension contracts and explicit registration | #219, #229 |
| 5 | Standalone CLI MVP | Non-Nx host proving Core can run outside Nx | #220 |
| 6 | Generic TypeScript adapter | First real non-Nx source-code adapter | #221 |
| 7 | Package split readiness | Physical package split after stable boundaries/tests | Follow-up issue after #218-#221 |

## Phase 1: Architecture Runway

### Objective

Complete the architecture documents and decisions needed before implementation starts.

### Scope

- Audit current package responsibilities.
- Define target package model and dependency direction.
- Define Core contracts, rule taxonomy, and profile-driven configuration model.
- Define workspace adapter contract and Nx adapter scope.
- Define Extension Host v2 and capability model.
- Define Nx Governance compatibility contract.
- Define sequencing and package split readiness.
- Reframe implementation epics against the target architecture.

### Inputs

- current `packages/governance` implementation
- current governance docs
- #217 epic body
- #225 current-state audit
- #226 target package architecture
- #230 compatibility contract

### Outputs

- `docs/governance/governance-core-current-state-audit.md`
- `docs/governance/governance-target-package-architecture.md`
- `docs/governance/nx-governance-compatibility-contract.md`
- `docs/governance/governance-ecosystem-migration-plan.md`
- later documents from #227, #228, #229, and #231

### Done when

- #225, #226, #230, and #232 are merged.
- #227, #228, and #229 have a clear place in Iteration 5.
- #231 is intentionally deferred until #227-#229 are complete.

## Phase 2: Internal Core Isolation

### Objective

Create an internal platform-independent Core boundary inside the current package before any physical package split.

### Related issue

- #218

### Scope

- Establish internal Core-facing module boundaries.
- Classify and stabilize core contracts.
- Remove obvious Core import leaks.
- Add Nx-independent tests around Core logic.
- Preserve existing Nx executor/generator behavior.

### Candidate modules/concepts to isolate

- workspace/project/dependency models
- profile contracts
- violation/signal/measurement contracts
- rule engine contracts
- built-in generic rule families
- policy evaluation
- metric calculation
- health/scoring
- deterministic assessment/report data
- snapshot/drift contracts
- AI-ready request/result contracts
- exception model

### Key boundary fixes

- Core-facing models should not import from non-core implementation modules.
- Signal contracts should become Core-owned or part of a clearly Core-owned signal module.
- Extension contracts should not import Nx adapter types.
- Generic inventory/normalization should not depend on Nx-specific adapter snapshot types.
- Filesystem persistence and artifact writing should remain host/output concerns.

### Test requirements

Before moving substantial logic, add or preserve tests for:

- built-in policy evaluation
- metric calculation
- health/scoring
- profile loading/normalization behavior
- violations/signals/measurements
- deterministic report model output
- snapshot/drift contracts where applicable

### Compatibility constraints

- No public target name changes.
- No executor/generator schema changes unless explicitly planned.
- Existing profile files must keep working.
- Existing artifact paths must remain stable.
- Existing AI handoff behavior must remain stable.

### Exit criteria

- A Core boundary exists internally.
- Core-facing modules can be tested without Nx APIs.
- Existing Nx Governance behavior remains compatible.
- #218 can continue toward adapter isolation without architectural ambiguity.

## Phase 3: Workspace Adapter Boundary

### Objective

Introduce a workspace adapter contract and move Nx graph loading behind the Nx adapter boundary.

### Related issues

- #218
- #228

### Scope

- Define or implement an internal `WorkspaceAdapter` contract.
- Decide whether adapter internals produce an intermediate snapshot or directly produce `GovernanceWorkspace`.
- Keep any intermediate Nx snapshot type private to the Nx adapter if possible.
- Ensure Core receives platform-independent workspace/project/dependency data.
- Introduce adapter diagnostics if needed.
- Introduce adapter-provided capabilities such as `capability:nx`.

### Nx adapter responsibilities

- Load Nx project graph.
- Read Nx project tags and metadata.
- Map Nx projects to Core project model.
- Map Nx dependencies to Core dependency model.
- Preserve current CODEOWNERS-derived ownership behavior initially if needed.
- Contribute Nx capability/context for extensions and reports.

### Core responsibilities

- Own the adapter contract.
- Own the canonical workspace/project/dependency model.
- Own rule evaluation against the normalized workspace model.
- Avoid importing Nx adapter types.

### Compatibility constraints

- Current Nx project graph interpretation should remain stable.
- Current tag and metadata mapping should remain stable.
- CODEOWNERS behavior should remain stable during initial extraction.

### Exit criteria

- Core can operate on a workspace model independent of Nx.
- Nx graph loading is isolated behind the adapter boundary.
- Existing Nx reports still produce compatible results.

## Phase 4: Extension Host v2

### Objective

Replace the current Nx-coupled extension discovery and contract model with explicit, Core-owned extension contracts and capability-based context.

### Related issues

- #219
- #229

### Scope

- Move stable extension contracts to Core.
- Remove dependency on Nx adapter snapshot types from extension context.
- Introduce a capability registry/context model.
- Define explicit extension registration.
- Distinguish required, optional, missing, and failing extensions.
- Preserve current behavior where needed during transition.

### Extension contribution types

- workspace enrichers
- rule packs
- signal providers
- metric providers
- presets
- diagnostics

### Capability examples

- `capability:nx`
- `capability:typescript`
- `capability:package-manager`
- `capability:angular`
- future JVM/PHP/framework capabilities

### Compatibility constraints

- Existing Nx Governance users should not be surprised by missing optional extensions.
- Installed extensions that fail should produce clear errors.
- Generic framework extensions should not directly depend on Nx.

### Exit criteria

- Extension contracts are Nx-independent.
- Extension registration is explicit.
- Extensions consume capabilities rather than adapter internals.
- #219 can be implemented without changing Core again for every extension type.

## Phase 5: Standalone Governance CLI MVP

### Objective

Prove that Governance Core can run outside Nx.

### Related issue

- #220

### Scope

- Add a standalone CLI host.
- Use a deliberately small manual YAML/JSON workspace input adapter.
- Load profiles from CLI-provided paths.
- Run Core checks without Nx.
- Produce deterministic JSON output.
- Produce basic human-readable output.
- Return CI-friendly exit codes.

### Non-goals

- No TypeScript source import graph analysis in the CLI MVP.
- No package-manager workspace discovery in the CLI MVP.
- No framework-specific rules unless already available through explicit extensions.
- No change to existing Nx Governance targets.

### Compatibility constraints

- CLI defaults should not redefine Nx defaults implicitly.
- CLI behavior must not require migration for Nx users.
- Core result/severity semantics should be shared with Nx host.

### Exit criteria

- Governance can run outside Nx.
- CLI proves Core independence.
- Manual workspace input validates the Core model.
- #221 can build a real non-Nx source-code adapter on top.

## Phase 6: Generic TypeScript Adapter

### Objective

Introduce the first real non-Nx source-code adapter.

### Related issue

- #221

### Scope

- Detect package-manager workspaces.
- Parse `package.json` workspaces.
- Parse `pnpm-workspace.yaml` where needed.
- Parse npm/yarn workspace conventions where needed.
- Parse `tsconfig` path aliases.
- Discover projects through configured globs.
- Infer project metadata/tags from package/path conventions where configured.
- Build a static TypeScript/JavaScript import dependency graph.
- Emit deterministic `GovernanceWorkspace` data.
- Contribute `capability:typescript` and `capability:package-manager`.

### Non-goals

- No Nx graph loading.
- No Angular/React/NestJS-specific rules directly in the adapter.
- No CLI command behavior.
- No Core rule engine changes unless gaps are found and explicitly scoped.

### Exit criteria

- Non-Nx TypeScript workspaces can be analyzed.
- The TypeScript adapter emits the same canonical Core model as the Nx adapter.
- Extensions can consume TypeScript/package-manager capabilities.

## Phase 7: Package Split Readiness

### Objective

Physically split packages only after internal boundaries and tests prove the design.

### Trigger conditions

Package split should not start until:

- Core-facing modules no longer import Nx APIs.
- Core contracts are covered by tests.
- Nx adapter boundary is stable.
- Nx host still passes compatibility tests.
- Extension Host v2 contracts are stable.
- CLI MVP validates non-Nx execution.
- Release/build/export implications are understood.

### Candidate package split order

1. `@anarchitects/governance-core`
2. `@anarchitects/governance-adapter-nx`
3. keep or rename current `@anarchitects/nx-governance` as Nx host package
4. `@anarchitects/governance-cli`
5. `@anarchitects/governance-adapter-typescript`
6. extension packages as they become real products

### Package split risks

- export map churn
- import path churn
- release configuration churn
- test configuration churn
- circular dependencies between host/adapter/core
- accidental breaking changes in the Nx plugin
- duplicated reporting/snapshot/AI code

### Exit criteria

- package split PRs are mechanical and low-risk
- public package responsibilities match the architecture docs
- existing Nx Governance behavior remains compatible

## Implementation Epic Sequencing

Recommended sequence:

```text
Iteration 4 / Current
  #225 Current-state audit
  #226 Target package model and dependency direction
  #230 Nx Governance compatibility contract
  #232 Migration phases and sequencing

Iteration 5
  #227 Platform-independent Core contracts
  #228 Workspace adapter contract and Nx adapter responsibilities
  #229 Extension Host v2 contract and capability model

Iteration 6
  #231 Reframe implementation epics against target architecture

Implementation after architecture runway
  #218 Internal Core extraction
  #219 Extension Host v2
  #220 Standalone CLI MVP
  #221 Generic TypeScript adapter
```

## Risk Management

| Risk | Mitigation |
|---|---|
| Core remains Nx-coupled | Add explicit forbidden dependencies and Nx-independent tests. |
| Package split happens too early | Require internal boundaries and tests before package extraction. |
| Existing Nx users are broken | Use #230 compatibility contract as guardrail. |
| `run-governance.ts` rewrite becomes too large | Split incrementally by extracted services and tests. |
| Extension model remains Nx-specific | Use #229/#219 capability-based design. |
| AI/snapshot/reporting concerns are misplaced | Separate contracts from host artifact writing/rendering. |
| TypeScript adapter scope expands too much | Keep #220 CLI MVP manual; defer source analysis to #221. |
| Profile model breaks existing users | Provide compatibility mapping from current profiles to new rule config. |

## Rollback Strategy

Architecture PRs are documentation-only and can be reverted independently.

Implementation PRs should be structured so that:

- public Nx behavior remains behind existing executors/generators
- new internal Core services are introduced behind current call paths
- each extraction has tests before and after the move
- package split is delayed until low-risk
- feature flags or compatibility layers are used where necessary

If an extraction introduces instability, rollback should restore the previous internal implementation while keeping the architecture documents as target direction unless the architecture itself is proven wrong.

## Acceptance Check for #232

- [x] The migration is incremental and avoids a big-bang rewrite.
- [x] #218, #219, #220, and #221 are placed in an explicit sequence.
- [x] Package split readiness criteria are documented.
- [x] Existing Nx Governance behavior remains protected throughout the plan.
- [x] The plan identifies where tests must be added before moving code.
