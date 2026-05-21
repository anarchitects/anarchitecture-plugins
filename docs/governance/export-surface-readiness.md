# Governance Export Surface Readiness

Issue: #377  
Epic: #328

## Scope

This document clarifies which Governance modules in the current
`@anarchitects/nx-governance` package look like stable public API candidates
for the future package split, and which modules should remain internal host or
implementation detail.

This is a readiness document only.

- No physical package split is performed here.
- No exports are removed in this issue.
- No runtime behavior changes are introduced in this issue.

## Current Export Surface Summary

The current package publishes three distinct surfaces from one package:

- JavaScript entrypoint: `packages/governance/src/index.ts`
- Nx plugin/executor/generator host surface: `packages/governance/src/index.json`
- Standalone CLI binary: `packages/governance/src/standalone-cli/bin/agov.ts`

Today the root barrel in `packages/governance/src/index.ts` is a mixed surface.
It exports:

- Nx executors and generators
- the Nx plugin default export
- Governance Core contracts and logic
- signal, metrics, reporting, drift, AI, and snapshot helpers
- selected Nx adapter and conformance adapter modules
- standalone CLI modules
- TypeScript adapter modules
- manual workspace loader modules

That root barrel is useful for backward compatibility inside the current single
package, but it is not a clean future public API boundary.

## Future Package Ownership Mapping

