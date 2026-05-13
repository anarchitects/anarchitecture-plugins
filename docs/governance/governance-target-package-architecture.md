# Governance Target Package Architecture

## Purpose

This document defines the target package model and dependency direction for the Anarchitects Governance ecosystem as part of #226.

It is an architecture document only. It does not create packages, move files, update exports, change runtime behavior, implement adapters, or implement the standalone CLI.

It builds on the current-state audit from #225 and provides architectural guardrails for #218, #219, #220, and #221.

## Architectural Goal

Evolve the current `@anarchitects/nx-governance` package from an Nx-centered plugin into a broader Governance ecosystem with:

- a platform-independent Governance Core
- explicit workspace adapters
- framework/language extensions
- a standalone CLI host
- a backward-compatible Nx plugin host

The architecture should avoid a big-bang rewrite. The preferred sequencing is internal boundaries first, package split later.

## Target Package Model

| Package | Responsibility | Depends on | Must not depend on |
|---|---|---|---|
| `@anarchitects/governance-core` | Platform-independent governance model, rule engine, profiles, violations, signals, measurements, scoring, report/result contracts, snapshots, drift contracts, extension contracts, and deterministic result models. | Runtime-minimal generic dependencies only. | Nx, Angular, React, NestJS, TypeScript compiler APIs, package-manager APIs, CLI frameworks, Node process/logging assumptions, filesystem-specific workspace discovery. |
| `@anarchitects/governance-adapter-nx` | Converts Nx workspace/project graph information into the core governance model and contributes Nx capabilities/context. | `@anarchitects/governance-core`, Nx APIs. | CLI command handling, framework-specific rules, core-owned rule logic, Project Crystal target inference. |
| `@anarchitects/nx-governance` | Nx plugin host: executors, generators, Project Crystal inference, Nx UX, target schemas, target compatibility, Nx logging/process integration, and workspace-local artifact behavior. | `@anarchitects/governance-core`, `@anarchitects/governance-adapter-nx`, optional governance extensions. | Framework-specific rule implementations unless provided through extensions; non-Nx CLI concerns; core model ownership. |
| `@anarchitects/governance-cli` | Standalone CLI host for running governance outside Nx, loading profiles, invoking adapters, producing CLI/JSON/Markdown output, and returning CI-friendly exit codes. | `@anarchitects/governance-core`, selected adapters, selected extensions. | Nx-specific executor/generator APIs, Project Crystal inference, framework-specific rules directly. |
| `@anarchitects/governance-adapter-typescript` | Future generic TypeScript/package-manager workspace discovery, project detection, tsconfig/package-manager parsing, and static import dependency graph analysis. | `@anarchitects/governance-core`, TypeScript/package-manager parsing dependencies as needed. | Nx APIs, Nx target inference, framework-specific Angular/React/NestJS rules. |
| `@anarchitects/governance-extension-*` | Framework/language/ecosystem-specific enrichers, rule packs, signal providers, metric providers, presets, and diagnostics. | `@anarchitects/governance-core`; optionally consumes capabilities provided by adapters/hosts. | Direct dependency on Nx unless it is explicitly an Nx-specific extension; ownership of core rule engine/reporting contracts. |
| Future optional `@anarchitects/governance-ai` | Optional home for AI request builders, AI-oriented summaries, and AI payload helpers if they outgrow Core. | `@anarchitects/governance-core`. | Host-specific artifact writing unless explicitly designed as a host utility. |
| Future optional `@anarchitects/governance-reporting` | Optional shared renderer package for CLI/Markdown/HTML rendering if rendering grows beyond host packages. | `@anarchitects/governance-core`. | Workspace discovery, Nx APIs, source-code adapters. |

## Dependency Direction

The dependency direction is mandatory:

```text
@anarchitects/nx-governance
  -> @anarchitects/governance-adapter-nx
    -> @anarchitects/governance-core

@anarchitects/governance-cli
  -> adapters/extensions
    -> @anarchitects/governance-core

@anarchitects/governance-extension-*
  -> @anarchitects/governance-core

@anarchitects/governance-core
  -> no Nx dependency
```

Core is the dependency root. Hosts, adapters, and extensions depend on Core; Core must not depend on hosts, adapters, or extensions.

## Dependency Rules

### Allowed Dependencies

`@anarchitects/governance-core` may depend on:

- TypeScript/JavaScript standard runtime APIs where unavoidable
- small deterministic utility dependencies
- schema/validation utilities if later approved
- no framework or workspace-tool APIs

`@anarchitects/governance-adapter-nx` may depend on:

