# Nx Governance Roadmap — Architecture-Aware Host

Status: **current proposed Nx integration plan** (2026-11-19). Historical Nx-only signal/score roadmap replaced; existing functionality is not presumed removed or delivered solely from checklist completion.

**Product North Star:** [Community #781](https://github.com/anarchitects/anarchitecture-community/issues/781). Does implemented software still conform to intended approved architecture, how do we know, what changed, and where/in which order should we act?

Nx Governance is the **Nx host and developer-workflow integration** of Community Governance Core, not an independent canonical graph, generic rules engine or alternative to Nx Graph, Conformance/Owners, Polygraph or Nx Cloud.

## Current ownership and technical baseline

- **Community**: `@anarchitects/governance-core` canonical `GovernanceWorkspace` with nodes/relations, evidence/authority/confidence, assessment, metrics and drift; adapters and extensions for TypeScript and dbt. Composed `GovernanceEnvironment` is proposed in [Community #300](https://github.com/anarchitects/anarchitecture-community/issues/300), **not shipped**.
- **Community Modeling decision gate**: [#780](https://github.com/anarchitects/anarchitecture-community/issues/780). No unsupported claim of general Foundation external refs or unconditional direct Core → Foundation dependency.
- **Plugins**: `@anarchitects/nx-governance` hosts Nx-facing discovery, executors and plugin-generated targets, consuming Community contracts; preserves CLI/reporting, legacy flows until intentionally retired and evidence verified.
- **Meta**: [#39](https://github.com/anarchitects/anarchitecture-meta/issues/39) is the measurable product-proof workstream, [#36](https://github.com/anarchitects/anarchitecture-meta/issues/36) coordinates Polygraph feasibility. Project #26 is organization coordination; Project #23 remains Plugins Nx technical roadmap where applicable.

## Prioritized phases

| Priority | Phase and outcome | Issues / prerequisites |
| --- | --- | --- |
| **P0** | Ensure Nx host consumes canonical Community contracts, resolves source failures and unknown coverage correctly, and does not silently greenlight unverified conformance | [Community #300](https://github.com/anarchitects/anarchitecture-community/issues/300), [#781](https://github.com/anarchitects/anarchitecture-community/issues/781); Plugins [#460](https://github.com/anarchitects/anarchitecture-plugins/issues/460) closeout audit |
| **P1** | Nx host can compose *separately versioned intent* plus observed Nx/TypeScript facts and Core assessment; reports exact architecture node, code node, evidence and coverage | [Plugins #637](https://github.com/anarchitects/anarchitecture-plugins/issues/637), Community [#782](https://github.com/anarchitects/anarchitecture-community/issues/782)–[#785](https://github.com/anarchitects/anarchitecture-community/issues/785) and [#788](https://github.com/anarchitects/anarchitecture-community/issues/788) |
| **P1** | Architecture-aware PR/CI check against approved baseline; before/after diff, introduced/resolved/unknown findings, correct intervention target | [Plugins #638](https://github.com/anarchitects/anarchitecture-plugins/issues/638); reuse [#289](https://github.com/anarchitects/anarchitecture-plugins/issues/289), [#403](https://github.com/anarchitects/anarchitecture-plugins/issues/403) |
| **P1** | Nx-native plugin option configuration, explicit extension registration and straightforward migration | [Plugins #473](https://github.com/anarchitects/anarchitecture-plugins/issues/473) |
| **P2** | Nx Graph/Project Details project-specific metadata based on report projector, native API **feasibility first** | [Plugins #444](https://github.com/anarchitects/anarchitecture-plugins/issues/444), [#445](https://github.com/anarchitects/anarchitecture-plugins/issues/445)–[#450](https://github.com/anarchitects/anarchitecture-plugins/issues/450) |
| **P2** | Nx Polygraph cross-repo dependency context **only if supported and entitled**; no competing graph | [Plugins #40](https://github.com/anarchitects/anarchitecture-plugins/issues/40), Meta [#36](https://github.com/anarchitects/anarchitecture-meta/issues/36) |
| **P2** | Evidence-backed read-only AI/agent context, no AI compliance authority | [Plugins #39](https://github.com/anarchitects/anarchitecture-plugins/issues/39), Community [#139](https://github.com/anarchitects/anarchitecture-community/issues/139) |
| **Later** | Additional adapter packs/visual UX only after measured consumer demand | [Community #135](https://github.com/anarchitects/anarchitecture-community/issues/135), [#136](https://github.com/anarchitects/anarchitecture-community/issues/136), [#141](https://github.com/anarchitects/anarchitecture-community/issues/141) |

## First vertical slice / evidence requirements

An approved synthetic capability/application service/component and expected realization, plus a separate Nx project implementation, are assessed together. Provide independently reviewable fixtures for:

1. A compliant realization with linked source model/revision, package and verification evidence.
2. A forbidden dependency introduced by a PR with precise source location and implicated architecture expectation.
3. A required implementation missing with complete source discovery proof, **not** just absent from a partial adapter.
4. An unresolved/ambiguous mapping and a Git diff/source-retrieval error both reported as **unverified**, never a clean pass.
5. Intent-only modification impacting checks even without changed implementation files.
6. Planned migration/waiver separated from compliant status.
7. Re-run after a developer follows the proposed remediation: compare before/after, preserve unrelated findings, record false-positive/false-negative and time-to-fix in Meta #39.

Reports should identify **intent → mapping → observed evidence → gap → action**, including coverage, source revision and provenance. CI should gate proven violations and optionally missing mandatory evidence with explicit policy. Nx `affected` selection must not suppress assessment of impacted architecture-only changes.

## Dependencies / implementation boundaries

- **#637** depends on Community #300 and a minimally executable Core reconciliation and CLI path (#783–#785, #788); can prototype with stable synthetic artifacts but cannot claim full conformance before they exist.
- **#638** depends on #637 and stable Core evaluation, plus a verified change-set source. Existing `git diff` helper failures must not silently return empty changed-file sets. Use #403 and #289 rather than replicate.
- **#444** may progress projector design independently; any Nx Graph/Project Details **visual overlay** must be proven with actual Nx APIs before UX promises or removal of a working report/command.
- **#40** focuses on host/Polygraph integration, not duplicating cross-workspace GovernanceEnvironment (Community #300).
- **#39** has existing `ai-handoff` payloads/templates; review #55–#57 for obsolescence before scheduling new code.
- Plugins does not define canonical ArchiMate semantics, own model editing, approve governance exceptions, invent evidence or implement general reconciliation.
- Treat role/owner/release authority and commercial vs OSS boundaries per Meta ADRs.

## Previous checklist and backlog reconciliation

The previous roadmap described `GovernedProject`, `GovernedDependency`, a separate Nx-specific graph core and open-ended new score/React/Java/.NET extension work. Those legacy design directions are superseded by Community's shipped canonical nodes/relations and architecture-first product positioning. Existing source/executors **must be audited**, not deleted because a planning document changed.

Keep graph and Conformance ingestion, signals, health and drift useful as **bottom-up evidence**. Do not clone Nx PowerPack checks, or promise arbitrary Nx Graph heatmap overlays. Prefer no UI until the first end-to-end check demonstrably helps a developer fix a change.
