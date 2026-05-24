# Nx Governance Ownership Audit

Issue: Plugins #394  
Related: Community #127  
Community baseline consumed in this pass:

- `@anarchitects/governance-core@0.0.4`
- `@anarchitects/governance-cli@0.0.3`
- `@anarchitects/governance-adapter-typescript@0.0.3`

## Scope

This audit records the final boundary state for `@anarchitects/nx-governance`
after the published Community package updates were consumed in Plugins,
including the Core `0.0.4` micro-follow-up helpers.

Target architecture after this pass:

- `@anarchitects/nx-governance`
  - Nx executors, generators, plugin runtime, Project Crystal integration
  - Nx option/config/profile resolution
  - workspace-root-relative path handling
  - snapshot file persistence
  - AI handoff file writing
  - executor-facing CLI/JSON/management rendering
  - git changed-files lookup and Nx file-to-project matching
  - thin orchestration around published Community packages
- `@anarchitects/governance-adapter-nx`
  - Nx graph loading and Nx-to-Core workspace mapping
- `@anarchitects/governance-core`
  - deterministic governance logic
  - reusable AI payload shaping and analysis helpers
  - reusable drift, PR-impact, cognitive-load, recommendations, smell, refactoring, and onboarding context helpers
- `@anarchitects/governance-cli`
  - standalone `agov` flows, manual workspace loading, standalone profile/config behavior
- `@anarchitects/governance-adapter-typescript`
  - TypeScript workspace discovery, tsconfig parsing, alias resolution, import graph extraction

## Final Classification

