# Nx Governance Architecture (Augmented v2)

## 1. Purpose

Nx Governance is a **deterministic governance and health analysis plugin** for Nx workspaces.

It analyzes:
- repository structure
- project boundaries
- architectural consistency
- drift over time

It produces:
- metrics
- health scores
- findings
- recommendations
- AI-ready payloads

---

## 2. Strategic Positioning

Nx Governance is an **interpretation layer on top of Nx signals**.

It does NOT:
- replace Nx Graph
- replace Nx Conformance
- enforce rules

It DOES:
- interpret structural signals (Nx Graph)
- interpret compliance signals (Nx Conformance — upcoming)
- aggregate signals into health and insights

### Evolution Path

Today:
- Nx Graph + profile policy → metrics → health → reporting

Next:
- Nx Graph → GraphAdapter
- Nx Conformance → ConformanceAdapter
- Signals → GovernanceSignal → metrics → health

Future:
- Multi-workspace (PolyGraph)
- Org-level insights
- Cross-repo governance

---

## 3. Current Module Structure

Located under:

```
packages/governance/src
```

Main modules:

- core → orchestration (runGovernance)
- inventory → project and structure extraction
- metrics → metric calculations
- health → scoring system
- reporting → CLI output
- snapshot → persistence and drift
- ai → payload generation
- config → profile configuration

---

## 4. Main Execution Flow

```
runGovernance
    ↓
Inventory Builder (Nx Graph)
    ↓
Metrics Engine
    ↓
Health Engine
    ↓
Reporting Engine
    ↓
Snapshot Engine
    ↓
AI Payload Generation
```

### Characteristics

- deterministic pipeline
- no side effects
- CLI-first
- composable steps

---

## 5. Core Models and Contracts

### WorkspaceInventory

Represents normalized workspace structure.

Contains:
- projects
- dependencies
- metadata

---

### Metrics

Computed indicators based on inventory.

Examples:
- boundary integrity
- dependency complexity
- ownership coverage

---

### Health Score

Aggregated score derived from metrics.

Used for:
- summaries
- trend tracking
- decision support

---

### Snapshot

Serialized output of a run.

Used for:
- drift detection
- historical comparison

---

### AI Payload

Structured JSON containing:
- metrics
- findings
- recommendations

Used by external AI agents.

---

## 6. CLI Surface

Commands:

- run governance analysis
- output results
- generate snapshot
- generate AI payload

Targets:
- explicit targets only (current limitation)

---

## 7. Reporting & Snapshot Flow

Reporting:
- CLI output (human-readable)
- structured JSON (machine-readable)

Snapshots:
- stored for drift comparison
- enable time-based analysis

---

## 8. AI Flow (Model 1)

Nx Governance does NOT execute AI.

Instead:
- generates payloads
- suggests prompts

AI execution happens in:
- VS Code
- Cursor
- external tools

---

## 9. Architectural Principles

- deterministic first
- no hidden behavior
- modular design
- no tight Nx coupling
- extensible pipeline
- explicit over implicit

---

## 10. Known Gaps (Current State)

- no GraphAdapter abstraction yet
- no Conformance integration yet
- no unified signal model
- no inferred targets
- AI payload coverage limited

---

## 11. Target Architecture Delta

### Current State

```
Nx Graph + Profile Policy
    ↓
Inventory
    ↓
Metrics
    ↓
Health
    ↓
Reporting
```

---

### Target State

```
Nx Graph → GraphAdapter
Nx Conformance → ConformanceAdapter

Graph + Conformance
    ↓
GovernanceSignal (unified model)
    ↓
Metrics Engine
    ↓
Health Engine
    ↓
Reporting / Snapshot / AI
```

---

## 12. Planned Extensions

### GraphAdapter
- normalize Nx graph
- decouple Nx internals

### ConformanceAdapter
- ingest rule violations
- convert to signals

### GovernanceSignal
- unified signal abstraction
- source-aware (graph / conformance)

---

## 13. AI Agent Working Context

When extending this system:

### DO

- extend existing pipeline
- use adapters as isolation layers
- keep logic deterministic
- reuse core models
- keep AI external

### DO NOT

- redesign the architecture
- duplicate Nx features
- tightly couple to Nx APIs
- introduce implicit behavior

---

## 14. Guiding Principle

Nx Governance:

- reads signals
- interprets signals
- enables decisions

It does not enforce or replace Nx.
