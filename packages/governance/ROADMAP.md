# Nx Governance Roadmap (Revised)

> Nx Governance = interpretation layer on top of Nx signals  
> (Graph + Conformance → Health, Drift, Insights)

---

## 🧭 Strategic Direction

This roadmap prioritizes **Nx ecosystem alignment** over Angular-specific expansion.

Goal:
- Become **complementary to Nx PowerPack (Conformance)** and **Nx Graph / PolyGraph**
- Build a **signal-driven governance engine**

---

# ✅ Phase 1 — Nx Ecosystem Alignment (CURRENT PRIORITY)

## Graph Integration

- [x] Implement `GraphAdapter`
- [x] Load Nx project graph (API or JSON)
- [x] Normalize projects → `GovernedProject`
- [x] Normalize dependencies → `GovernedDependency`
- [x] Add domain/layer inference from tags
- [x] Produce `WorkspaceGraphSnapshot`

## Conformance Integration

- [x] Implement `ConformanceAdapter`
- [x] Support JSON-based ingestion
- [x] Map rule violations → `GovernanceSignal`
- [x] Normalize severity levels
- [x] Capture rule metadata

## Signal Unification

- [x] Define `GovernanceSignal` contract in core
- [x] Merge graph + conformance signals
- [x] Ensure signals are explainable and traceable

## Reporting

- [x] Show signal sources in CLI output
- [x] Distinguish:
  - [x] Graph findings
  - [x] Conformance findings
- [x] Add counts per source

---

# 🔍 Phase 2 — Governance Intelligence

## Metric Redefinition

- [ ] Redefine **Boundary Integrity Score**
  - [ ] Graph + Conformance
- [ ] Redefine **Ownership Coverage Score**
  - [ ] Metadata + rule violations
- [ ] Redefine **Dependency Complexity Score**
  - [x] Graph-driven

## New Metrics

- [ ] Compliance Integrity Score (Conformance)
- [ ] Structural Integrity Score (Graph)
- [ ] Combined Workspace Health Score

## Health Engine

- [x] Implement weighted scoring
- [x] Aggregate signals into health scores
- [x] Detect hotspots (top offenders)
- [x] Validate weighted metrics against representative workspace fixtures

---

# 🤖 Phase 3 — AI Interpretation Layer (Model 1)

## Payload Enrichment

- [ ] Include graph signals in AI payloads
- [ ] Include conformance signals in AI payloads
- [ ] Include top violations only (performance constraint)

## Use Cases

- [ ] Root Cause Analysis
- [ ] Drift Detection
- [ ] PR Impact Analysis
- [ ] Cognitive Load Estimation
- [ ] Architecture Scorecard

## Prompt Templates

- [ ] Standardize prompt structure
- [ ] Ensure explainability
- [ ] Avoid hallucination (strict grounding)

---

# 🌐 Phase 4 — Multi-Workspace / PolyGraph Readiness

## Data Model

- [ ] Introduce `workspaceId` everywhere
- [ ] Support multiple workspace graphs

## Graph Evolution

- [ ] Extend GraphAdapter for multi-workspace
- [ ] Support cross-workspace dependencies
- [ ] Detect cross-workspace hotspots

## Metrics

- [ ] Cross-workspace coupling score
- [ ] Org-level drift detection

---

# 🅰️ Phase 5 — Angular Specialization (LATER)

## Angular Metrics

- [ ] Facade Bypass Ratio
- [ ] Smart Component Density
- [ ] Shared UI Coupling
- [ ] Standalone Component Complexity
- [ ] Module Boundary Violations

## Angular Profile

- [ ] Implement Angular preset
- [ ] Apply Angular-specific policies
- [ ] Add Angular Architecture Score

---

# 🧠 Core Principles

- [ ] Metrics detect problems
- [ ] AI explains them
- [ ] Developers decide the fix

---

# 🔗 Positioning

Nx Governance builds on:

- Nx Project Graph
- Nx Conformance (PowerPack)
- Nx Cloud / PolyGraph (future)

It does NOT:
- replace Nx features
- duplicate rule engines

It DOES:
- interpret signals
- provide health insights
- enable architectural decision-making

---

# 🚀 Immediate Next Step

👉 Start with:

- [x] GraphAdapter (minimal working version)
- [x] CLI output: project + dependency count

Then:

- [x] ConformanceAdapter (JSON ingestion)
- [x] Integrate into reporting

---
