# Governance Implementation Epic Alignment

## Purpose

This document reframes the implementation epics #218, #219, #220, and #221 against the target Governance Core / Adapter / Extension architecture.

It implements #231 and translates the architecture runway from #217 into clear implementation boundaries, sequencing, dependencies, and non-goals.

This is a documentation-only alignment document. It does not update implementation code, move files, create packages, change runtime behavior, or implement any epic.

## Architecture Inputs

This alignment is based on:

- #225 — current-state audit
- #226 — target package architecture
- #227 — platform-independent Core contracts
- #228 — workspace adapter contract
- #229 — Extension Host v2 contract
- #230 — Nx Governance compatibility contract
- #232 — ecosystem migration plan

## Overall Sequencing

Recommended sequence:

```text
1. #218 — Extract platform-independent Governance Core internally
2. #219 — Introduce Extension Host v2 and capability-based extension context
3. #220 — Add standalone Governance CLI MVP
4. #221 — Add generic TypeScript workspace adapter
```

The package split should remain deferred until after internal boundaries, tests, and non-Nx execution have been proven.

## Cross-Epic Dependency Graph

```text
#217 architecture runway
  -> #218 Core extraction
       -> #219 Extension Host v2
       -> #220 CLI MVP
            -> #221 TypeScript adapter
```

More specifically:

- #218 depends on #225, #226, #227, #228, #230, and #232.
- #219 depends on #227, #228, and #229.
- #220 depends on enough of #218 to run Core outside Nx.
- #221 depends on #220 and #228.

## Shared Constraints for All Implementation Epics

All implementation epics must preserve the Nx Governance compatibility contract from #230.

Do not break:

- public Nx target names
- executor ids
- generator names
- existing profile file locations
- default profile `frontend-layered`
- `layered-workspace` compatibility alias where currently supported
- Project Crystal inferred report targets
- snapshot artifact paths
- AI handoff artifact paths
- graph output defaults
- init generator additive/non-destructive behavior

All implementation should favor:

- internal boundaries before package split
- small PRs with tests
- compatibility layers for current profiles
- deterministic output
- host-owned filesystem/output behavior
- Core free of Nx, CLI, framework, package-manager, and source-analysis APIs

## #218 — Extract Platform-Independent Governance Core

### Reframed Goal

Extract a platform-independent Governance Core boundary inside the current package first, without immediately splitting packages.

#218 should make Core testable and runnable without Nx APIs while preserving the existing Nx plugin surface.

### Primary Responsibilities

#218 should own:

- internal Core boundary creation
- Core domain models
- Core profile/rule/violation/signal/measurement contracts
- built-in generic rule families
- policy evaluation behind a rule engine boundary
- metric calculation
- health/scoring
- deterministic assessment/report data contracts
- snapshot/drift contracts
- AI-ready request/result contracts where generic
- Core diagnostics contracts
- initial adapter result contract enough to decouple Core from Nx adapter types
- Nx-independent Core tests

### Explicit In Scope

- Move or re-home signal contracts so Core does not depend on non-Core implementation modules.
- Stop Core-facing contracts from importing Nx adapter snapshot types.
- Refactor `buildInventory` or its equivalent toward Core-owned adapter result contracts.
- Keep Nx adapter behavior stable while moving boundaries internally.
- Preserve existing report, snapshot, drift, graph, and AI behavior through the Nx host.
- Add compatibility mapping from current profile shape to future rule configuration where necessary.

### Explicit Out of Scope

- Physical package split.
- Standalone CLI implementation.
- TypeScript source-code adapter implementation.
- Extension Host v2 full implementation.
- Angular/React/NestJS/Maven/Gradle/PHP rule packs.
- Breaking existing Nx target names or executor schemas.
- Removing current profile compatibility.

### Key Acceptance Criteria for #218

- Core-facing modules do not import Nx APIs.
- Core-facing modules do not import Nx adapter snapshot types.
- Core contracts can be tested without Nx.
- Existing Nx Governance executor/generator tests still pass.
- Existing profile behavior remains compatible.
- Existing artifact paths remain compatible.
- Built-in generic rules run against `GovernanceWorkspace`.
- Core result model supports deterministic JSON output.

### Suggested Child Issue Breakdown

1. Introduce internal Core contract boundary.
2. Re-home signal contracts under Core boundary.
3. Define internal Core rule engine execution flow.
4. Move built-in boundary/ownership/convention/metadata/structure rules behind rule engine.
5. Introduce Core assessment/result model.
6. Introduce profile compatibility mapping layer.
7. Isolate snapshot/drift contracts from filesystem persistence.
8. Isolate AI-ready contracts from AI handoff artifact writing.
9. Introduce Core-owned adapter result type.
10. Update inventory normalization to consume Core adapter result type.
11. Add Nx-independent Core tests.
12. Verify existing Nx compatibility test surface.

