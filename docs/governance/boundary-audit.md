# Governance Boundary Audit

## Scope

This audit covers the Governance Core-facing candidates requested in issue #373:

- `packages/governance/src/core`
- `packages/governance/src/policy-engine`
- `packages/governance/src/metric-engine`
- `packages/governance/src/health-engine`
- `packages/governance/src/signal-engine`
- `packages/governance/src/inventory`
- `packages/governance/src/extensions/contracts.ts`
- `packages/governance/src/extensions/capabilities.ts`
- `packages/governance/src/extensions/diagnostics.ts`

Context-only areas inspected for ownership and isolation:

- `packages/governance/src/extensions/host.ts`
- `packages/governance/src/nx-host/extensions/config.ts`
- `packages/governance/src/nx-host/extensions/host.ts`
- `packages/governance/src/nx-adapter`
- `packages/governance/src/standalone-cli`
- `packages/governance/src/manual-workspace`
- `packages/governance/src/typescript-adapter`
- `packages/governance/src/executors`
- `packages/governance/src/generators`
- `packages/governance/src/plugin`

Note: `packages/governance/src/extensions/config.ts` does not exist in the current tree. Nx-specific extension config loading has already been relocated to `packages/governance/src/nx-host/extensions/config.ts`.

## Commands / Checks Used

```bash
rg -n --glob '!**/*.json' --glob '!**/*.md' --glob '!**/fixtures/**' "@nx/devkit|from 'nx'|from \"nx\"|workspaceRoot|nx\.json|project\.json|ProjectGraph|CreateNodes|executor|generator|plugin|\.\./nx-adapter|\.\./executors|\.\./generators|\.\./plugin|\.\./standalone-cli|\.\./typescript-adapter|\.\./manual-workspace|from 'fs'|from \"fs\"|from 'node:fs'|from \"node:fs\"|from 'path'|from \"path\"|from 'node:path'|from \"node:path\"|process\." packages/governance/src/core packages/governance/src/policy-engine packages/governance/src/metric-engine packages/governance/src/health-engine packages/governance/src/signal-engine packages/governance/src/inventory packages/governance/src/extensions/contracts.ts packages/governance/src/extensions/capabilities.ts packages/governance/src/extensions/diagnostics.ts

rg -n --glob '!**/*.json' --glob '!**/*.md' "@nx/devkit|from 'nx'|from \"nx\"|workspaceRoot|nx\.json|project\.json|ProjectGraph|CreateNodes|executor|generator|plugin|from 'fs'|from \"fs\"|from 'node:fs'|from \"node:fs\"|from 'path'|from \"path\"|from 'node:path'|from \"node:path\"|process\." packages/governance/src/extensions/host.ts packages/governance/src/nx-host/extensions/config.ts packages/governance/src/nx-host/extensions/host.ts packages/governance/src/nx-adapter packages/governance/src/standalone-cli packages/governance/src/manual-workspace packages/governance/src/typescript-adapter packages/governance/src/executors packages/governance/src/generators packages/governance/src/plugin

rg -n "from '../signal-engine/index\.js'|from '../core/signals\.js'|from '../core/index\.js'" packages/governance/src/extensions packages/governance/src/metric-engine packages/governance/src/health-engine packages/governance/src/policy-engine packages/governance/src/signal-engine packages/governance/src/inventory

yarn nx show projects --json
```

Files with findings were then inspected directly with `sed`.

## Summary

- Most Core-facing runtime modules are already free of direct Nx, host runtime, and adapter implementation imports.
- No audited Core-facing runtime module imports `@nx/devkit`, `nx`, `../plugin`, `../executors`, `../generators`, `../standalone-cli`, `../typescript-adapter`, or `../manual-workspace`.
- The remaining runtime leaks are concentrated in two places:
  - `packages/governance/src/signal-engine/builders.ts`
  - `packages/governance/src/extensions/contracts.ts`