| Area                                             | Current export/import                                              | Classification                               | Future package                                                                               | Notes                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/core/index.ts`                              | Core contracts, rule engine, profile, snapshots, drift, exceptions | `PUBLIC_CORE_API`                            | `@anarchitects/governance-core`                                                              | Canonical Governance contracts and deterministic logic.                                            |
| `src/extensions/contracts.ts`                    | Extension definition and execution contracts                       | `PUBLIC_EXTENSION_API`                       | `@anarchitects/governance-core` or `@anarchitects/governance-extension-*` dependency surface | Portable extension seam, but current host context still includes `workspaceRoot`.                  |
| `src/extensions/capabilities.ts`                 | Capability registry contracts                                      | `PUBLIC_EXTENSION_API`                       | `@anarchitects/governance-core`                                                              | Stable capability registry candidate.                                                              |
| `src/extensions/diagnostics.ts`                  | Extension diagnostic codes and shape                               | `PUBLIC_EXTENSION_API`                       | `@anarchitects/governance-core`                                                              | Stable diagnostic contract candidate.                                                              |
| `src/extensions/runtime.ts`                      | Extension registry and registration helpers                        | `PUBLIC_EXTENSION_API`                       | `@anarchitects/governance-core`                                                              | Runtime registry is portable; loader/discovery must stay host-owned.                               |
| `src/standalone-cli/check.ts`                    | `runAgovCheck` and result contract                                 | `PUBLIC_CLI_API`                             | `@anarchitects/governance-cli`                                                               | Useful library seam for CLI-grade checks.                                                          |
| `src/standalone-cli/agov.ts`                     | argv parsing, exit codes, IO wiring                                | `INTERNAL_HOST_IMPLEMENTATION`               | `@anarchitects/governance-cli`                                                               | Command wiring, not cross-package domain API.                                                      |
| `src/standalone-cli/render-report.ts`            | CLI output shaping for `agov check`                                | `INTERNAL_HOST_IMPLEMENTATION`               | `@anarchitects/governance-cli`                                                               | CLI presentation layer, not canonical Governance API.                                              |
| `src/typescript-adapter/index.ts`                | TypeScript workspace detection, discovery, import graph, mapping   | `PUBLIC_TYPESCRIPT_ADAPTER_API`              | `@anarchitects/governance-adapter-typescript`                                                | Good future adapter barrel, but some granular helpers should not be promoted individually.         |
| `src/typescript-adapter/types.ts`                | TypeScript adapter result contracts                                | `PUBLIC_TYPESCRIPT_ADAPTER_API`              | `@anarchitects/governance-adapter-typescript`                                                | Stable adapter-facing types.                                                                       |
| `src/nx-adapter/graph-adapter.ts`                | Nx graph snapshot reader and summary                               | `PUBLIC_NX_ADAPTER_API`                      | `@anarchitects/governance-adapter-nx`                                                        | Useful stable Nx adapter seam.                                                                     |
| `src/nx-adapter/capability.ts`                   | Nx capability payload builder                                      | `PUBLIC_NX_ADAPTER_API`                      | `@anarchitects/governance-adapter-nx`                                                        | Stable capability mapping candidate.                                                               |
| `src/nx-adapter/read-workspace.ts`               | Nx workspace-to-core adapter result mapping                        | `PUBLIC_NX_ADAPTER_API`                      | `@anarchitects/governance-adapter-nx`                                                        | Not exported from the current root barrel, but it is the host’s actual adapter seam.               |
| `src/plugin/index.ts`                            | `createNodesV2` inference plugin                                   | `INTERNAL_HOST_IMPLEMENTATION`               | `@anarchitects/nx-governance`                                                                | Public as an Nx plugin behavior, but not a future cross-package library API.                       |
| `src/plugin/run-governance.ts`                   | Nx runtime orchestration                                           | `INTERNAL_HOST_IMPLEMENTATION`               | `@anarchitects/nx-governance`                                                                | Central host wiring; should not become portable public API.                                        |
| `src/nx-host/extensions/*`                       | Nx config loading, discovery, module loading                       | `INTERNAL_HOST_IMPLEMENTATION`               | `@anarchitects/nx-governance`                                                                | Host-owned by design.                                                                              |
| `src/executors/*`                                | Nx executor implementations                                        | `INTERNAL_EXECUTOR_GENERATOR_IMPLEMENTATION` | `@anarchitects/nx-governance`                                                                | Public by executor id, not by TypeScript import path.                                              |
| `src/generators/*`                               | Nx generator implementations                                       | `INTERNAL_EXECUTOR_GENERATOR_IMPLEMENTATION` | `@anarchitects/nx-governance`                                                                | Public by generator id, not by TypeScript import path.                                             |
| `src/manual-workspace/index.ts`                  | Generic workspace loader and capability                            | `TRANSITIONAL_EXPORT`                        | `@anarchitects/governance-cli` internal, or future standalone adapter package                | Useful to the standalone CLI, but not yet a clearly stable package-level public API.               |
| `src/conformance-adapter/conformance-adapter.ts` | Nx Conformance JSON reader                                         | `TRANSITIONAL_EXPORT`                        | `@anarchitects/nx-governance` or `@anarchitects/governance-adapter-nx`                       | Exported today, but no clear target package is defined in the planned split.                       |
| `src/index.ts`                                   | Mixed catch-all root barrel                                        | `DO_NOT_EXTRACT_AS_PUBLIC_API`               | none                                                                                         | Keep only as a compatibility shell during transition; do not treat as the future package contract. |

## Stable Public API Candidates

### Core

The strongest future `@anarchitects/governance-core` public seam is the current
Core barrel in `src/core/index.ts`.

The following are the clearest stable candidates:

- canonical Governance models in `src/core/models.ts`
- adapter result contracts in `src/core/adapter.ts`
- rule contracts and rule engine in `src/core/rules.ts` and
  `src/core/rule-engine.ts`
- built-in rule pack and built-in rules in `src/core/built-in-rule-pack.ts`
  and `src/core/built-in-rules.ts`
- profile normalization contracts in `src/core/profile.ts`
- assessment, snapshots, drift, exceptions, and signal contracts in
  `src/core/assessment.ts`, `src/core/snapshots.ts`, `src/core/drift.ts`,
  `src/core/exceptions.ts`, and `src/core/signals.ts`

`src/policy-engine`, `src/metric-engine`, `src/health-engine`, and
`src/inventory` remain strong Core-adjacent candidates, but they should be
pulled into future package seams through Core-level barrels rather than
preserved as ad hoc deep-import entrypoints.

### Extensions

The portable extension public seam should be built from:

- `src/extensions/contracts.ts`
- `src/extensions/capabilities.ts`
- `src/extensions/diagnostics.ts`
- `src/extensions/runtime.ts`

These files already model the portable extension lifecycle much more cleanly
than Nx-host modules do.

The current caveat is `GovernanceExtensionHostContext.workspaceRoot` in
`src/extensions/contracts.ts`. That field keeps a host-oriented assumption
inside the nominally portable contract and should be reviewed in `#329`.

### Standalone CLI

The stable public CLI candidate is the library-style check surface in
`src/standalone-cli/check.ts`:

- `AgovCheckOptions`
- `AgovCheckResult`
- `runAgovCheck`

The `agov` argv parser, exit-code wiring, output writing, and table/markdown
formatting are better treated as CLI-internal host code.

### TypeScript Adapter

The future `@anarchitects/governance-adapter-typescript` public seam should be
shaped around the current barrel in `src/typescript-adapter/index.ts`, with the
highest-value stable APIs being:

- `detectTypeScriptWorkspace`
- `parsePackageManagerWorkspace`
- `parseTsConfigResolution`
- `discoverTypeScriptProjects`
- `buildTypeScriptImportGraph`
- `mapTypeScriptImportsToGovernanceDependencies`
- `deriveProjectTags`
- `src/typescript-adapter/types.ts` contracts

These form a coherent adapter pipeline from repository inspection to canonical
Governance project and dependency data.

### Nx Adapter

The future `@anarchitects/governance-adapter-nx` public seam should be minimal:

- `readWorkspaceGraphSnapshot`
- `readWorkspaceGraphSnapshotFromJson`
- `summarizeWorkspaceGraph`
- `createNxCapability`
- workspace adapter result loading from `src/nx-adapter/read-workspace.ts`

The important detail is that the host currently relies on
`src/nx-adapter/read-workspace.ts` through a deep import even though the package
root does not export it. That module is a real adapter seam and should be
treated as such during extraction.

## Internal Implementation Modules

The following modules should remain host-owned or implementation detail even if
their behavior is user-visible through Nx or the CLI:

- `src/plugin/index.ts`
- `src/plugin/run-governance.ts`
- `src/plugin/build-assessment-artifacts.ts`
- `src/plugin/apply-governance-exceptions.ts`
- `src/plugin/build-exception-report.ts`
- `src/plugin/resolve-conformance-input.ts`
- `src/nx-host/extensions/*`
- `src/executors/*`
- `src/generators/*`
- `src/standalone-cli/agov.ts`
- `src/standalone-cli/render-report.ts`

These modules orchestrate Nx runtime behavior, CLI host concerns, file output,
module loading, target inference, or compatibility wiring. They should not be
lifted into a future platform-independent API surface.

## Transitional Exports

The current package still contains exports that are useful now but should not be
mistaken for stable future package contracts.

| Area                                                                  | Why transitional                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                                                        | Mixed compatibility barrel combining Core, adapters, CLI, plugin, executors, and generators.                                   |
| `src/extensions/host.ts`                                              | Compatibility alias over runtime exports; name suggests host ownership while re-exporting portable runtime helpers.            |
| `src/drift-analysis/index.ts`                                         | Shim over `src/core/drift.ts`, which indicates aliasing rather than a durable package boundary.                                |
| `src/reporting/metric-breakdown.ts` and `src/reporting/top-issues.ts` | Pass-through re-exports of Core assessment helpers from a reporting folder.                                                    |
| `src/signal-engine/index.ts`                                          | Mixed surface: stable signal contracts plus builder functions that currently depend on Nx and conformance adapter input types. |
| `src/manual-workspace/index.ts`                                       | Useful to the standalone CLI, but long-term package ownership is not yet settled.                                              |
| `src/conformance-adapter/conformance-adapter.ts`                      | Public today, but not yet assigned a clear target package in the future split.                                                 |

## Deep Import Risks

The current codebase still relies on internal deep imports that should not be
treated as future public API commitments.

- `src/plugin/run-governance.ts` deep-imports `../nx-adapter/read-workspace.js`
  and `../nx-adapter/graph-adapter.js`. That reflects real host-to-adapter
  seams, but they are not formalized by the package root today.
- `src/standalone-cli/check.ts` deep-imports host-adjacent modules such as
  `../manual-workspace/index.js`, `../health-engine/calculate-health.js`,
  `../metric-engine/calculate-metrics.js`, and
  `../policy-engine/evaluate-policies.js`.
- executor implementations deep-import `../../plugin/run-governance.js` and
  `../../graph-document/contracts.js`, which is correct for internal host
  wiring but should not become part of a future library contract.
- reporting helpers deep-import `../core/assessment.js`, showing that some
  reporting wrappers are aliases rather than independent seams.
- `src/signal-engine/builders.ts` currently deep-imports
  `../conformance-adapter/conformance-adapter.js` and
  `../nx-adapter/graph-adapter.js`, so only part of the signal-engine surface is
  currently portable.

The practical risk is that a future package split could accidentally preserve
these import paths as public API merely because current code compiles against
them.

## Recommended Extraction Boundaries

- Treat `src/core/index.ts` as the canonical future `governance-core` barrel.
- Treat `src/extensions/contracts.ts`, `capabilities.ts`, `diagnostics.ts`, and
  `runtime.ts` as the portable extension surface.
- Treat `src/typescript-adapter/index.ts` as the seed for the future
  TypeScript-adapter barrel, then prune parser internals that do not need to be
  public.
- Formalize `src/nx-adapter/read-workspace.ts` as an adapter-owned API for the
  future Nx adapter package, instead of leaving it as a host-only deep import.
- Keep `src/plugin/*`, `src/nx-host/*`, `src/executors/*`, and
  `src/generators/*` in the future `@anarchitects/nx-governance` host package.
- Keep CLI argv parsing and output rendering inside the future
  `@anarchitects/governance-cli` package as internal command wiring.
- Do not carry the current catch-all `src/index.ts` root barrel into the future
  package split as a stable design target.

## Follow-up Actions for #329

- Define the future package-local barrels explicitly instead of deriving them
  from the current mixed root barrel.
- Decide whether `GovernanceExtensionHostContext.workspaceRoot` remains in the
  portable extension contract or moves behind a host capability/context object.
- Split the `signal-engine` surface into portable signal contracts/builders and
  adapter-owned graph or conformance shaping helpers.
- Decide long-term ownership of `manual-workspace`:
  CLI-internal helper or dedicated standalone adapter package.
- Decide long-term ownership of `conformance-adapter`:
  Nx adapter package or Nx host package.
- Prune TypeScript adapter exports that are parser internals rather than
  intended package API.
- Replace internal deep imports that reflect real future seams with package-local
  barrels before the physical cross-repo extraction begins.

## Non-goals and Constraints

- This document does not perform the package split.
- This document does not remove or break current exports.
- This document does not redesign Governance runtime architecture.
- This document does not add dependency enforcement beyond the focused work in
  `#376`.
- This document does not change executor ids, generator ids, or CLI behavior.