- `@anarchitects/governance-core`
- Nx APIs such as `@nx/devkit`
- Node filesystem/path utilities needed to read Nx workspace metadata

`@anarchitects/nx-governance` may depend on:

- `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-nx`
- Nx APIs
- host-level renderer/storage utilities
- explicitly registered governance extensions

`@anarchitects/governance-cli` may depend on:

- `@anarchitects/governance-core`
- selected adapters
- selected governance extensions
- CLI argument parsing libraries
- host-level renderer/storage utilities

`@anarchitects/governance-extension-*` may depend on:

- `@anarchitects/governance-core`
- ecosystem-specific analysis libraries if needed
- capability contracts exposed by Core

### Forbidden Dependencies

`@anarchitects/governance-core` must not depend on:

- `@nx/devkit`
- `nx`
- Project Crystal APIs
- Angular, React, NestJS, Vue, Playwright, or other framework APIs
- TypeScript compiler APIs for source graph discovery
- package-manager APIs for workspace discovery
- CLI frameworks
- host-specific logger/process abstractions
- direct filesystem-based workspace discovery
- Nx adapter types
- extension package implementations

`@anarchitects/governance-extension-*` must not depend on Nx by default. Nx awareness should come through capabilities, not direct Nx imports. An explicitly Nx-specific extension may be introduced later if needed, but generic Angular/React/TypeScript extensions should remain Nx-independent.

`@anarchitects/governance-adapter-nx` must not own:

- generic Core rules
- scoring model
- report/result contracts
- framework-specific rule packs
- Nx executor/generator registration

`@anarchitects/nx-governance` must not own:

- canonical governance domain contracts
- generic rule engine semantics
- generic adapter contracts
- extension public contracts beyond host wiring

## Responsibility Boundaries

## Governance Core

Core owns platform-independent governance semantics.

Core should own:

- `GovernanceWorkspace`
- `GovernanceProject`
- `GovernanceDependency`
- ownership model
- profile model and profile normalization contracts
- rule engine contracts
- built-in generic rule families
- violation model
- signal model
- measurement model
- health/scoring model
- deterministic assessment/report result model
- snapshot and drift contracts
- AI-ready request/result contracts where they are stable generic contracts
- extension contracts
- adapter contracts
- diagnostics contracts

Core should not own:

- Nx graph loading
- package-manager workspace parsing
- TypeScript source import analysis
- Angular/React/NestJS-specific analysis
- executor/generator schemas
- CLI argument parsing
- terminal rendering as a host behavior
- filesystem artifact writing as a host behavior

### Core Rule Ownership

Core owns the generic rule engine and generic built-in rule families. Profiles decide which rules are enabled and how they behave.

Generic Core rule families include:

- Boundary Governance
- Convention Governance
- Ownership Governance
- Documentation / Metadata Governance
- Structural Governance
- Snapshot / Drift contracts and signals

Concrete framework-specific rules belong in extensions, not Core.

## Nx Adapter

The Nx adapter owns conversion from Nx workspace information to Core workspace contracts.

The Nx adapter should own:

- loading Nx project graph data
- mapping Nx projects to `GovernanceProject`
- mapping Nx dependencies to `GovernanceDependency`
- reading Nx tags and metadata
- reading project-level metadata from Nx conventions
- deriving or contributing `capability:nx`
- preserving current Nx metadata interpretation

The Nx adapter may temporarily own CODEOWNERS-to-project ownership mapping to preserve current behavior. Long-term ownership mapping may move to a generic ownership enricher or filesystem capability, but that is a later decision.

The Nx adapter should not own:

- Project Crystal target inference
- executor registration
- generator behavior
- generic Core rules
- framework-specific rule packs

## Nx Governance Plugin Host

`@anarchitects/nx-governance` remains the backward-compatible Nx product surface.

It should own:

- executor registration and schemas
- generator registration and schemas
- Project Crystal `createNodesV2`
- stable target names
- stable target options where already public
- Nx logger/process/stdout behavior
- Nx workspace-root integration
- profile file discovery under current Nx conventions
- workspace-local artifact path compatibility
- preserving explicit root target behavior
- invoking Core through the Nx adapter

It should not own:

- canonical Core contracts
- generic rule engine semantics
- framework-specific intelligence except by loading extensions

## Standalone Governance CLI

The CLI should prove that Governance can run outside Nx.

The CLI should own:

- command surface such as `check`, `report`, and `graph`
- loading profiles from CLI-provided paths
- loading manual YAML/JSON workspace input for the MVP
- invoking Core with selected adapters/extensions
- table, JSON, and Markdown output modes
- CI-friendly exit codes
- CLI-specific diagnostics