## #219 — Governance Extension Host v2

### Reframed Goal

Introduce Extension Host v2 using Core-owned extension contracts, explicit governance extension registration, and capability-based context.

#219 should remove Nx adapter snapshot types from extension contracts and stop treating upstream Nx plugin packages as implicit Anarchitects governance extensions.

### Primary Responsibilities

#219 should own:

- Core-owned extension contract implementation
- explicit extension registration model
- capability registry integration
- required vs optional extension semantics
- deterministic extension ordering
- extension diagnostics
- migration from current Nx-coupled host behavior
- transitional compatibility where needed

### Explicit In Scope

- Replace extension context dependency on Nx adapter snapshot types.
- Introduce capability-based extension context.
- Let Nx adapter or Nx host contribute `capability:nx`.
- Support extension contribution types:
  - rule packs
  - workspace enrichers
  - signal providers
  - metric providers
  - presets
  - diagnostics
- Define missing optional vs missing required behavior.
- Define failing installed extension behavior.
- Support extension rule configuration via profiles.

### Explicit Out of Scope

- Implementing concrete Angular/React/NestJS/Maven/Gradle/PHP extensions.
- Implementing the TypeScript adapter.
- Rewriting Core rule engine.
- Changing public Nx executor/generator behavior.
- Removing all legacy behavior without a transition plan.

### Key Acceptance Criteria for #219

- Extension contracts are Nx-independent.
- Extension context no longer exposes Nx adapter snapshots.
- Extensions consume capabilities instead of adapter internals.
- Explicit governance extension registration is the primary model.
- Optional missing extensions are non-fatal.
- Required missing extensions fail clearly.
- Installed extension registration failures fail clearly.
- Existing successful extension contribution behavior is preserved where applicable.

### Suggested Child Issue Breakdown

1. Move/define extension contracts in Core boundary.
2. Introduce capability registry implementation.
3. Make Nx adapter/host contribute `capability:nx`.
4. Replace extension context with Core-owned context.
5. Implement explicit extension registration.
6. Implement optional/required extension semantics.
7. Implement deterministic extension ordering.
8. Implement extension diagnostics.
9. Add tests for missing optional, missing required, and failing installed extensions.
10. Add migration/deprecation note for legacy Nx plugin probing.

## #220 — Standalone Governance CLI MVP

### Reframed Goal

Add a minimal standalone CLI host that proves Governance Core can run outside Nx.

The CLI MVP should deliberately use manual YAML/JSON workspace input and should not attempt TypeScript source graph discovery.

### Primary Responsibilities

#220 should own:

- CLI command surface MVP
- manual workspace input adapter
- profile path loading for CLI runs
- invoking Core without Nx
- deterministic JSON output
- basic human-readable output
- CI-friendly exit codes
- CLI diagnostics

### Explicit In Scope

- CLI command such as `check` or `report`.
- Explicit workspace input file path.
- Explicit profile input file path.
- Manual YAML/JSON workspace model validation.
- Mapping manual input to `GovernanceWorkspace`.
- Running built-in Core rules.
- Returning non-zero exit code based on configured severity/failure rules.
- Producing deterministic JSON output.

### Explicit Out of Scope

- TypeScript import graph analysis.
- package-manager workspace discovery.
- Nx workspace support in the CLI MVP.
- framework-specific extensions unless already explicitly registered and available.
- HTML graph rendering unless trivially reused without scope expansion.
- AI handoff parity with Nx as a first CLI MVP requirement.
- changing Nx defaults or target behavior.

### Key Acceptance Criteria for #220

- Core runs outside Nx.
- CLI does not import Nx APIs.
- Manual workspace input can describe projects and dependencies.
- Built-in Core rules can be evaluated from CLI input.
- JSON output is deterministic.
- exit codes are driven by Core result/severity semantics.
- Nx Governance users are not required to migrate.

### Suggested Child Issue Breakdown

1. Define CLI MVP command shape.
2. Define manual workspace input format.
3. Implement manual workspace adapter.
4. Implement profile loading for CLI.
5. Invoke Core from CLI.
6. Implement JSON output.
7. Implement basic human-readable output.
8. Implement exit code behavior.
9. Add CLI tests without Nx.
10. Document CLI MVP usage.

## #221 — Generic TypeScript Workspace Adapter

### Reframed Goal

Add the first real non-Nx source-code adapter after the CLI MVP proves Core can run outside Nx.

The TypeScript adapter should discover projects and dependencies in TypeScript/package-manager workspaces and emit the same canonical `GovernanceWorkspace` model as the Nx adapter.

