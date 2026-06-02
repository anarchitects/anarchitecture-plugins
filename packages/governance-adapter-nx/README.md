# @anarchitects/governance-adapter-nx

`@anarchitects/governance-adapter-nx` is the Anarchitects Nx adapter boundary for the Governance ecosystem. It remains in `anarchitects/anarchitecture-plugins` because it owns Nx-specific workspace graph loading, metadata extraction, workspace normalization, Nx capability production, and mapping into published Governance Core contracts.

This package depends on the published `@anarchitects/governance-core` package. It must not depend on `@anarchitects/nx-governance` host internals, executors, generators, or plugin runtime modules. It also must not own standalone CLI behavior or TypeScript adapter behavior.

## Public API

The public barrel intentionally exposes only adapter seams:

- `readWorkspaceGraphSnapshot`
- `readWorkspaceGraphSnapshotFromJson`
- `summarizeWorkspaceGraph`
- `createNxCapability`
- `createNxCapabilities`
- `createNxCanonicalCapabilities`
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
- legacy `capability:nx` production
- canonical `nx.*` capability production

This package does not own:

- `@anarchitects/nx-governance` host runtime orchestration
- executors
- generators
- Project Crystal inference
- plugin runtime internals

Those remain in `@anarchitects/nx-governance`.

The split-boundary cleanup and release sequencing are tracked separately in Plugins `#394` and `#388`.

## Capabilities

The adapter emits `GovernanceWorkspaceAdapterResult.capabilities` so hosts and future extensions can determine which Nx extraction facts are available without importing adapter internals.

`capability:nx` remains as the legacy compatibility capability. Canonical capabilities use stable namespaced IDs:

| Capability ID            | Meaning                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `nx.project-graph`       | Nx projects were loaded from the project graph.                                                |
| `nx.dependency-graph`    | Nx project dependencies were loaded from the project graph.                                    |
| `nx.project-metadata`    | One or more projects expose Nx/project metadata keys.                                          |
| `nx.project-tags`        | One or more projects expose Nx tags.                                                           |
| `nx.targets`             | One or more projects expose target names.                                                      |
| `nx.inferred-targets`    | Project Crystal inference inputs are described; inference remains owned by the Nx host plugin. |
| `nx.governance-profiles` | Governance profile files were discovered under `tools/governance/profiles/*.json`.             |
| `nx.ownership-evidence`  | CODEOWNERS-derived ownership evidence is available for one or more projects.                   |

Nx-specific facts stay in capability `data` or `metadata`. Rule findings, recommendations, and policy violations are not emitted by this adapter.

## Installation

Consumers should install the host package:

```bash
nx add @anarchitects/nx-governance
```

The host package remains the user-facing Nx product surface. This adapter boundary exists so the host can consume a dedicated published Nx adapter package without embedding adapter implementation details.
