# Nx Governance Ownership Audit

Issue: Plugins #394  
Related: Community #127  
Core dependency baseline: `@anarchitects/governance-core@0.0.2`

## Scope

This audit records the final boundary state for `@anarchitects/nx-governance`
after the Community #127 Core backfill landed and Plugins #394 rewired the
active host runtime to published Core APIs.

`@anarchitects/nx-governance` is now treated as a thin Nx host package:

- parse executor, generator, plugin, and inferred-target options
- resolve Nx workspace paths and config conventions
- load workspace facts through `@anarchitects/governance-adapter-nx`
- call `@anarchitects/governance-core` public APIs
- render and persist Nx-specific outputs
- preserve existing Nx target compatibility

The host no longer owns deterministic Governance domain logic as active runtime
implementation.

## Final classification

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

- Updated `@anarchitects/governance-core` to `0.0.2` in both
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

## Package-surface result

`@anarchitects/nx-governance` remains host-focused:

- root compatibility shell only
- `./host`
- `./plugin`
- Nx executors and generators metadata

It does not export local Core-like implementation folders.

## Blocker status

Plugins `#394` is no longer blocked on Community `#127`.

The former blocker module groups:

- `health-engine`
- `metric-engine`
- `policy-engine`
- `signal-engine`
- `inventory`
- `ai-analysis`
- `delivery-impact`

have been replaced in the active host runtime by published
`@anarchitects/governance-core@0.0.2` APIs and quarantined from the package
surface.

Result:

- `#394` can close once the code changes in this repository are accepted.
- `#388` can start. It should treat the remaining excluded legacy trees as
  cleanup debt, not as a blocker for the Nx host/Core boundary split.