### Primary Responsibilities

#221 should own:

- package-manager workspace discovery
- `package.json` workspace parsing
- `pnpm-workspace.yaml` parsing where needed
- npm/yarn workspace support where needed
- `tsconfig` path parsing
- configured project glob discovery
- static TypeScript/JavaScript import graph analysis
- mapping discovered projects/dependencies to `GovernanceWorkspace`
- `capability:typescript`
- `capability:package-manager`
- adapter diagnostics

### Explicit In Scope

- Deterministic project discovery.
- Deterministic dependency graph output.
- Configurable project glob support.
- Package workspace metadata mapping.
- tsconfig path metadata mapping.
- Optional source file metadata on dependencies.
- Capability emission for extensions.

### Explicit Out of Scope

- Nx project graph loading.
- Angular/React/NestJS-specific rules.
- CLI command behavior beyond using the adapter.
- Core rule engine changes unless gaps are explicitly discovered and scoped.
- Maven/Gradle/PHP adapters.
- package split as part of this epic.

### Key Acceptance Criteria for #221

- TypeScript adapter emits canonical `GovernanceWorkspace`.
- TypeScript adapter does not depend on Nx.
- dependencies reference discovered project ids.
- adapter contributes `capability:typescript` and `capability:package-manager`.
- CLI or tests can run Core governance against TypeScript adapter output.
- extension packages can consume TypeScript/package capabilities without importing adapter internals.

### Suggested Child Issue Breakdown

1. Define TypeScript adapter options.
2. Implement package-manager workspace detection.
3. Implement workspace pattern parsing.
4. Implement project discovery from configured globs.
5. Implement tsconfig path parsing.
6. Implement static import graph analysis.
7. Map discovered projects to Core project model.
8. Map imports to Core dependency model.
9. Emit TypeScript/package-manager capabilities.
10. Add adapter diagnostics.
11. Add adapter tests without Nx.
12. Add CLI integration test using TypeScript adapter output.

## Cross-Epic Overlap Resolution

| Concern | Owning epic | Notes |
|---|---|---|
| Core contracts | #218 | Designed by #227, implemented internally by #218. |
| Rule taxonomy | #218 | Framework-specific rules are excluded. |
| Adapter contract | #218 / #228 | #218 implements internal contract; #228 defines architecture. |
| Nx adapter mapping | #218 | Preserve behavior while moving behind boundary. |
| Extension contracts | #219 | Depends on #227 and #229. |
| Capability registry | #219 initially | Adapter capabilities are produced by adapters; registry/context is extension/core concern. |
| CLI command UX | #220 | Must not leak into Core. |
| Manual workspace adapter | #220 | Deliberately minimal. |
| TypeScript source discovery | #221 | Not part of #220. |
| Package split | Future follow-up | Not part of #218-#221. |
| AI package extraction | Future follow-up | Contracts may be prepared in #218. |
| Reporting package extraction | Future follow-up | Contracts may be prepared in #218. |

## Implementation Readiness Checklist

Before starting implementation epics, confirm:

- #225 current-state audit is accepted.
- #226 target package architecture is accepted.
- #227 Core contracts are accepted.
- #228 workspace adapter contract is accepted.
- #229 Extension Host v2 design is accepted.
- #230 compatibility contract is accepted.
- #232 migration plan is accepted.

Before starting #220, confirm:

- Core can run without Nx APIs.
- Core has a stable enough run input/result contract.
- manual workspace input can map to `GovernanceWorkspace`.

Before starting #221, confirm:

- CLI MVP or tests can execute Core outside Nx.
- adapter contract is stable enough.
- capability model is stable enough for TypeScript/package-manager capabilities.

## Recommended Implementation Order After #217

```text
#218.1 Internal Core boundary and tests
#218.2 Core rule engine and result model
#218.3 Adapter result contract and Nx adapter isolation
#218.4 Compatibility verification for Nx host
#219.1 Core-owned extension contracts
#219.2 Capability registry and explicit registration
#219.3 Optional/required/failing extension behavior
#220.1 CLI MVP with manual workspace adapter
#221.1 TypeScript adapter discovery and graph analysis
```

## Acceptance Check for #231

- [x] #218, #219, #220, and #221 have clear architectural boundaries.
- [x] Cross-epic dependencies are explicit.
- [x] Overlap between Core extraction and Extension Host work is resolved.
- [x] CLI MVP remains deliberately small and does not absorb TypeScript adapter work.
- [x] TypeScript adapter work is clearly sequenced after Core and CLI readiness.
- [x] Follow-up issues are identified if current epic scopes are too broad or too vague.