The CLI should not own:

- Nx-specific behavior
- TypeScript source graph analysis directly
- framework-specific rules directly
- canonical Core contracts

## TypeScript Adapter

The TypeScript adapter is the first real non-Nx source-code adapter after the CLI MVP.

It should own:

- package-manager workspace detection
- `package.json` workspace parsing
- `pnpm-workspace.yaml` parsing
- npm/yarn workspace parsing
- `tsconfig` path alias parsing
- configured project discovery from globs
- mapping path conventions to governance tags
- static TypeScript/JavaScript import dependency graph analysis
- emitting deterministic `GovernanceWorkspace` data
- contributing `capability:typescript` and `capability:package-manager`

It should not own:

- Nx workspace support
- Angular/React/NestJS-specific rules
- generic Core rule semantics
- CLI command behavior

## Governance Extensions

Extensions contribute ecosystem-specific intelligence through Core contracts.

Extensions may provide:

- workspace enrichers
- rule packs
- signal providers
- metric providers
- presets
- extension-specific diagnostics

Extensions should consume adapter/host capabilities rather than importing adapter/host implementations directly.

Examples:

- Angular extension may inspect `capability:typescript`, `capability:angular`, and optionally `capability:nx` if provided.
- Playwright extension may inspect `capability:typescript` and `capability:package-manager`.
- Maven/Gradle extensions may inspect JVM-specific adapter capabilities.

Extensions should not require Core changes to introduce new rule ids or violation categories, as long as they use the stable Core violation/signal/measurement contracts.

## Reporting and Output Boundary

Core owns deterministic report/result contracts, not necessarily every renderer.

Core should own:

- `GovernanceAssessment`
- report data structures
- JSON-safe output contracts
- signal/metric/top issue breakdown models
- exception report models

Hosts or a future reporting package should own:

- CLI text rendering
- Markdown rendering
- HTML graph rendering
- writing reports to files
- process stdout/stderr behavior

JSON rendering may remain near Core if it is a pure serialization of Core result contracts. Terminal formatting and host output behavior should remain outside Core.

## Snapshot, Drift, and AI Boundary

Snapshot and drift models are platform-independent and should be Core-owned contracts.

Core should own:

- `MetricSnapshot`
- `SnapshotComparison`
- `DriftSignal`
- drift summary contracts
- deterministic AI-ready request/result contracts where stable

Hosts should own:

- snapshot file storage
- locating snapshot directories
- writing AI handoff payload and prompt files
- workspace-relative artifact paths
- process output and user instructions

AI analysis builders may remain core-adjacent initially if they are deterministic and platform-independent. If AI workflows grow, a future `@anarchitects/governance-ai` package can own AI-specific request builders and summarizers while depending on Core contracts.

## Current-to-Target Mapping

| Current area | Target home | Notes |
|---|---|---|
| `src/core/models.ts` | `governance-core` | Strong core candidate; signal types should be moved or made core-owned. |
| `src/core/profile.ts` | `governance-core` | Requires evolution toward extensible rule configuration. |
| `src/policy-engine` | `governance-core` | Becomes built-in generic rule pack / rule engine implementation. |
| `src/signal-engine` | `governance-core` | Signal contracts likely become core-owned. Source-specific builders may be separated. |
| `src/metric-engine` | `governance-core` | Generic measurement calculation. |
| `src/health-engine` | `governance-core` | Generic scoring and health explainability. |
| `src/inventory` | `governance-core` or adapter support | Must stop depending on `nx-adapter` types. |
| `src/nx-adapter` | `governance-adapter-nx` | Clear adapter boundary. |
| `src/extensions/contracts.ts` | `governance-core` | Must remove Nx adapter snapshot dependency. |
| `src/extensions/host.ts` | Nx host / CLI host / shared host utility | Current implementation is Nx-coupled. |
| `src/plugin/index.ts` | `nx-governance` | Project Crystal inference remains Nx host responsibility. |
| `src/plugin/run-governance.ts` | Split | Core engine, Nx host, output, snapshot, drift, and AI concerns should be separated incrementally. |
| `src/executors` | `nx-governance` | Public Nx surface. |
| `src/generators` | `nx-governance` | Public Nx setup surface. |
| `src/reporting` | Core contracts + host renderers | Split deterministic data from rendering/output. |
| `src/snapshot-store` | Host storage utility | Snapshot contracts stay in Core; filesystem persistence stays host-side. |
| `src/drift-analysis` | `governance-core` | Platform-independent if operating on snapshots. |
| `src/ai-analysis` | Core-adjacent or future `governance-ai` | Keep contracts core-owned. Decide package later. |
| `src/ai-handoff` | Host output utility | Writes artifacts; not pure Core. |
| `src/conformance-adapter` | Input adapter / host integration | Generic imported findings may map to Core signals/violations. |

