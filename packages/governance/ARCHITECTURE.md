# Nx Governance Architecture

## 1. Purpose

`@anarchitects/nx-governance` is the shared governance core for Nx workspaces.

It turns workspace structure into:

- governance signals
- weighted health scores
- explainable findings
- CLI and JSON reports
- snapshot and AI payload inputs

The core is intentionally ecosystem-neutral. Framework- and language-specific intelligence should live in separate extension plugins that contribute into the shared governance pipeline.

## 2. Product model

The intended architecture is:

- one shared core plugin: `@anarchitects/nx-governance`
- multiple ecosystem-specific extension plugins such as `@anarchitects/nx-governance-angular`

This keeps generic governance concerns in one place and prevents the core package from accumulating Angular-, React-, JVM-, or .NET-specific runtime logic.

### Generic governance concerns

These stay in the core package:

- Nx graph loading and workspace normalization
- dependency and boundary analysis
- ownership and documentation checks
- signal aggregation
- metric calculation and health scoring
- CLI and JSON reporting
- snapshot and AI payload generation
- extension discovery and execution lifecycle

### Ecosystem-specific manifestations

These belong in extension plugins:

- framework-specific layering conventions
- ecosystem-specific dependency smells
- metadata extraction and enrichers
- rule packs and heuristics
- extension-specific metrics and signals

## 3. Core vs extension responsibilities

The core owns:

- the governance execution lifecycle
- shared data contracts
- scoring and score aggregation
- reporting and machine-readable outputs
- extension registration and ordering

Delivery-impact and management-insight contracts also belong here. They are
deterministic, platform-independent TypeScript contracts derived from shared
governance signals, measurements, and findings rather than from tool-specific
integrations or rendering layers.
Delivery-impact drivers translate those deterministic governance outputs into
management-facing explanation inputs without adding external data or
non-deterministic interpretation.
The Cost of Change Index is a relative 0..100 risk index derived from those
deterministic governance measurements. It is not a financial cost estimate.
The Time-to-Market Risk Index is a relative 0..100 risk index derived from
deterministic governance measurements. It is not a delivery-date forecast.

Extensions own:

- workspace enrichers
- rule packs
- signal providers
- metric providers
- optional presets and extension-specific docs

Extensions contribute intelligence. The core remains the place where that intelligence is collected, scored, and reported.

## 4. Extension model

Governance-capable Nx plugins are discovered from `nx.json.plugins`.

If a plugin wants to extend governance, it should expose:

```text
<package>/governance-extension
```

That module must export a named `governanceExtension`.

The public extension-facing contracts are exported from the package root:

- `GovernanceExtensionDefinition`
- `GovernanceExtensionHostContext`
- `GovernanceExtensionHost`
- `GovernanceWorkspaceEnricher`
- `GovernanceRulePack`
- `GovernanceSignalProvider`
- `GovernanceMetricProvider`

Extensions reuse the shared governance output types:

- `GovernanceSignal`
- `Violation`
- `Measurement`

For the authoring view and example code, see [EXTENSIONS.md](./EXTENSIONS.md).

## 5. Execution flow

The core runtime owns the full orchestration pipeline:

```text
runGovernance
  -> load profile and Nx snapshot
  -> build normalized governance workspace
  -> discover and register governance extensions
  -> apply workspace enrichers
  -> evaluate core policies and extension rule packs
  -> merge core and extension signals
  -> merge core and extension metrics
  -> calculate health and top issues
  -> render reports, snapshots, and AI payloads
```

This preserves one governance truth even when multiple ecosystem engines contribute analysis.

Exception-backed findings already have explicit report shapes in the core
assessment model:

- `suppressedFindings` for active, tolerated deviations
- `reactivatedFindings` for stale or expired exception debt

Future Governance Graph work should reuse those shapes directly so
suppressed deviations stay explainable and reactivated findings stay
visible as governance debt. Graph visualization remains out of scope for
the current exception implementation.

## 6. Module structure

The core package lives under:

```text
packages/governance/src
```

The main architectural areas are:

- `plugin` for orchestration and executor entrypoints
- `inventory` and `nx-adapter` for workspace normalization
- `policy-engine`, `signal-engine`, and `metrics` for shared governance evaluation
- `health` and `reporting` for score aggregation and output
- `snapshot` and `ai` for downstream consumption
- `extensions` for extension discovery, registration, and public contracts

## 7. Project Crystal inference

Nx Governance now exposes Project Crystal inference through
`packages/governance/src/plugin/index.ts`.

The current architecture is intentionally narrow:

- `createNodesV2` watches `tools/governance/profiles/*.json`
- the hook infers the four core report targets
  - `repo-health`
  - `repo-boundaries`
  - `repo-ownership`
  - `repo-architecture`
- inferred targets attach to the root project `.` and keep the stable existing
  target names
- `governance-graph` remains explicit-only in the current MVP because its
  output semantics differ from the CLI-first report targets
- explicit workspace-owned targets remain authoritative when the same name is
  also inferred

This keeps inference convention-based and deterministic while preserving the
existing executor/runtime model. The stable contract for this behavior lives in
[`../../docs/governance/project-crystal-target-inference-contract.md`](../../docs/governance/project-crystal-target-inference-contract.md).

## 8. Angular as the reference extension

Angular is the first reference ecosystem engine, but it should not be embedded directly into the core package.

The intended package model is:

- `@anarchitects/nx-governance` as the shared platform
- `@anarchitects/nx-governance-angular` as the Angular extension plugin

The Angular plugin should contribute Angular-specific metrics, signals, rule packs, and metadata enrichers through the shared contracts. It should not duplicate the governance model, scoring pipeline, or reporting infrastructure.

This establishes the reference pattern for future engines such as TypeScript, React, Maven, Gradle, and .NET.

## 9. Guiding principles

- keep the core deterministic
- keep ecosystem logic out of the core package
- extend the shared pipeline instead of forking it
- preserve a single scoring and reporting model
- keep outputs explainable and traceable back to contributed signals, violations, and metrics