- There is also indirect coupling from `metric-engine` to the mixed `signal-engine` barrel.

## Findings

| Area                                                            | Finding                                                                                                                                                                                                                             | Classification            | Recommended action                                                                                                                                   | Timing                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `core`                                                          | No direct Nx, host runtime, or adapter implementation imports found in runtime source. `workspaceRoot` and `pluginVersion` appear as data fields, not runtime dependencies.                                                         | `CLEAN`                   | None. Keep the Core runtime import boundary as-is.                                                                                                   | None                                    |
| `policy-engine`                                                 | Runtime source is a thin wrapper over `../core/index.js` only.                                                                                                                                                                      | `CLEAN`                   | None.                                                                                                                                                | None                                    |
| `health-engine`                                                 | No direct Nx, host runtime, or adapter implementation imports found.                                                                                                                                                                | `CLEAN`                   | None.                                                                                                                                                | None                                    |
| `inventory`                                                     | Runtime source depends on `GovernanceWorkspaceAdapterResult` from `../core/index.js` and no longer imports Nx adapter types directly.                                                                                               | `CLEAN`                   | None.                                                                                                                                                | None                                    |
| `extensions/capabilities.ts`                                    | Generic capability registry is free of Nx and adapter imports.                                                                                                                                                                      | `CLEAN`                   | None.                                                                                                                                                | None                                    |
| `extensions/diagnostics.ts`                                     | Diagnostic contracts are free of Nx and adapter imports.                                                                                                                                                                            | `CLEAN`                   | None.                                                                                                                                                | None                                    |
| `signal-engine/builders.ts`                                     | Direct type-only imports from `../nx-adapter/graph-adapter.js` and `../conformance-adapter/conformance-adapter.js` keep a Core-facing area coupled to adapter-owned contracts.                                                      | `BLOCKER_FOR_SPLIT`       | Separate Core signal contracts from adapter-fed signal builders, or move graph/conformance signal building behind adapter or host-owned boundaries.  | Fix in `#328`                           |
| `metric-engine`                                                 | `calculate-metrics.ts` and `aggregate-signals.ts` import `GovernanceSignal` from `../signal-engine/index.js`, which is a mixed barrel that also exports adapter-coupled builders. This is type-level coupling, not direct Nx usage. | `FIX_IN_328`              | Import signal contracts from `../core/signals.js` or `../core/index.js` instead of the mixed `signal-engine` barrel.                                 | Fix in `#328`                           |
| `extensions/contracts.ts`                                       | Imports `GovernanceSignal` from `../signal-engine/index.js`, so extension contracts still depend on a mixed barrel rather than a Core-owned signal contract path.                                                                   | `FIX_IN_328`              | Repoint extension contracts at `../core/signals.js` or a Core barrel that contains only portable contracts.                                          | Fix in `#328`                           |
| `extensions/contracts.ts`                                       | `GovernanceExtensionHostContext` exposes `workspaceRoot: string`. This is not Nx-specific, but it is host-runtime context on a Core-facing contract.                                                                                | `DEFER_TO_329`            | Decide whether `workspaceRoot` remains a portable extension contract or moves behind capabilities/host-owned APIs before the physical package split. | Defer to `#329`                         |
| `signal-engine/types.ts`                                        | Re-exports signal contracts from `../core/signals.js` and is portable by itself. The leak is in builders, not types.                                                                                                                | `ACCEPTABLE_TRANSITIONAL` | Keep until the builders/types split is made explicit.                                                                                                | Fix in `#328` alongside builder cleanup |
| `extensions/host.ts`                                            | No direct Nx or filesystem imports. It still contains legacy `nx.json.plugins` deprecation wording because it receives legacy load requests from the Nx host layer.                                                                 | `ACCEPTABLE_TRANSITIONAL` | Keep generic runtime registration here; keep Nx config loading and plugin probing under `nx-host`.                                                   | Defer to `#329`                         |
| `nx-host/extensions/config.ts` and `nx-host/extensions/host.ts` | Uses `@nx/devkit`, `fs`, `path`, and `nx.json` as expected for Nx host ownership. This code is already isolated under `nx-host`.                                                                                                    | `ACCEPTABLE_TRANSITIONAL` | None, beyond preserving the separation from Core-facing modules.                                                                                     | None                                    |

