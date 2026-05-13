# Governance Core Current-State Audit

## Purpose

This document is the architecture audit for issue #225 and provides input for #217, #218, and #219.

It records the current state of `packages/governance` before extracting a platform-independent Governance Core. It is intentionally factual: it classifies existing modules, identifies boundary risks, and highlights behavior that must be preserved during later implementation work.

This document does not implement refactoring. It does not move code, create packages, change runtime behavior, or change the public Nx Governance surface.

## Target Architecture Summary

The target direction is a Governance ecosystem with clear package responsibilities and dependency direction:

- `@anarchitects/governance-core`
  - platform-independent governance domain model, profiles, rules, violations, reports, scoring, snapshots, drift contracts, extension contracts, and deterministic result models.
- `@anarchitects/governance-adapter-nx`
  - maps Nx project graph data, tags, targets, metadata, dependencies, and Nx-specific workspace information into the core governance model.
- `@anarchitects/nx-governance`
  - Nx plugin host: executors, generators, Project Crystal target inference, Nx UX, logger/process integration, and backward-compatible target surface.
- `@anarchitects/governance-cli`
  - standalone CLI host for non-Nx workspaces and CI usage.
- `@anarchitects/governance-adapter-typescript`
  - future generic TypeScript/package-manager workspace discovery and static import graph analysis.
- `@anarchitects/governance-extension-*`
  - framework/language-specific governance intelligence: enrichers, rule packs, signal providers, metric providers, presets, and optional diagnostics.

Target dependency direction:

```text
nx-governance -> governance-adapter-nx -> governance-core
governance-cli -> adapters -> governance-core
governance-extension-* -> governance-core
governance-core -> no Nx dependency
```

## Current Module Classification

