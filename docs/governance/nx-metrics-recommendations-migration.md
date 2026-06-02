# Nx Governance Metrics And Recommendations Migration

## Purpose

This document records the #409 review of current metrics, measurements,
signals, scoring contributions, recommendations, and related interpretation
logic before moving Nx-specific governance intelligence into
`@anarchitects/governance-extension-nx`.

The intent of #409 is architectural relocation, not redesign. Implementation
should move only when it is tied to Nx semantics such as Nx workspace
structure, Nx graph topology beyond normalized dependencies, Nx targets,
Project Crystal inferred targets, Nx tag conventions, Nx ownership
conventions, or Nx conformance facts.

## Current Metric Inventory

Current metric calculation lives in
`packages/governance/src/metric-engine/calculate-metrics.ts` and signal
aggregation lives in `packages/governance/src/metric-engine/aggregate-signals.ts`.

| Metric id                    | Classification | Current owner                 | Reason                                                                                                                                       |
| ---------------------------- | -------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `architectural-entropy`      | Generic        | Governance Core compatibility | Aggregates generic governance signals. It does not inspect Nx targets, inferred targets, Project Crystal metadata, or Nx project graph APIs. |
| `dependency-complexity`      | Generic        | Governance Core compatibility | Counts normalized project dependencies. It is project/dependency-oriented but not Nx-specific.                                               |
| `domain-integrity`           | Generic        | Governance Core compatibility | Uses generic domain-boundary signal weights from normalized governance data.                                                                 |
| `ownership-coverage`         | Generic        | Governance Core compatibility | Counts projects with generic ownership metadata or contacts. It does not perform Nx-specific ownership interpretation.                       |
| `documentation-completeness` | Generic        | Governance Core compatibility | Counts projects with generic documentation metadata.                                                                                         |
| `layer-integrity`            | Generic        | Governance Core compatibility | Uses generic layer-boundary signal weights from normalized governance data.                                                                  |

## Current Signal Inventory

Current signal building lives in
`packages/governance/src/signal-engine/builders.ts` and signal contracts are
re-exported from `packages/governance/src/signal-engine/types.ts`.

| Signal type                 | Classification | Current owner                 | Reason                                                                                                                       |
| --------------------------- | -------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `structural-dependency`     | Generic        | Governance Core compatibility | Represents a normalized project-to-project dependency from a graph snapshot. It is not Nx-specific after adapter extraction. |
| `cross-domain-dependency`   | Generic        | Governance Core compatibility | Represents generic domain metadata crossing on dependencies.                                                                 |
| `missing-domain-context`    | Generic        | Governance Core compatibility | Represents missing generic domain metadata for dependency context.                                                           |
| `conformance-violation`     | Generic        | Governance Core compatibility | Maps conformance findings into generic governance signals.                                                                   |
| `domain-boundary-violation` | Generic        | Governance Core compatibility | Maps the generic `domain-boundary` rule result into a signal.                                                                |
| `layer-boundary-violation`  | Generic        | Governance Core compatibility | Maps the generic `layer-boundary` rule result into a signal.                                                                 |
| `ownership-gap`             | Generic        | Governance Core compatibility | Maps the generic `ownership-presence` rule result into a signal.                                                             |

## Current Recommendation Inventory

Current deterministic recommendation generation lives in
`packages/governance/src/health-engine/calculate-health.ts`. Additional
deterministic AI handoff and management analysis helpers live under
`packages/governance/src/ai-analysis/` and derive recommendations from generic
violations, measurements, snapshots, trends, hotspots, and delivery-impact
signals.

| Recommendation area                          | Classification | Current owner                 | Reason                                                                                                                               |
| -------------------------------------------- | -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `reduce-cross-domain-dependencies`           | Generic        | Governance Core compatibility | Triggered by generic `domain-boundary` violations. It does not reference Nx concepts.                                                |
| `improve-ownership-coverage`                 | Generic        | Governance Core compatibility | Triggered by generic `ownership-presence` violations.                                                                                |
| `reduce-dependency-complexity`               | Generic        | Governance Core compatibility | Triggered by the generic `dependency-complexity` metric.                                                                             |
| AI root-cause recommendations                | Host analysis  | `@anarchitects/nx-governance` | Deterministic host analysis over generic violation types. It is user-facing through Nx executors but not Nx-specific interpretation. |
| AI architecture recommendations              | Host analysis  | `@anarchitects/nx-governance` | Deterministic host analysis over generic violations, dependency relationships, and trend metadata.                                   |
| AI smell-cluster/refactoring recommendations | Host analysis  | `@anarchitects/nx-governance` | Deterministic host analysis over generic hotspots, fanout, persistence, and violation categories.                                    |
| Management insight recommendations           | Host analysis  | `@anarchitects/nx-governance` | Derived from generic delivery-impact insights.                                                                                       |

## Current Scoring And Assessment Inventory

