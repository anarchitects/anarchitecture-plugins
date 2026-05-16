# Governance Management Insights and Delivery Impact Metrics

## Purpose

Management insights extend governance from engineering-quality signals into a
deterministic delivery-impact layer. The goal is not to replace engineering
metrics, but to make them interpretable for management and technical planning
without leaving the Governance Core / Adapter / Extension / Nx Host boundary
model defined in the architecture docs.

This document explains:

- how governance signals become delivery-impact drivers and indices
- which parts are Core-facing contracts and deterministic calculations
- which parts are Nx host behavior
- which future responsibilities belong to adapters and extensions

See also:

- [Governance target package architecture](./governance-target-package-architecture.md)
- [Governance implementation epic alignment](./governance-implementation-epic-alignment.md)
- [Nx Governance compatibility contract](./nx-governance-compatibility-contract.md)

## Audience Model

### Managers

Managers consume management outcome metrics and management-facing reports.
They need concise, grounded interpretation of delivery friction, coordination
risk, and architecture investment priorities. They are not the primary audience
for raw rule violations or project-graph detail.

### Technical Leads

Technical leads connect engineering governance findings to delivery-impact
drivers, indices, and architecture investment decisions. They need traceability
back to measurements, top issues, signals, and violations.

### Developers

Developers still work primarily with engineering governance metrics, concrete
violations, and repository-level reports. Developer-facing insights are only
useful when they stay tied to specific projects, rules, and change impact.

## Metric Layers

### Engineering Governance Metrics

These are the deterministic engineering signals already produced by Governance:

- measurements such as boundary integrity, dependency complexity, ownership
  coverage, documentation completeness, and architectural entropy
- top issues, hotspots, and health scoring
- rule violations and conformance findings

These metrics remain the evidence layer.

### Delivery Impact Metrics

Delivery-impact metrics translate engineering governance evidence into
management-facing explanation inputs and relative risk indicators:

- delivery-impact drivers
- Cost of Change Index
- Time-to-Market Risk Index
- Feature Impact Assessment
- Delivery Impact Assessment

These are still deterministic. They do not fetch external business data and do
not invent project context.

### Management Outcome Metrics

Management outcome metrics are the report-ready interpretation layer:

- management-facing insights
- architecture investment priorities
- delivery predictability summaries
- trend context from snapshot comparison

This layer is still grounded in governance evidence. It is not a financial
forecasting system or a delivery-date prediction system.

## Core Concepts

### Delivery-Impact Drivers

Delivery-impact drivers are deterministic explanation inputs derived from
governance measurements, top issues, violations, and optional snapshot deltas.
Examples include:

- cross-domain coordination friction
- ownership ambiguity
- change-impact radius pressure
- architectural erosion risk
- delivery predictability pressure

Drivers are Core-facing contracts. They are platform-independent and do not
depend on Nx, GitHub, Jira, Linear, or CI APIs.

### Cost of Change Index

The Cost of Change Index is a relative 0..100 risk indicator:

- higher score means change is likely harder, riskier, or more coordination-heavy
- lower score means change is likely easier or safer

It is not a money estimate, budget estimate, or ROI calculation.

### Time-to-Market Risk Index

The Time-to-Market Risk Index is a relative 0..100 risk indicator:

- higher score means greater coordination or delivery-speed pressure
- lower score means lower coordination or delivery-speed pressure

It is not a delivery-date forecast and does not estimate lead time directly.

### Feature Impact Assessment

Feature Impact Assessment is a deterministic impact summary for a proposed
change, based on workspace metadata and change-set input. It can include:

- changed and affected projects
- affected domains and teams
- review stakeholder spread
- simple impact radius and delivery risk

It does not imply that GitHub integration is implemented. GitHub, CLI, or CI
callers are expected to map their external context into generic Core-facing
change-set inputs.

### Delivery Impact Assessment

Delivery Impact Assessment composes:

- mapped delivery-impact drivers
- delivery-impact indices
- management and technical-lead insights
- optional feature impact input when already available

This is the canonical deterministic management-facing assessment contract.

### Management Report

The management-facing report is a pure renderer over a built
`DeliveryImpactAssessment`. It presents:

