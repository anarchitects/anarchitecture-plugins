# Nx Governance Ownership Audit

Historical note: this document records the plugins-side ownership cleanup for
Plugins `#394` and `#402`.

Current boundary guidance is now maintained in:

- [`community-meta-plugin-boundaries.md`](./community-meta-plugin-boundaries.md)
- [`community-contract-alignment-audit.md`](./community-contract-alignment-audit.md)
- [`../../packages/governance/ARCHITECTURE.md`](../../packages/governance/ARCHITECTURE.md)

Issue: Plugins #394  
Related: Community #127  
Cleanup update: Plugins #402

Community baseline consumed in this historical pass:

- `@anarchitects/governance-core@0.0.4`
- `@anarchitects/governance-cli@0.0.4`
- `@anarchitects/governance-adapter-typescript@0.0.4`

## Scope

This audit records the final boundary state for `@anarchitects/nx-governance`
after the published Community package updates were consumed in Plugins,
including the Core `0.0.4` micro-follow-up helpers.

Plugins #402 completed the plugins-side cleanup that #394 left as quarantine
debt: local Core-like, standalone CLI, manual workspace, TypeScript adapter,
analysis, delivery-impact, policy, metric, signal, inventory, and legacy
exception-helper source trees have been removed from `@anarchitects/nx-governance`.
The active package now keeps only host-owned runtime, executor, generator,
profile, rendering, extension-loading, and compatibility guardrail code.

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

| Module / Path                                                    | Current responsibility                                             | Target owner                                  | Final state                | Notes                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/governance/src/plugin/**`                              | Nx runtime orchestration, option resolution, output writing        | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | `run-governance.ts` now orchestrates published Core APIs instead of local deterministic modules.            |
| `packages/governance/src/nx-host/**`                             | Nx extension discovery, config loading, module loading             | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Host-only Nx integration remains local.                                                                     |
| `packages/governance/src/executors/**`                           | Nx executor entrypoints and compatibility shell                    | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Public executor ids and target behavior stay unchanged.                                                     |
| `packages/governance/src/generators/**`                          | Nx generator entrypoints and scaffolding                           | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Nx-specific package setup remains local.                                                                    |
| `packages/governance/src/conformance-adapter/**`                 | Host-side conformance input loading                                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Still an Nx host integration concern.                                                                       |
| `packages/governance/src/snapshot-store/**`                      | Snapshot persistence and workspace-relative file IO                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Output persistence remains host-owned.                                                                      |
| `packages/governance/src/ai-handoff/**`                          | AI handoff file rendering and persistence                          | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Host writes artifacts; deterministic request construction now comes from Core where available.              |
| `packages/governance/src/reporting/**`                           | CLI, JSON, and management rendering                                | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Presentation remains Nx host-owned.                                                                         |
| `packages/governance-adapter-nx/src/**`                          | Nx graph loading and Nx-to-Core workspace mapping                  | `@anarchitects/governance-adapter-nx`         | `KEEP_AS_NX_ADAPTER_OWNED` | Adapter remains responsible for Nx workspace extraction and mapping.                                        |
| `packages/governance/src/health-engine/**`                       | Deterministic health scoring and recommendations                   | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core health and recommendation APIs.                                     |
| `packages/governance/src/metric-engine/**`                       | Deterministic metric calculation                                   | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core metric APIs.                                                        |
| `packages/governance/src/policy-engine/**`                       | Deterministic policy evaluation                                    | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core policy APIs.                                                        |
| `packages/governance/src/signal-engine/**`                       | Deterministic signal builders and signal contracts                 | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core signal APIs.                                                        |
| `packages/governance/src/inventory/**`                           | Workspace normalization and inventory assembly                     | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core workspace/inventory APIs.                                           |
| `packages/governance/src/ai-analysis/**`                         | Deterministic AI request builders and summarizers                  | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core AI request and summarizer APIs for supported flows.                 |
| `packages/governance/src/delivery-impact/**`                     | Deterministic delivery-impact calculation and models               | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Active host runtime uses published Core delivery-impact APIs.                                               |
| `packages/governance/src/plugin/apply-governance-exceptions.ts`  | Legacy local exception application helper                          | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Host runtime calls published Core exception APIs through the Core artifact builder.                         |
| `packages/governance/src/plugin/build-exception-report.ts`       | Legacy local exception report helper                               | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Host runtime uses published Core exception report output from Core artifacts.                               |
| `packages/governance/src/plugin/evaluate-exception-lifecycle.ts` | Legacy local exception lifecycle helper                            | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | Host runtime uses published Core exception lifecycle handling.                                              |
| `packages/governance/src/core/**`                                | Legacy local Core contracts and deterministic logic                | `@anarchitects/governance-core`               | `REMOVED_IN_PLUGINS_402`   | No active host runtime imports remained before removal. Boundary tests now fail if this local tree returns. |
| `packages/governance/src/standalone-cli/**`                      | Standalone CLI runtime                                             | `@anarchitects/governance-cli`                | `REMOVED_IN_PLUGINS_402`   | Standalone CLI behavior belongs to Community CLI, not the Nx host package.                                  |
| `packages/governance/src/manual-workspace/**`                    | Generic non-Nx workspace loading for standalone CLI flows          | `@anarchitects/governance-cli`                | `REMOVED_IN_PLUGINS_402`   | Manual workspace behavior belongs to the standalone CLI/community side.                                     |
| `packages/governance/src/typescript-adapter/**`                  | Generic TypeScript workspace discovery and import graph extraction | `@anarchitects/governance-adapter-typescript` | `REMOVED_IN_PLUGINS_402`   | Generic TypeScript adapter behavior belongs to the Community adapter package.                               |
| `packages/governance/src/index.ts`                               | Root compatibility shell                                           | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Kept as a documented compatibility shell; Core-like local modules are not exported.                         |
| `packages/governance/src/host-public-api.ts`                     | Host-focused package entrypoint                                    | `@anarchitects/nx-governance`                 | `KEEP_AS_NX_HOST_OWNED`    | Canonical host-facing entrypoint remains local.                                                             |

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

## Plugins #402 cleanup completion

The following trees no longer exist in the plugins-side Nx host source:

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

The corresponding legacy exclusions were removed from `tsconfig.lib.json`,
`tsconfig.spec.json`, and `jest.config.cts`. Boundary tests now fail if those
local source paths return or if active host code imports their retired paths.

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

CLI-owned and TypeScript-adapter-owned behavior is no longer present as local
Nx host source and is not a blocker for the Nx host / Core split.

Non-blocking future Community follow-up remains limited to:

- optional generic CODEOWNERS parsing if Community wants a host-independent utility

Result:

- `#394` can remain closed.
- Plugins `#402` completes the plugins-side removal of the remaining excluded
  legacy trees.
- Future Nx host work should treat Community Core, CLI, and TypeScript adapter
  packages as the authoritative owners for the removed behavior.

## Release sequencing notes

- `@anarchitects/governance-adapter-nx` is the first package that must be
  published from this repository. `@anarchitects/nx-governance` depends on it.
- `@anarchitects/nx-governance` must not be published with
  `"@anarchitects/governance-adapter-nx": "workspace:*"`. The manifest now pins
  the current publishable adapter version instead of a workspace protocol.
- Community `#127` no longer blocks Plugins `#388`. Remaining Governance
  follow-up issues are non-blocking release debt:
  - Plugins `#403` for future Git/VCS adapter extraction from host IO
  - Community `#133` for the future Community Git/VCS adapter package