| Current module/path | Current responsibility | Target destination | Classification | Notes / risks |
|---|---|---|---|---|
| `packages/governance/src/core/models.ts` | Defines workspace, project, dependency, ownership, violation, measurement, health, assessment, snapshot, drift, cognitive load, and AI analysis models. | `@anarchitects/governance-core` | `core-candidate`, `snapshot-drift`, `ai-contract` | Strong core candidate. It currently imports signal types from `../signal-engine/types.js`, which makes core depend on a non-core module directionally. Signal contracts should likely move into core or a core-owned submodule. |
| `packages/governance/src/core/profile.ts` | Defines current governance profile, health thresholds, layer dependency defaults, profile overrides. | `@anarchitects/governance-core` with contract redesign | `core-candidate`, `ambiguous` | Good starting point, but current shape is oriented around layer/domain/ownership policies and includes `boundaryPolicySource: 'profile' | 'eslint'`. ESLint-specific policy source likely does not belong in pure core as a first-class concept. |
| `packages/governance/src/core/exceptions.ts` | Defines governance exception model and review metadata. | `@anarchitects/governance-core` | `core-candidate` | Exceptions are generic governance concepts and should remain close to violations/reports. |
| `packages/governance/src/policy-engine` | Evaluates built-in policies such as domain boundaries, layer boundaries, and ownership presence against `GovernanceWorkspace` and `GovernanceProfile`. | `@anarchitects/governance-core` | `core-candidate` | Largely platform-independent. Should evolve into built-in core rules or a core rule pack. |
| `packages/governance/src/signal-engine` | Builds and merges governance signals from graph, policy, conformance, and extensions. Defines signal type contracts. | Mostly `@anarchitects/governance-core`; conformance-specific builders may remain separated. | `core-candidate`, `conformance-input`, `ambiguous` | Signal contracts appear core-relevant. Current source categories include graph, policy, conformance, and extension. Core should own generic signal/result contracts while host/adapters may contribute source-specific signals. |
| `packages/governance/src/metric-engine` | Calculates governance measurements from workspace and signals. | `@anarchitects/governance-core` | `core-candidate` | Platform-independent scoring input. Depends on core workspace/measurement and signal contracts. |
| `packages/governance/src/health-engine` | Calculates weighted health score, grades, hotspots, explainability, and recommendations. | `@anarchitects/governance-core` | `core-candidate` | Strong core candidate. Uses only core models. Recommendations are generic today but may later be extensible. |
| `packages/governance/src/inventory` | Converts adapter snapshots plus profile overrides into `GovernanceWorkspace`; normalizes tags, project types, dependency types, ownership, and documentation metadata. | Core normalization utility or adapter support layer | `core-candidate`, `adapter-nx`, `ambiguous` | Useful logic to preserve. Current boundary risk: it imports `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js`, making an otherwise generic normalization step depend on Nx adapter types. |
| `packages/governance/src/nx-adapter` | Reads Nx project graph, tags, metadata, dependencies, CODEOWNERS, and builds `AdapterWorkspaceSnapshot`. | `@anarchitects/governance-adapter-nx` | `adapter-nx` | Clear Nx adapter responsibility. Imports `@nx/devkit` and reads Nx graph/workspace root. Should not be imported by core contracts. |
| `packages/governance/src/extensions/contracts.ts` | Defines extension context, extension definition, host interface, enrichers, rule packs, signal providers, metric providers, and execution input contracts. | Contracts: `@anarchitects/governance-core`; Nx-specific context data removed | `extension-contract`, `core-candidate` | Contracts are conceptually core-level, but currently import `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js`. This is a key boundary leak for #219. |
| `packages/governance/src/extensions/host.ts` | Discovers extensions from `nx.json.plugins`, imports `<plugin>/governance-extension`, registers contributions, handles missing entrypoints and registration failures. | Shared host utility, Nx host, or future extension host package; contracts in core | `extension-host`, `nx-host`, `ambiguous` | Current discovery is Nx-coupled: imports `workspaceRoot` from `@nx/devkit`, reads `nx.json`, and probes arbitrary Nx plugin packages. #219 should replace this with explicit governance extension registration and capability-based context. |
| `packages/governance/src/plugin/index.ts` | Implements Project Crystal `createNodesV2` for inferred report targets from governance profile files. | `@anarchitects/nx-governance` | `nx-host` | Pure Nx plugin host responsibility. Must remain outside core. Preserves current inferred target behavior. |
| `packages/governance/src/plugin/run-governance.ts` | Main orchestration entrypoint for reports, snapshots, drift, AI use cases, extension registration, policy evaluation, metrics, reporting, artifact writing, process output, and Nx workspace integration. | Split between core engine, Nx host, output layer, snapshot/drift/AI services | `nx-host`, `core-candidate`, `snapshot-drift`, `ai-contract`, `ai-host-output`, `reporting-output`, `ambiguous` | Main god module. It imports `@nx/devkit`, Nx adapter, inventory, policy, metrics, health, reporting, snapshot store, drift, conformance, AI analysis, AI handoff, signal engine, extension host, filesystem/process utilities. This should be decomposed incrementally, not rewritten in one step. |
| `packages/governance/src/plugin/apply-governance-exceptions.ts` | Applies governance exceptions to policy and conformance findings. | `@anarchitects/governance-core` or core-adjacent exception processing | `core-candidate`, `conformance-input` | Exception semantics are core concepts, but conformance-specific inputs may need isolation. |
| `packages/governance/src/plugin/build-assessment-artifacts.ts` | Assessment artifact helper if present. | Core engine or host orchestration depending on imports | `ambiguous` | Should be inspected during #218 implementation to decide whether it is core orchestration or host-specific artifact assembly. |
| `packages/governance/src/reporting` | Renders CLI and JSON reports, metric/signal breakdowns, top issues, and output-specific views. | Core report model plus host/CLI renderers | `reporting-output`, `core-candidate`, `ambiguous` | Deterministic JSON report shape is core-relevant. CLI formatting and terminal presentation are host/CLI concerns. |
| `packages/governance/src/snapshot-store` | Lists, reads, and writes metric snapshots to workspace-local storage. | Snapshot contracts in core; filesystem store in CLI/Nx host or shared storage utility | `snapshot-drift`, `reporting-output` | Snapshot model is core; filesystem persistence is host/output concern. Current defaults must be preserved. |
| `packages/governance/src/drift-analysis` | Compares metric snapshots and summarizes drift. | `@anarchitects/governance-core` | `snapshot-drift`, `core-candidate` | Drift comparison is platform-independent if it works on core snapshot contracts. |
| `packages/governance/src/ai-analysis` | Builds deterministic AI analysis requests and summaries for root cause, PR impact, drift, cognitive load, scorecard, onboarding, recommendations, smell clusters, and refactoring suggestions. | Initially core-adjacent or future `governance-ai`; contracts remain core | `ai-contract`, `core-candidate`, `ambiguous` | AI request/result contracts are core-relevant. Whether builders remain in core or later move to a separate AI package is an open decision. |
| `packages/governance/src/ai-handoff` | Writes AI handoff artifacts such as payload and prompt files. | Nx/CLI host output concern or future AI host utility | `ai-host-output`, `reporting-output` | Artifact writing should not be pure core. Current output paths should remain compatible. |
| `packages/governance/src/conformance-adapter` | Reads external conformance result input and adapts it into governance signals/findings. | Adapter/input integration; not pure core | `conformance-input`, `ambiguous` | The conformance finding model may inform core signal/violation contracts, but reading external files is host/input integration. |
| `packages/governance/src/executors` | Nx executor implementations and schemas for repo reports, graph, snapshot, drift, conformance, and AI targets. | `@anarchitects/nx-governance` | `generator-executor`, `nx-host` | Public Nx surface. Must remain backward-compatible during extraction. |
| `packages/governance/src/generators` | Nx generators for init and ESLint integration. Writes targets, profile files, plugin registration, and helper config. | `@anarchitects/nx-governance` | `generator-executor`, `nx-host` | Nx-specific setup surface. Additive/non-destructive behavior should be preserved. |
| `packages/governance/src/presets` | Built-in governance profile presets and profile loading/overrides. | Core presets plus Nx host/profile loading split | `core-candidate`, `nx-host`, `ambiguous` | Profile defaults are core-relevant. File loading, ESLint helper integration, and workspace path handling may be host-specific. |
| `packages/governance/src/profile` | Runtime profile constants and profile loading helpers. | Core profile model plus host-specific loading | `core-candidate`, `nx-host`, `ambiguous` | Profile schema/config should be core-owned; resolution from workspace files is likely host responsibility. |
| `packages/governance/src/graph` / graph-related executors if present | Graph rendering and graph artifact output. | Graph model/enrichment maybe core or extension; rendering/output host-specific | `reporting-output`, `nx-host`, `ambiguous` | Governance graph visualization should remain separate from core rule evaluation. |
| `packages/governance/ARCHITECTURE.md` | Current architecture documentation for Nx Governance as shared governance core for Nx workspaces. | Documentation to revise after #217 decisions | `ambiguous` | Current document is partially outdated relative to the new target architecture: it treats `@anarchitects/nx-governance` as the shared core and keeps Nx graph loading in the core package. |
| `docs/governance/configuration-surface-audit.md` | Documents current target/profile/config behavior and compatibility surface. | Compatibility input for #230 and #218 guardrails | `nx-host`, `generator-executor`, `reporting-output` | Valuable factual source for public target names, profile defaults, artifact paths, init behavior, and inference constraints. |
| `docs/governance/project-crystal-target-inference-contract.md` | Documents Project Crystal target inference contract. | `@anarchitects/nx-governance` documentation | `nx-host` | Must remain scoped to Nx plugin host. |