- management summary
- Cost of Change
- Time-to-Market Risk
- delivery predictability and trend context
- top investment drivers
- recommended architecture investments

Report rendering is platform-independent. Writing to stdout or files is not.

### Snapshot Trends

Snapshots may optionally include delivery-impact summaries. Snapshot comparison
may then surface delivery-impact trend deltas over time.

Snapshot and drift contracts are Core-facing. Snapshot file storage, artifact
paths, and snapshot resolution remain host-owned concerns.

### AI-Ready Management Insights

AI-ready management-insights payload and prompt models are deterministic and
grounded in governance plus delivery-impact data. They can be Core-facing
because they are pure contracts and prompt-input builders.

Artifact writing for `.governance-metrics/ai/*` remains a host concern. The
current Nx host surface exposes that through executor wiring, but the request
and prompt models are not inherently Nx-specific.

### Change Set Input

`ChangeSetInput` is the generic Core-facing input for change impact analysis.
It is intentionally platform-independent and can be fed by:

- git-aware Nx host flows
- future GitHub adapters
- future Jira/Linear/CI adapters
- future standalone CLI flows
- manual callers

Core does not fetch PR data, parse GitHub APIs, or assume a specific VCS host.
If file-to-project mapping is needed, that mapping should usually happen in an
adapter unless a platform-independent mapping already exists.

## Architecture Boundaries

### Governance Core Responsibilities

Governance Core owns:

- delivery-impact contracts
- delivery-impact drivers
- Cost of Change and Time-to-Market Risk calculations
- Feature Impact Assessment and Delivery Impact Assessment contracts/builders
- snapshot and drift contracts
- AI-ready request and prompt models where they are deterministic and
  platform-independent

Core-facing delivery-impact modules must not import Nx APIs.

### Nx Governance Host Responsibilities

Nx Governance is the current Nx host surface. It owns:

- `repo-management-insights`
- `repo-ai-management-insights`
- target registration and target presets
- Project Crystal behavior
- stdout and logger integration
- snapshot path resolution
- snapshot artifact writing
- AI handoff artifact writing

These are host concerns, not Core concepts.

### Adapter Responsibilities

Adapters own external or workspace-specific inputs and mapping, including
future:

- GitHub PR metadata
- Jira or Linear delivery context
- CI result context
- VCS-aware change-set mapping
- file-to-project mapping when platform-specific workspace logic is required

The architecture boundary is:

```text
external system or workspace host input
  -> adapter-fed context
  -> ChangeSetInput / governance contracts
  -> Core feature or delivery impact calculation
```

GitHub/Jira/Linear/CI inputs are future adapter responsibilities, not current
Core requirements.

### Extension Responsibilities

Extensions provide framework- or ecosystem-specific intelligence:

- rule packs
- enrichers
- signal providers
- metric providers

Extensions do not own the delivery-impact model itself. They may contribute the
signals or metadata that later feed delivery-impact drivers and indices.

## Traceability Model

The intended traceability chain is:

```text
technical governance signals
  -> delivery-impact drivers
  -> delivery-impact indices
  -> management insights
  -> architecture investment decisions
```

This traceability matters because management-facing interpretation should stay
grounded in evidence, not in unsupported narrative.

## Nx Usage

The current Nx host surface exposes management-facing reporting as:

```bash
nx repo-management-insights
nx repo-management-insights --output=json
```

`repo-management-insights` is the current Nx integration surface. It is not the
foundation of the delivery-impact model; it is a host wrapper around Core-facing
contracts and calculations.

## Non-Goals and Caveats

- Governance does not calculate actual financial cost.
- Governance does not predict delivery dates.
- Governance does not use AI to decide architecture policy.
- Governance does not require GitHub integration for Feature Impact Assessment.
- Governance Core does not fetch PR data, Jira data, Linear data, or CI data.
- Nx is not required for the Governance Core model, even though Nx is the
  current product host surface.

## Roadmap

Expected future direction includes:

- adapter-fed GitHub, Jira, Linear, and CI inputs
- richer delivery-impact trend comparison on top of snapshot summaries
- standalone CLI validation of management insights outside Nx
- broader feature-impact analysis from adapter-provided change-set mapping

Those should extend the current boundaries, not collapse them.