| Module / Path                                                    | Current responsibility                                             | Target owner                                  | Final state                              | Notes                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/governance/src/plugin/**`                              | Nx runtime orchestration, option resolution, output writing        | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | `run-governance.ts` now orchestrates published Core APIs instead of local deterministic modules.                                                       |
| `packages/governance/src/nx-host/**`                             | Nx extension discovery, config loading, module loading             | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Host-only Nx integration remains local.                                                                                                                |
| `packages/governance/src/executors/**`                           | Nx executor entrypoints and compatibility shell                    | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Public executor ids and target behavior stay unchanged.                                                                                                |
| `packages/governance/src/generators/**`                          | Nx generator entrypoints and scaffolding                           | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Nx-specific package setup remains local.                                                                                                               |
| `packages/governance/src/conformance-adapter/**`                 | Host-side conformance input loading                                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Still an Nx host integration concern.                                                                                                                  |
| `packages/governance/src/snapshot-store/**`                      | Snapshot persistence and workspace-relative file IO                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Output persistence remains host-owned.                                                                                                                 |
| `packages/governance/src/ai-handoff/**`                          | AI handoff file rendering and persistence                          | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Host writes artifacts; deterministic request construction now comes from Core where available.                                                         |
| `packages/governance/src/reporting/**`                           | CLI, JSON, and management rendering                                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Presentation remains Nx host-owned.                                                                                                                    |
| `packages/governance-adapter-nx/src/**`                          | Nx graph loading and Nx-to-Core workspace mapping                  | `@anarchitects/governance-adapter-nx`         | `KEEP_AS_NX_ADAPTER_OWNED`               | Adapter remains responsible for Nx workspace extraction and mapping.                                                                                   |
| `packages/governance/src/health-engine/**`                       | Deterministic health scoring and recommendations                   | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core health and recommendation APIs. Directory is excluded from build/test/package surface.                     |
| `packages/governance/src/metric-engine/**`                       | Deterministic metric calculation                                   | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core metric APIs. Directory is excluded from build/test/package surface.                                        |
| `packages/governance/src/policy-engine/**`                       | Deterministic policy evaluation                                    | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core policy APIs. Directory is excluded from build/test/package surface.                                        |
| `packages/governance/src/signal-engine/**`                       | Deterministic signal builders and signal contracts                 | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core signal APIs. Directory is excluded from build/test/package surface.                                        |
| `packages/governance/src/inventory/**`                           | Workspace normalization and inventory assembly                     | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core workspace/inventory APIs. Directory is excluded from build/test/package surface.                           |
| `packages/governance/src/ai-analysis/**`                         | Deterministic AI request builders and summarizers                  | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core AI request and summarizer APIs for supported flows. Directory is excluded from build/test/package surface. |
| `packages/governance/src/delivery-impact/**`                     | Deterministic delivery-impact calculation and models               | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Active host runtime now uses published Core delivery-impact APIs. Directory is excluded from build/test/package surface.                               |
| `packages/governance/src/plugin/apply-governance-exceptions.ts`  | Legacy local exception application helper                          | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Host runtime now calls published Core exception APIs through the Core artifact builder. File is excluded from active build/test surface.               |
| `packages/governance/src/plugin/build-exception-report.ts`       | Legacy local exception report helper                               | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Host runtime now uses published Core exception report output from Core artifacts. File is excluded from active build/test surface.                     |
| `packages/governance/src/plugin/evaluate-exception-lifecycle.ts` | Legacy local exception lifecycle helper                            | `@anarchitects/governance-core`               | `REPLACED_WITH_COMMUNITY_API`            | Host runtime now uses published Core exception lifecycle handling. File is excluded from active build/test surface.                                    |
| `packages/governance/src/core/**`                                | Legacy local Core contracts and deterministic logic                | `@anarchitects/governance-core`               | `EXCLUDED_LEGACY_ONLY_WITH_REMOVAL_PLAN` | No active host runtime imports remain. Tree is excluded from build/test/package surface and guarded by boundary tests.                                 |
| `packages/governance/src/standalone-cli/**`                      | Standalone CLI runtime                                             | `@anarchitects/governance-cli`                | `EXCLUDED_LEGACY_ONLY_WITH_REMOVAL_PLAN` | Not part of `@anarchitects/nx-governance` runtime or exports. Tree is excluded from build/test/package surface.                                        |
| `packages/governance/src/manual-workspace/**`                    | Generic non-Nx workspace loading for standalone CLI flows          | `@anarchitects/governance-cli`                | `EXCLUDED_LEGACY_ONLY_WITH_REMOVAL_PLAN` | Not part of Nx host runtime. Tree is excluded from build/test/package surface.                                                                         |
| `packages/governance/src/typescript-adapter/**`                  | Generic TypeScript workspace discovery and import graph extraction | `@anarchitects/governance-adapter-typescript` | `EXCLUDED_LEGACY_ONLY_WITH_REMOVAL_PLAN` | Not part of Nx host runtime. Tree is excluded from build/test/package surface.                                                                         |
| `packages/governance/src/index.ts`                               | Root compatibility shell                                           | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Kept as a documented compatibility shell; Core-like local modules are not exported.                                                                    |
| `packages/governance/src/host-public-api.ts`                     | Host-focused package entrypoint                                    | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`                  | Canonical host-facing entrypoint remains local.                                                                                                        |

## Concrete cleanup completed in Plugins #394

- Updated `@anarchitects/governance-core` to `0.0.4` in both
  `@anarchitects/nx-governance` and `@anarchitects/governance-adapter-nx`.
- Replaced active host-runtime imports of local deterministic modules with
  public `@anarchitects/governance-core` imports.
- Simplified `packages/governance/src/plugin/run-governance.ts` to thin host
  orchestration around:
  - Nx option/profile/config resolution
  - adapter loading through `@anarchitects/governance-adapter-nx`
  - Core artifact assembly and deterministic analysis
  - host rendering, snapshot writing, and AI handoff writing
- Excluded the following local trees from build/test/package surface:
  - `health-engine`
  - `metric-engine`
  - `policy-engine`
  - `signal-engine`
  - `inventory`
  - `ai-analysis`
  - `delivery-impact`
  - `core`
  - `standalone-cli`
  - `manual-workspace`
  - `typescript-adapter`
- Excluded legacy plugin helpers now replaced by Core:
  - `plugin/apply-governance-exceptions.ts`
  - `plugin/build-exception-report.ts`
  - `plugin/evaluate-exception-lifecycle.ts`
- Strengthened boundary validation so active host runtime now fails on:
  - imports from any quarantined local deterministic folder
  - deep `@anarchitects/governance-core/*` imports
  - imports from `@anarchitects/governance-cli`
  - imports from `@anarchitects/governance-adapter-typescript`
  - source-path imports from `anarchitects/anarchitecture-community`

## Final small-surface decisions

| Module / helper                                                | Decision                        | Notes                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin/governance-run-renderers.ts`                           | `KEEP_AS_NX_EXECUTOR_RENDERING` | Executor-facing CLI rendering stays host-owned. It is presentation, not reusable governance analysis.                                                           |
| `plugin/pr-impact-host-context.ts#readChangedFiles`            | `KEEP_AS_NX_HOST_IO`            | Uses `git`, `workspaceRoot`, and process-level IO.                                                                                                              |
| `plugin/pr-impact-host-context.ts#resolveAffectedProjects`     | `REPLACED_WITH_COMMUNITY_API`   | Active runtime now uses published Core `resolveAffectedGovernanceProjects(...)`. `pr-impact-host-context.ts` keeps only git changed-files host IO.              |
| `plugin/snapshot-runtime.ts#resolveSnapshotPath`               | `KEEP_AS_NX_HOST_IO`            | Workspace-root-relative path handling stays local.                                                                                                              |
| `plugin/snapshot-runtime.ts#resolveOptionalSnapshotComparison` | `KEEP_AS_NX_HOST_IO`            | Snapshot discovery/loading stays local even though it composes Core `compareSnapshots(...)`.                                                                    |
| `plugin/snapshot-runtime.ts#toSnapshotDeliveryImpactSummary`   | `REPLACED_WITH_COMMUNITY_API`   | Active runtime now uses published Core `buildSnapshotDeliveryImpactSummary(...)`. `snapshot-runtime.ts` keeps only snapshot path and file orchestration.        |
| `plugin/ai-payload-scope.ts`                                   | `REMOVED_FROM_ACTIVE_RUNTIME`   | Replaced with published Core payload helpers and a host-owned `plugin/ai-payload-limits.ts` constants file.                                                     |
| `plugin/drift-ai-analysis.ts`                                  | `REMOVED_FROM_ACTIVE_RUNTIME`   | `summarizeDriftInterpretation(...)` now imports directly from `@anarchitects/governance-core`.                                                                  |
| `plugin/ai-payload-limits.ts`                                  | `KEEP_AS_NX_HOST_OPTIONS`       | Constants only. These are host defaults for handoff size, not reusable deterministic analysis.                                                                  |
| `governance-adapter-nx/src/codeowners.ts`                      | `KEEP_AS_NX_ADAPTER_OWNED`      | CODEOWNERS-to-Nx-project ownership mapping is still adapter-local. Generic CODEOWNERS parsing could move to Community later, but it is not required for `#394`. |

## Remaining intentional quarantine

The following trees still exist physically and remain excluded from compile,
test, export, and active runtime surfaces:

- `core/**`
- `standalone-cli/**`
- `manual-workspace/**`
- `typescript-adapter/**`
- `health-engine/**`
- `metric-engine/**`
- `policy-engine/**`
- `signal-engine/**`
- `inventory/**`
- `ai-analysis/**`
- `delivery-impact/**`

They remain as cleanup debt only. They are not part of the published host or
adapter runtime, and boundary tests fail if active code imports them.

## Package-surface result

`@anarchitects/nx-governance` remains host-focused:

- root compatibility shell
- `./host`
- `./plugin`
- Nx executors and generators metadata

It does not export local Core-like implementation folders.

## Blocker status

Plugins `#394` is no longer blocked on Community `#127`.

The major reusable Core-candidate helper logic identified in earlier passes has
been replaced by published Core `0.0.4` APIs in active runtime. The remaining
follow-up items listed above are narrow, non-blocking utility candidates rather
than host/runtime ownership blockers.

CLI-owned and TypeScript-adapter-owned legacy trees remain quarantined from
`@anarchitects/nx-governance` runtime and are not a blocker for the Nx host /
Core split.

Non-blocking future Community follow-up remains limited to:

- optional generic CODEOWNERS parsing if Community wants a host-independent utility

Result:

- `#394` can close once the code changes in this repository are accepted.
- `#388` can start. It should treat the remaining excluded legacy trees as
  cleanup debt, not as a blocker for the Nx host/Core boundary split.
