# @anarchitects/governance-extension-nx

`@anarchitects/governance-extension-nx` is the dedicated Governance Core
extension package for future Nx-specific governance interpretation.

This package introduces the extension boundary only. #408 classified the
current rule implementations and found no existing Nx-specific rules to move.
It does not move generic rules, metrics, recommendations, enrichers, signal
providers, extraction logic, host composition, executors, renderers, or profile
registration.

## Public API

- `governanceExtensionNx`
- `createGovernanceExtensionNx`
- `GOVERNANCE_EXTENSION_NX_ID`
- `GOVERNANCE_EXTENSION_NX_NAME`
- `GOVERNANCE_EXTENSION_NX_VERSION`
- `GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES`

## Architecture

The dependency direction is:

```text
@anarchitects/governance-extension-nx
  -> @anarchitects/governance-core
```

The extension package must not depend on:

- `@anarchitects/governance-adapter-nx`
- `@anarchitects/nx-governance` host internals
- executor internals
- renderer internals
- generator internals
- Governance Core source paths

It uses only public Governance Core extension contracts.

## Responsibilities

This package owns future Nx-specific:

- rule packs
- metric providers
- signal providers
- recommendations
- enrichers
- capability-aware interpretation

Registration is currently no-op. No rule packs, metric providers, signal
providers, or enrichers are registered because no current rule implementation is
Nx-specific.

Current generic project/dependency, ownership, metadata, domain, layer, and tag
convention rules remain outside this package.

## Non-Responsibilities

This package does not own:

- Nx project graph loading
- Nx workspace discovery
- Nx config loading
- Project Crystal target inference
- Nx executors
- Nx generators
- output routing
- rendering
- adapter extraction logic
- canonical Governance semantics

Those responsibilities remain in the adapter, host, executors, renderers, or Governance Core.

## Relationship To The Nx Adapter

`@anarchitects/governance-adapter-nx` extracts Nx facts and emits canonical nodes, relations, and `nx.*` capabilities.

`@anarchitects/governance-extension-nx` interprets those capabilities in future work. It does not import the adapter or duplicate adapter extraction logic.

## Relationship To The Nx Host

`@anarchitects/nx-governance` remains the user-facing Nx host package. It will compose adapters and extensions in a later issue. This package does not modify host composition.

Planned follow-up issues:

- `#408` classified existing rules and found no current Nx-specific rules to
  move.
- `#409` moves Nx metrics and recommendations.
- `#410` wires host composition.
