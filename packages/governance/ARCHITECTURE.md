# Nx Governance Architecture

## 1. Purpose

`@anarchitects/nx-governance` is the Nx host package for Governance in Nx
workspaces.

It turns workspace structure into:

- governance signals
- weighted health scores
- explainable findings
- CLI and JSON reports
- snapshot and AI payload inputs

The deterministic Governance contracts and analysis live in
`@anarchitects/governance-core`. Nx workspace extraction lives in
`@anarchitects/governance-adapter-nx`. Nx-specific interpretation belongs in
`governance-extension-nx`. This package composes those pieces for Nx executors,
generators, Project Crystal inference, profiles, artifacts, and output routing.

## 2. Product model

The intended package architecture is:

- `@anarchitects/nx-governance` as the Nx host/runtime package
- `@anarchitects/governance-adapter-nx` as the Nx extraction and mapping package
- `governance-extension-nx` as the Nx interpretation package
- community-owned packages such as `@anarchitects/governance-core`,
  `@anarchitects/governance-cli`, and
  `@anarchitects/governance-adapter-typescript` as the owners for portable
  Core, standalone CLI, and generic TypeScript adapter behavior

This keeps the Nx host focused and prevents it from accumulating Core,
standalone CLI, generic TypeScript adapter, Angular-, React-, JVM-, or
.NET-specific runtime logic.

### Generic governance concerns

These are not owned by `@anarchitects/nx-governance` anymore; they are consumed
through published packages and extension contracts:

- dependency and boundary analysis
- ownership and documentation checks
- signal aggregation
- metric calculation and health scoring
- portable snapshot and AI payload generation

Nx host concerns stay in this package:

- Nx executors and generators
- Project Crystal inference
- profile/config resolution
- host composition and extension loading
- workspace-root-relative artifact paths
- snapshot persistence
- executor-facing CLI, JSON, management, graph, and AI handoff rendering

### Ecosystem-specific manifestations

These belong in extension plugins:

- framework-specific layering conventions
- ecosystem-specific dependency smells
- metadata extraction and enrichers
- rule packs and heuristics
- extension-specific metrics and signals

## 3. Core vs extension responsibilities

Community Core owns:

- shared data contracts
- scoring and score aggregation
- deterministic governance analysis
- portable report/source models

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
Feature Impact Assessment estimates the deterministic delivery impact of a
proposed change from workspace metadata. It does not fetch PR data or
integrate with GitHub directly.
Delivery Impact Assessment composes deterministic governance drivers and
indices into a management-facing assessment. It does not call external systems
or AI services.
Governance snapshots may optionally include delivery-impact summaries for
trend comparison. Those snapshot and drift contracts remain Core-facing, while
snapshot storage, artifact paths, and executor behavior remain host-owned.
`buildDeliveryImpactAssessment(...)` and the delivery-impact calculations stay
Core-facing, while `renderManagementReport(...)` remains a pure,
platform-independent renderer. The `repo-management-insights` executor and
`runGovernanceManagementInsights(...)` remain Nx host orchestration, including
snapshot file resolution plus stdout/logger integration.
Management reports render those deterministic delivery-impact assessments for
managers and technical leads. They do not perform calculations, call external
systems, or make financial forecasts.
Management-insights AI payload and prompt generation are platform-independent.
Writing `.governance-metrics/ai/*` artifacts and wiring
`repo-ai-management-insights` remain Nx host concerns.
`ChangeSetInput` is the generic Core-facing input for feature and PR impact
assessment. GitHub, Jira, Linear, CI, or CLI adapters should map their external
metadata into that contract; Core does not fetch PR data or perform
platform-specific file-to-project mapping.

### Delivery-Impact Boundary

Delivery-impact contracts and calculations are Core-facing and deterministic.
Management report rendering is pure and platform-independent. The
`repo-management-insights` executor is part of the Nx host surface, so target
registration, stdout/logging, and artifact behavior remain host concerns.
External system context such as GitHub, Jira, Linear, CI, or framework-specific
intelligence belongs in adapters or extensions, not in the delivery-impact core.

`@anarchitects/nx-governance` owns:

- the Nx execution lifecycle
- executor/generator entrypoints
- profile/config resolution
- extension loading and ordering in an Nx workspace
- host-owned rendering and artifact writing

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

The Nx host runtime owns the orchestration pipeline:

```text
runGovernance
  -> load profile and Nx adapter snapshot
  -> build normalized governance workspace
  -> discover and register governance extensions
  -> apply workspace enrichers
  -> evaluate Core policies and extension rule packs
  -> merge core and extension signals
  -> merge core and extension metrics
  -> calculate health and top issues
  -> render reports, snapshots, and AI payloads
```

This preserves one governance truth while keeping extraction, Core analysis,
host orchestration, and extension interpretation in separate bounded contexts.

Exception-backed findings already have explicit report shapes in the core
assessment model:

- `suppressedFindings` for active, tolerated deviations
- `reactivatedFindings` for stale or expired exception debt

Future Governance Graph work should reuse those shapes directly so
suppressed deviations stay explainable and reactivated findings stay
visible as governance debt. Graph visualization remains out of scope for
the current exception implementation.

## 6. Module structure

The Nx host package lives under:

```text
packages/governance/src
```

The main architectural areas are:

- `plugin` for host orchestration
- `executors` for Nx executor entrypoints
- `generators` for Nx generator entrypoints
- `nx-host` for Nx extension discovery/loading
- `profile` and `presets` for profile resolution and scaffolding
- `reporting`, `snapshot-store`, `ai-handoff`, and `graph-document` for
  host-owned output and artifact concerns
- `extensions` for portable extension runtime wrappers around Core contracts
- `compatibility` and `boundaries` for package-surface guardrails

Removed plugins-side legacy source trees are documented in
[`../../docs/governance/source-organization.md`](../../docs/governance/source-organization.md).

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