## Platform-Independent Core Candidates

The following current concepts are good candidates for the future Governance Core, subject to cleanup of import direction and host-specific concerns:

- Governance domain model:
  - `GovernanceWorkspace`
  - `GovernanceProject`
  - `GovernanceDependency`
  - `Ownership`
  - `Violation`
  - `Measurement`
  - `GovernanceAssessment`
- Profile concepts:
  - profile name and description
  - layer/domain/ownership rule configuration
  - health thresholds
  - metric weights
  - project overrides
  - governance exceptions
- Built-in policy evaluation:
  - domain boundary checks
  - layer boundary checks
  - ownership presence checks
- Signal and metric concepts:
  - governance signal contracts
  - signal aggregation
  - measurement calculation
  - metric families
  - top issue summaries
- Health/scoring concepts:
  - weighted score calculation
  - status thresholds
  - grade calculation
  - metric/project hotspots
  - explainability text model
  - generic recommendations
- Snapshot and drift concepts:
  - `MetricSnapshot`
  - `SnapshotComparison`
  - metric/score/violation deltas
  - `DriftSignal`
  - drift summary
- AI-ready contracts:
  - `AiAnalysisRequest`
  - `AiAnalysisResult`
  - AI finding and recommendation models
  - deterministic payload structures
- Deterministic result/report model concepts:
  - JSON report shape
  - assessment artifacts
  - signal and metric breakdowns
  - top issues
  - exception reports