## Package Split Strategy

The package split should not happen first.

Recommended sequence:

1. Preserve current `@anarchitects/nx-governance` package.
2. Establish internal boundaries under the current package.
3. Remove obvious core boundary leaks.
4. Add Nx-independent core tests.
5. Introduce an internal adapter contract.
6. Move Nx graph loading behind the Nx adapter boundary.
7. Introduce Extension Host v2 contracts and explicit registration.
8. Prove non-Nx execution through the CLI MVP.
9. Add the generic TypeScript adapter.
10. Split packages only after boundaries and tests are stable.

This avoids package-management churn while the conceptual boundaries are still being refined.

## Validation Against Implementation Epics

### #218 — Governance Core Extraction

#218 should validate that:

- Core has no Nx dependency.
- Core contracts are stable enough for adapters, extensions, CLI, and Nx host.
- Generic rules, scoring, reports, snapshots, drift, and AI-ready contracts can run without Nx.
- Existing Nx behavior remains preserved through the Nx host and Nx adapter.

### #219 — Extension Host v2

#219 should validate that:

- extension contracts are Core-owned and Nx-independent.
- extension discovery/registration is explicit.
- Nx awareness is provided through capabilities, not direct Nx dependencies.
- missing optional extensions do not fail governance runs.
- failing installed extensions fail clearly.

### #220 — Standalone Governance CLI MVP

#220 should validate that:

- Core can run outside Nx.
- a manual YAML/JSON workspace model can be used as input.
- deterministic JSON output works outside Nx.
- CLI exit codes are driven by Core result/severity semantics.

### #221 — Generic TypeScript Workspace Adapter

#221 should validate that:

- a non-Nx source-code adapter can emit the same Core workspace model.
- project discovery and import graph analysis remain outside Core.
- TypeScript/package-manager capabilities can be provided to extensions.

## Rationale for Package Boundaries

### Why Core must be platform-independent

Governance rules such as boundaries, ownership, naming conventions, documentation metadata, structure, scoring, snapshots, and drift are not inherently Nx-specific. Keeping them independent allows the same governance model to serve Nx, CLI, TypeScript, JVM, PHP, and future ecosystems.

### Why Nx adapter and Nx host are separate

Nx graph extraction and Nx plugin UX are different responsibilities.

The Nx adapter maps Nx data to Core contracts. The Nx host exposes the product through Nx executors, generators, and Project Crystal. Keeping them separate prevents Nx UI/runtime concerns from leaking into adapter or Core contracts.

### Why extensions depend on Core rather than adapters

Extensions should contribute intelligence through stable Core contracts. They should react to capabilities such as `capability:nx`, `capability:typescript`, or `capability:angular`, but they should not import host or adapter internals. This enables framework extensions to work across Nx and non-Nx workspaces.

### Why CLI is a host, not Core

CLI behavior includes argument parsing, stdout/stderr, exit codes, output rendering, and file paths. These are host concerns. The CLI should invoke Core, not become part of Core.

### Why package split is deferred

The current package contains useful implementation that should be preserved. Splitting packages before internal boundaries are stable would create avoidable churn in build configuration, exports, tests, release workflows, and dependency management.

## Open Decisions Deferred to Later Issues

These decisions are intentionally not finalized here:

- exact package split timing and release versioning
- final Core public type names
- whether adapters return `GovernanceWorkspace` directly or an intermediate adapter snapshot
- long-term ownership of CODEOWNERS mapping
- final Extension Host v2 registration format
- whether AI builders remain in Core or move to a future `governance-ai` package
- whether renderers remain host-owned or move to a future `governance-reporting` package
- final profile schema and profile migration strategy
- exact package export maps
- package build/test/release configuration

## Acceptance Check for #226

- [x] The target package model is explicit.
- [x] The dependency direction is documented and unambiguous.
- [x] `governance-core` is explicitly framework/tooling agnostic.
- [x] Nx-specific responsibilities are assigned to either `governance-adapter-nx` or `nx-governance`.
- [x] Future TypeScript adapter and CLI responsibilities are scoped without implementation ambiguity.
- [x] The document can be used to validate #218, #219, #220, and #221.