Health scoring lives in `packages/governance/src/health-engine/calculate-health.ts`.
Delivery-impact indices live under `packages/governance/src/delivery-impact/`.
Drift helpers are re-exported from Governance Core through
`packages/governance/src/drift-analysis/index.ts`.

| Area                      | Classification | Current owner                 | Reason                                                                                                       |
| ------------------------- | -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Weighted health score     | Generic        | Governance Core compatibility | Calculates a weighted average over measurements and profile thresholds. It does not depend on Nx facts.      |
| Health grade/status       | Generic        | Governance Core compatibility | Maps generic health score bands.                                                                             |
| Metric hotspots           | Generic        | Governance Core compatibility | Selects weak measurements by score.                                                                          |
| Project hotspots          | Generic        | Governance Core compatibility | Uses generic top issue project references. It is project-oriented but not Nx-specific.                       |
| Cost of Change Index      | Generic        | `@anarchitects/nx-governance` | Uses generic governance measurements, drivers, and snapshot deltas.                                          |
| Time-to-Market Risk Index | Generic        | `@anarchitects/nx-governance` | Uses generic measurements, conformance risk, health, and drift.                                              |
| Delivery-impact insights  | Generic        | `@anarchitects/nx-governance` | Uses generic assessment, drivers, violations, top issues, measurements, and optional feature impact context. |

## Nx-Specific Items Found

No existing metric, measurement, signal, scoring contribution,
recommendation, or related interpretation implementation is currently
Nx-specific.

The review found no current implementation for:

- Nx workspace structure metrics.
- Nx target consistency metrics.
- Project Crystal adoption signals.
- Nx inferred target coverage measurements.
- Nx tag convention metrics beyond generic tag strings.
- Nx capability-gated signal providers.
- Nx-specific recommendation generation.
- Nx-specific scoring contributions.

## Capability Review

`@anarchitects/governance-extension-nx` declares optional capability
requirements for facts emitted by `@anarchitects/governance-adapter-nx`,
including:

- `nx.project-graph`
- `nx.dependency-graph`
- `nx.project-metadata`
- `nx.project-tags`
- `nx.targets`
- `nx.inferred-targets`
- `nx.governance-profiles`
- `nx.ownership-evidence`

Because no existing Nx-specific provider exists, #409 does not add
capability-gated metric or signal execution. Future Nx-specific providers must
check the relevant capability before evaluating optional Nx facts and must skip
safely when optional facts are absent unless current behavior already fails.

Governance Core extension contracts currently support rule packs, signal
providers, metric providers, and enrichers. They do not define a recommendation
provider registration contract. #409 does not introduce one because changing
Core extension contracts is out of scope.

## Migration Outcome

No metric, measurement, signal, scoring, recommendation, or related
interpretation implementation was moved in #409 because there is no current
Nx-specific implementation to relocate.

The generic implementations remain outside
`@anarchitects/governance-extension-nx`. This preserves current behavior and
avoids moving platform-independent governance semantics into a technology
extension.

`@anarchitects/governance-extension-nx` remains the target package for future
Nx-specific metrics, signals, measurements, recommendations, and supporting
enrichers. When such providers are introduced or migrated, they should be
registered through public Governance Core extension contracts and must not
depend on `@anarchitects/governance-adapter-nx`, `@anarchitects/nx-governance`
host internals, executor internals, renderer internals, or monolithic source
paths.

## Behavior Preservation

Because no existing implementation moved:

- Existing metric identifiers remain unchanged.
- Existing measurement semantics remain unchanged.
- Existing signal identifiers and signal types remain unchanged.
- Existing score and health semantics remain unchanged.
- Existing recommendation identifiers and behavior remain unchanged.
- Existing host, executor, renderer, and adapter behavior remain unchanged.
- The Nx extension does not duplicate generic Core signals or metrics.
- No Governance Core contracts changed.
- No adapter, executor, renderer, or profile registration changes are required.

## Remaining Responsibilities

Governance Core compatibility code retains:

- metric, measurement, signal, recommendation, assessment, and scoring
  contracts
- generic signal building
- generic metric calculation
- deterministic health scoring
- generic recommendation generation

`@anarchitects/governance-extension-nx` owns future:

- Nx-specific metric providers
- Nx-specific signal providers
- Nx-specific measurement generation
- Nx-specific recommendation generation when supported by host/Core
  orchestration
- Nx-specific enrichers supporting metrics and signals
- Nx capability-aware interpretation of canonical nodes, relations,
  capabilities, and diagnostics

`@anarchitects/governance-adapter-nx` continues to own Nx extraction and
capability emission.

`@anarchitects/nx-governance` continues to own host composition, executors,
renderers, AI handoff command surfaces, Project Crystal inference, and profile
registration until scoped follow-up issues change those boundaries.

## Follow-Up

#410 remains the follow-up for host composition changes.

#411, #412, and #413 remain follow-up work for executors, renderers, and
profile registration.