## Confirmed Clean Areas

- `packages/governance/src/core`
- `packages/governance/src/policy-engine`
- `packages/governance/src/health-engine`
- `packages/governance/src/inventory`
- `packages/governance/src/extensions/capabilities.ts`
- `packages/governance/src/extensions/diagnostics.ts`

No direct imports were found from those runtime areas to:

- `@nx/devkit`
- `nx`
- `../plugin`
- `../executors`
- `../generators`
- `../standalone-cli`
- `../typescript-adapter`
- `../manual-workspace`

## Suspicious Dependencies Requiring Review

- `packages/governance/src/extensions/contracts.ts`
  - `workspaceRoot` is host-runtime context on a Core-facing contract. It is portable as a string, but it is still a host concern.
- `packages/governance/src/core/models.ts` and `packages/governance/src/core/snapshots.ts`
  - `pluginVersion` is not an Nx API dependency, but it bakes plugin-oriented provenance into Core snapshot contracts. This is acceptable for now, but worth revisiting during the package split.

## Test-Only Findings

| Area                                  | Finding                                                                                                                                                          | Classification | Recommended action                                                                          | Timing                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| `core/no-nx-confidence.spec.ts`       | Uses `node:fs` and `node:path` to scan source files and assert that Core-facing implementation files stay free of Nx, plugin, executor, and generator imports.   | `TEST_ONLY`    | Keep. This is a useful architectural guardrail until dedicated enforcement lands in `#376`. | None                            |
| `extensions/boundaries.spec.ts`       | Uses `node:fs` and `node:path` to assert that Nx-specific extension discovery stays under `nx-host` and out of generic extension contracts/runtime registration. | `TEST_ONLY`    | Keep.                                                                                       | None                            |
| `signal-engine/signal-engine.spec.ts` | Imports `WorkspaceGraphSnapshot` and `ConformanceSnapshot` types from adapter-owned modules to build fixtures for the current mixed signal builders.             | `TEST_ONLY`    | Update when the builder/input boundary is refactored.                                       | Fix with `#328` runtime cleanup |

## Acceptable Transitional Findings

- `packages/governance/src/nx-host/extensions/config.ts` and `packages/governance/src/nx-host/extensions/host.ts` are correctly Nx-owned and already separated from `packages/governance/src/extensions/*`.
- `packages/governance/src/plugin/run-governance.ts` imports Nx-host extension registration from `../nx-host/extensions/*`, which is the right ownership direction for host orchestration.
- `packages/governance/src/generators/add-extension/generator.ts` depends on `../../nx-host/extensions/config.js`; this is generator-owned setup code, not Core leakage.

## Recommended Follow-Up

1. In `#328`, split `signal-engine` into a portable contract surface and host/adapter-fed builders so no Core-facing module depends on `nx-adapter` or `conformance-adapter`.
2. In `#328`, update `metric-engine` and `extensions/contracts.ts` to import signal contracts from a Core-owned path instead of `signal-engine/index.js`.
3. In `#329`, decide whether `GovernanceExtensionHostContext.workspaceRoot` remains part of the portable extension contract or moves behind a host capability.
4. In `#329`, revisit Core snapshot provenance names such as `pluginVersion` if the future Core package should be host-neutral in terminology as well as dependencies.

## Conclusion

Current status is close to split-readiness for the audited Core-facing runtime modules. The main remaining blockers are not broad Nx leakage across the codebase; they are a small number of mixed-barrel and adapter-input couplings that should be addressed before treating `signal-engine` and extension contracts as portable Core-facing surfaces.