Candidate cleanup before extraction:

- Move signal type contracts into core or make `signal-engine` part of core.
- Replace `AdapterWorkspaceSnapshot` imports in generic modules with a core-owned adapter input contract.
- Separate profile schema from host-specific file/profile resolution.
- Separate deterministic report data from terminal/CLI rendering.
- Separate snapshot/drift contracts from filesystem persistence.
- Separate AI request/result contracts from AI handoff artifact writing.

## Nx-Specific Responsibilities

The following responsibilities should remain outside Governance Core, either in `@anarchitects/governance-adapter-nx` or `@anarchitects/nx-governance`.

### Nx adapter responsibilities

- Loading the Nx project graph with Nx APIs.
- Reading Nx workspace root through Nx APIs.
- Mapping Nx graph nodes to governance projects.
- Mapping Nx graph dependencies to governance dependencies.
- Reading tags and metadata from:
  - Nx graph node data
  - `project.json`
  - `package.json > nx`
- Filtering graph dependencies to known projects.
- Producing an Nx capability/context for extensions.
- Reading CODEOWNERS may remain here initially to preserve behavior, but long-term ownership enrichment is an open decision.

### Nx plugin host responsibilities

- Nx executor registration and schemas.
- Nx generator registration and schemas.
- `createNodesV2` Project Crystal target inference.
- Stable Nx target names and executor ids.
- Nx target inputs, outputs, and cache metadata.
- `nx.json` plugin registration.
- `package.json > nx.targets` generation.
- Nx logger integration.
- Nx process/stdout behavior for executors.
- Workspace-relative output path resolution.
- Compatibility with explicit root targets.
- ESLint integration generator behavior.

### Current public Nx target surface

The current executor registration includes these target ids:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`
- `repo-snapshot`
- `repo-drift`
- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`
- `workspace-graph`
- `workspace-conformance`
- `governance-graph`

The current generator registration includes:

- `init`
- `eslint-integration`

These are Nx host concerns and should not become core responsibilities.

## Extension System Observations

The current extension system already has useful contribution concepts:

- workspace enrichers
- rule packs
- signal providers
- metric providers
- extension definitions
- extension host registry
- source plugin attribution through `sourcePluginId`

However, the current extension model is still Nx-coupled in two ways:

1. `extensions/contracts.ts` imports `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js` and exposes it on `GovernanceExtensionHostContext` as `snapshot`.
2. `extensions/host.ts` imports `workspaceRoot` from `@nx/devkit`, reads `nx.json`, discovers extensions from `nx.json.plugins`, and probes `<plugin>/governance-extension` for each non-local plugin.

