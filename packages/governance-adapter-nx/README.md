# @anarchitects/governance-adapter-nx

`@anarchitects/governance-adapter-nx` is the Plugins-owned Nx adapter boundary for the Governance ecosystem. It remains in `anarchitects/anarchitecture-plugins` because it owns Nx-specific workspace graph loading, metadata extraction, workspace normalization, Nx capability production, and mapping into published Governance Core contracts.

This package depends on the published `@anarchitects/governance-core` package. It must not depend on `@anarchitects/nx-governance` host internals, executors, generators, or plugin runtime modules.
It also must not own standalone CLI behavior or TypeScript adapter behavior.

## Public API

The public barrel intentionally exposes only adapter seams:

- `readWorkspaceGraphSnapshot`
- `readWorkspaceGraphSnapshotFromJson`
- `summarizeWorkspaceGraph`
- `createNxCapability`
- `readNxWorkspaceSnapshot`
- `createNxWorkspaceAdapterResult`
- `readNxWorkspaceAdapterResult`
- `loadNxGovernanceWorkspaceContext`
- `resolveProjectTagsAndMetadata`

## Ownership Boundary

This package owns:

- Nx graph loading
- Nx metadata extraction
- CODEOWNERS-to-project ownership mapping
- Nx workspace normalization
- Nx-to-Core adapter result mapping
- `capability:nx` production

This package does not own:

- `@anarchitects/nx-governance` host runtime orchestration
- executors
- generators
- Project Crystal inference
- plugin runtime internals

Those remain in `@anarchitects/nx-governance`.

The host package rewiring step is tracked separately in Plugins `#385`.

## Installation

Consumers should install the host package:

```bash
nx add @anarchitects/nx-governance
```

The host package remains the user-facing Nx product surface. This adapter boundary exists so the host can consume a dedicated Nx adapter package without embedding adapter implementation details.
