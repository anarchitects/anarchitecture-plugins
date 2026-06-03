# Governance Source Organization

Issue: Plugins #402

This document records the plugins-side Governance package cleanup after the
Phase 2 split. Community-owned Governance behavior is not implemented in this
repository.

## Package Ownership

| Package                               | Ownership                                                                                                                                                                                                                             | Must not own                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@anarchitects/nx-governance`         | Nx executors, generators, Project Crystal inference, profile/config resolution, host composition, extension loading, artifact generation, snapshot persistence, executor-facing rendering, output routing, and command orchestration. | Core contracts, standalone CLI runtime, generic TypeScript workspace discovery, Nx extraction internals, or Nx interpretation rules/metrics/recommendations. |
| `@anarchitects/governance-adapter-nx` | Nx graph loading, workspace discovery, project/dependency/tag/target/metadata extraction, Nx-to-Core mapping, canonical nodes/relations, diagnostics, and capabilities.                                                               | Host executors/generators, rule evaluation, metrics, recommendations, rendering, or extension registration.                                                  |
| `governance-extension-nx`             | Nx-specific interpretation that consumes adapter capabilities: rules, metrics, signals, recommendations, enrichers, and registration.                                                                                                 | Nx graph extraction, host runtime, executors, generators, renderers, or Core contracts.                                                                      |

## Removed Plugins-Side Legacy Trees

The following `@anarchitects/nx-governance` source trees were removed in
Plugins #402 because they were already excluded from build/test surfaces,
not exported by the package, and replaced by Community packages or focused
plugins packages:

- `packages/governance/src/core/**`
- `packages/governance/src/standalone-cli/**`
- `packages/governance/src/manual-workspace/**`
- `packages/governance/src/typescript-adapter/**`
- `packages/governance/src/health-engine/**`
- `packages/governance/src/metric-engine/**`
- `packages/governance/src/policy-engine/**`
- `packages/governance/src/signal-engine/**`
- `packages/governance/src/inventory/**`
- `packages/governance/src/ai-analysis/**`
- `packages/governance/src/delivery-impact/**`

The legacy plugin helper files below were also removed because active runtime
uses published `@anarchitects/governance-core` behavior instead:

- `packages/governance/src/plugin/apply-governance-exceptions.ts`
- `packages/governance/src/plugin/build-exception-report.ts`
- `packages/governance/src/plugin/evaluate-exception-lifecycle.ts`

Equivalent ownership now lives in:

- `@anarchitects/governance-core`
- `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-adapter-nx`
- `governance-extension-nx`

## Bounded Context Layout

Current plugins-side source organization is intentionally uneven by package:
folders exist only where a package actually owns that bounded context.

`@anarchitects/nx-governance` keeps host-owned contexts under:

- `plugin` for host composition and command orchestration
- `executors` for Nx executor entrypoints
- `generators` for Nx generator entrypoints
- `nx-host` for Nx extension discovery/loading
- `profile` and `presets` for host profile resolution
- `reporting`, `snapshot-store`, `ai-handoff`, and `graph-document` for host
  artifact/rendering concerns
- `compatibility` and `boundaries` for package-surface guardrails

`@anarchitects/governance-adapter-nx` keeps adapter-owned concerns in focused
modules:

- `graph-adapter.ts` and `read-workspace.ts` for Nx discovery/extraction
- `to-governance-workspace-adapter-result.ts` for Nx-to-Core mapping
- `capability.ts` for adapter capabilities
- `codeowners.ts` and `tag-parsing.ts` for adapter metadata extraction helpers

`governance-extension-nx` currently has only registration and capability
metadata. It remains a small single implementation module until it owns real
rules, metrics, signals, recommendations, or enrichers. Splitting it now would
create artificial structure without a bounded-context benefit.

## Boundary Guardrails

The package boundary tests enforce that:

- removed local Core-like, standalone CLI, manual workspace, TypeScript adapter,
  analysis, delivery-impact, metric, policy, signal, and inventory source trees
  do not return under `@anarchitects/nx-governance`
- `@anarchitects/nx-governance` does not depend on `@anarchitects/governance-cli`
  or `@anarchitects/governance-adapter-typescript`
- active host runtime imports `@anarchitects/governance-core` and
  `@anarchitects/governance-adapter-nx` only through package roots
- public package exports remain limited to the root compatibility shell,
  `./host`, and `./plugin`
- adapter and extension packages keep their package-specific responsibilities