This affects #219 directly. Extension contracts should become platform-independent and depend only on Governance Core contracts. Nx awareness should come through a capability model rather than through direct Nx adapter types or Nx plugin discovery semantics.

Recommended direction for #219:

- Keep contribution concepts: enrichers, rule packs, signal providers, metric providers.
- Move stable extension contracts into core.
- Replace Nx snapshot exposure with platform-independent context and capability registry.
- Use explicit governance extension registration as the primary model.
- Treat missing optional extensions differently from failing installed extensions.
- Keep Nx-specific discovery/registration wiring in the Nx plugin host or a host utility, not in pure core.

## Import Leaks and Boundary Risks

The following boundary risks were identified from the inspected files:

- `core/models.ts` imports `GovernanceSignalCategory`, `GovernanceSignalSeverity`, `GovernanceSignalSource`, and `GovernanceSignalType` from `../signal-engine/types.js`.
  - Risk: core models depend on a non-core engine module.
  - Likely fix later: move signal types into core or treat signal engine as part of core.
- `extensions/contracts.ts` imports `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js`.
  - Risk: extension contracts depend on Nx adapter types.
  - Likely fix later: replace with platform-independent execution context and capabilities.
- `extensions/host.ts` imports `workspaceRoot` from `@nx/devkit` and reads `nx.json`.
  - Risk: extension host is not platform-independent.
  - Likely fix later: keep Nx-specific discovery in Nx host and move core extension contracts to core.
- `extensions/host.ts` probes `<plugin>/governance-extension` for entries from `nx.json.plugins`.
  - Risk: upstream Nx plugins may not export Anarchitects governance extension subpaths.
  - This is the main motivation for #219 Extension Host v2.
- `plugin/run-governance.ts` imports and coordinates many concerns:
  - `@nx/devkit` logger/workspace root
  - Nx workspace adapter
  - inventory normalization
  - policy evaluation
  - metrics/health/recommendations
  - reporting
  - snapshot store
  - drift analysis
  - conformance input
  - AI analysis
  - AI handoff artifact writing
  - signal building/merging
  - extension registration/evaluation
  - filesystem, child process, and path utilities
  - Risk: this module mixes core engine orchestration, Nx host integration, output rendering, snapshot persistence, drift, AI use cases, and process behavior.
  - Likely fix later: split incrementally; do not rewrite in one step.
- `inventory/build-inventory.ts` imports `AdapterWorkspaceSnapshot` from `../nx-adapter/types.js`.
  - Risk: generic workspace normalization depends on Nx adapter types.
  - Likely fix later: introduce a core-owned adapter result/input contract.
- `profile` and `presets` appear partly core and partly host-specific.
  - Risk: profile schema/config and profile file resolution may be conflated.
  - Likely fix later: separate profile model from filesystem/workspace loading.
- `reporting` appears to mix report data construction and output formatting.
  - Risk: terminal/CLI rendering may leak into core if moved wholesale.
  - Likely fix later: core owns deterministic report data; hosts own rendering/output mode.
- `snapshot-store` persists files.
  - Risk: filesystem persistence is host/output behavior, not pure core.
  - Likely fix later: core owns snapshot model and comparison; host owns storage.
- `ai-handoff` writes files.
  - Risk: AI artifact persistence should not be pure core.
  - Likely fix later: core owns AI payload contracts; host owns artifact writing.

No implementation changes are required by this audit. These risks should guide #218 and #219.

## Behavior to Preserve

The following behavior should be preserved during #218 unless explicitly changed by a later compatibility decision.

### Nx target names and executor ids

Preserve the current public target/executor names:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`
- `repo-snapshot`
- `repo-drift`
- `workspace-graph`
- `workspace-conformance`
- `governance-graph`
- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`

### Profile conventions

Preserve current profile conventions:

- runtime profile files live under `tools/governance/profiles/<profile-name>.json`
- default selected profile is `frontend-layered`
- compatibility alias `layered-workspace` remains supported where current runtime supports it
- built-in starter presets remain available where current init/profile loading supports them:
  - `frontend-layered`
  - `backend-layered-3tier`
  - `backend-layered-ddd`

### Project Crystal inference

Preserve current inference behavior:

- `createNodesV2` watches `tools/governance/profiles/*.json`
- inferred root targets are:
  - `repo-health`
  - `repo-boundaries`
  - `repo-ownership`
  - `repo-architecture`
- inferred targets use stable existing target names
- explicit workspace-owned targets remain authoritative
- `governance-graph` remains explicit-only in the current MVP unless a later issue changes that deliberately

### Output conventions

Preserve current output paths and artifact conventions:

- governance graph default HTML output: `dist/governance/graph.html`
- governance graph JSON output: `dist/governance/graph.json`
- workspace conformance default configured output/input path: `dist/conformance-result.json`
- metric snapshots: `.governance-metrics/snapshots`
- AI handoff artifacts: `.governance-metrics/ai`

### Init/generator behavior

Preserve current generator behavior:

- init is additive and non-destructive
- existing targets are not deleted
- existing target options are not overwritten
- existing profile files are not overwritten
- `targetPreset: "minimal" | "full"` remains meaningful
- `minimal` includes the core minimal setup behavior currently documented
- `full` includes the broader report/snapshot/drift/graph/conformance/AI target surface currently documented

### Report behavior

Preserve current report behavior:

- report executors support CLI and JSON output modes where currently supported
- `failOnViolation` behavior remains stable
- deterministic JSON output remains suitable for automation and AI-assisted workflows

## Recommended Extraction Sequencing Input

Recommended sequencing for #218 and #219:

1. Keep the current package intact initially.
2. Add or refine internal boundaries before any package split.
3. Isolate core contracts first:
   - workspace/project/dependency
   - profile/rule/violation
   - measurement/health/report
   - snapshot/drift/AI payload contracts
4. Remove core import leaks:
   - move or re-home signal contracts
   - remove Nx adapter type imports from generic contracts
5. Introduce a workspace adapter contract.
6. Move Nx graph loading and Nx-specific metadata mapping behind the Nx adapter boundary.
7. Keep existing Nx executors, generators, target names, profile names, artifact paths, and Project Crystal inference stable.
8. Add Nx-independent unit tests for core modules before moving large amounts of logic.
9. Introduce Extension Host v2 after the core and adapter contracts are clear.
10. Defer physical package split until internal boundaries and compatibility tests are stable.

## Open Decisions

These decisions should be handled in #226, #227, #228, or #229 rather than resolved in this audit:

- Exact package split timing.
- Whether adapters return `GovernanceWorkspace` directly or an intermediate adapter snapshot.
- Whether intermediate adapter snapshots are private adapter internals or core-owned contracts.
- Long-term home for CODEOWNERS ownership mapping.
- Whether AI analysis builders remain in core initially or move to a later AI package.
- Whether AI handoff artifact writing belongs in CLI/Nx host or a shared host utility.
- Whether reporting renderers live in core, CLI, Nx host, or a future shared reporting package.
- How profile configuration should evolve from current domain/layer/ownership-specific fields to a more extensible rule configuration model.
- How extension-specific profile configuration should be namespaced.
- How capabilities should be named, versioned, and exposed to extensions.
- Which current contracts are stable public API versus internal/experimental.
- How conformance input should relate to generic governance signals and violations.

## Issue #225 Acceptance Check

- [x] Every current governance module has a proposed target destination.
- [x] Nx-specific dependencies outside the Nx adapter / Nx plugin host are explicitly identified.
- [x] Platform-independent code that can move to core is identified.
- [x] Existing behavior that must be preserved is listed.
- [x] The audit gives enough detail to start #218 without guessing current responsibilities.
