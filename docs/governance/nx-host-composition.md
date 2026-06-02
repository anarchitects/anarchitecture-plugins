# Nx Governance Host Composition

## Purpose

This document records the #410 host composition migration for
`@anarchitects/nx-governance`.

The issue changes composition only. It does not move executors, generators,
Project Crystal integration, adapter extraction logic, extension rule logic,
metrics, recommendations, renderers, or Governance Core contracts.

## Composition Flow

The host-owned runtime flow is:

```text
executor or host entrypoint
  -> @anarchitects/nx-governance host composition
    -> @anarchitects/governance-adapter-nx
    -> @anarchitects/governance-extension-nx through Governance Core extension contracts
    -> @anarchitects/governance-core artifact generation
    -> @anarchitects/nx-governance rendering and output routing
```

The concrete composition entrypoint is
`packages/governance/src/plugin/compose-governance-runtime.ts`.

`packages/governance/src/plugin/run-governance.ts` continues to own profile
loading, conformance input resolution, final assessment shaping, command
orchestration, and output routing. It delegates adapter/core/extension runtime
composition to the focused composition module.

## Host Responsibilities

`@anarchitects/nx-governance` owns:

- Nx plugin runtime
- `createNodesV2` integration
- Project Crystal integration
- Nx generators
- Nx executors
- host composition
- profile loading
- extension loading
- artifact generation
- output routing
- command orchestration

The host composes the adapter, extension registry, capability registry, Core
artifact generation, diagnostics, findings, signals, measurements, and
recommendations. It does not reinterpret diagnostics as findings or
recommendations.

## Adapter Responsibilities

`@anarchitects/governance-adapter-nx` owns:

- workspace discovery
- Nx project graph extraction
- dependency extraction
- tags extraction
- target extraction
- ownership extraction
- canonical node mapping
- canonical relation mapping
- capability emission
- adapter diagnostics

The host consumes adapter output through public
`@anarchitects/governance-core` adapter result contracts.

## Extension Responsibilities

`@anarchitects/governance-extension-nx` owns future Nx-specific:

- rules
- metrics
- signals
- recommendations
- enrichers
- capability-aware interpretation

The host registers extensions through public Governance Core extension
contracts. The extension does not import the adapter, executor internals,
generator internals, renderer internals, or host internals.

## Dependency Direction

Allowed:

```text
@anarchitects/nx-governance -> @anarchitects/governance-core
@anarchitects/nx-governance -> @anarchitects/governance-adapter-nx
@anarchitects/nx-governance -> dynamically loaded Governance extensions
executor -> host
```

Forbidden:

```text
@anarchitects/governance-adapter-nx -> @anarchitects/governance-extension-nx
@anarchitects/governance-extension-nx -> @anarchitects/governance-adapter-nx
@anarchitects/governance-core -> adapter or extension packages
extension -> executor, generator, renderer, or host internals
```

## Preserved Workflows

Executors and generated artifacts continue to call the existing
`@anarchitects/nx-governance` host APIs.

Generators remain inside `@anarchitects/nx-governance`.

`createNodesV2` and Project Crystal integration remain inside
`@anarchitects/nx-governance`.

Compatibility output from existing reports is preserved because Core artifact
generation and final assessment shaping are still invoked with the same profile,
workspace, capabilities, diagnostics, conformance findings, exceptions, and
warnings as before.

## Follow-Up

#411 remains the follow-up for executor-specific work.

#412 remains the follow-up for renderer-specific work.

#413 remains the follow-up for profile registration work.
