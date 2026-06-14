# @anarchitects/governance-adapter-nx

## Overview

@anarchitects/governance-adapter-nx provides Nx-specific extraction and mapping for Governance. It reads Nx workspace/project graph information and maps that data into Governance Core contracts.

Use this package when you need programmatic access to canonical Nx governance inputs, capabilities, and adapter results.

For the current repository-level boundary model, see
[`../../docs/governance/community-meta-plugin-boundaries.md`](../../docs/governance/community-meta-plugin-boundaries.md).

## Key Concepts

- Adapter snapshot: normalized Nx projects, dependencies, ownership evidence, and profile discovery.
- Capability emission: machine-readable nx.\* capability signals for host and extension packages.
- Core contract mapping: conversion from Nx workspace state into Governance Core adapter results.

## Installation

Most users install @anarchitects/nx-governance (the Nx host package):

```bash
yarn nx add @anarchitects/nx-governance
```

Direct dependency installation is intended for package consumers integrating the adapter API.

## Quick Start

```ts
import {
  readNxWorkspaceSnapshot,
  createNxWorkspaceAdapterResult,
} from '@anarchitects/governance-adapter-nx';

const snapshot = await readNxWorkspaceSnapshot();
const adapterResult = createNxWorkspaceAdapterResult(snapshot);

console.log(snapshot.projects.length, adapterResult.capabilities.length);
```

## Architecture

This package sits between Nx data and Governance Core contracts.

```mermaid
flowchart LR
	A[Nx workspace and project graph] --> B[@anarchitects/governance-adapter-nx]
	B --> C[@anarchitects/governance-core]
	D[@anarchitects/nx-governance] --> B
```

More implementation-oriented architecture notes are available in ../../docs/architecture/governance-plugin-side-packages.md.

## Responsibilities

This package owns:

- Nx extraction
- canonical nodes
- canonical relations
- capabilities
- ownership evidence mapping
- Governance Core adapter mapping
- Nx graph JSON fallback handling

This package does not own:

- canonical governance semantics
- canonical ownership-gap semantics
- applicability semantics for generic metadata rules
- Governance rule evaluation
- recommendation generation
- Nx host orchestration
- Nx generators and executors
- report rendering
- TypeScript workspace discovery
- `tsconfig` parsing
- TypeScript path-alias or import-graph analysis
- TypeScript-specific diagnostics, signals, metrics, or recommendations
- Community TypeScript adapter or extension semantics

## Public API

### Functions

- readWorkspaceGraphSnapshot
- readWorkspaceGraphSnapshotFromJson
- summarizeWorkspaceGraph
- createNxCapability
- createNxCapabilities
- createNxCanonicalCapabilities
- readNxWorkspaceSnapshot
- createNxWorkspaceAdapterResult
- readNxWorkspaceAdapterResult
- loadNxGovernanceWorkspaceContext
- resolveProjectTagsAndMetadata
- discoverGovernanceProfileFiles

### Types and constants

- GraphAdapter and related snapshot types
- AdapterWorkspaceSnapshot and related adapter types
- NX_CANONICAL_CAPABILITY_IDS and NxCanonicalCapabilityId

## Usage

Use the adapter directly for extraction and capability analysis:

```ts
import {
  readNxWorkspaceSnapshot,
  createNxCanonicalCapabilities,
} from '@anarchitects/governance-adapter-nx';

const snapshot = await readNxWorkspaceSnapshot();
const capabilities = createNxCanonicalCapabilities({
  workspaceRoot: snapshot.root,
  snapshot,
});
```

## Configuration

- Reads workspace data through Nx APIs.
- Discovers governance profiles under tools/governance/profiles/\*.json.
- Supports JSON graph fallback input when consuming exported Nx graph JSON.
- Treats TypeScript source discovery as an external Community-owned concern.
- Surfaces Nx ownership evidence, including adapter-local CODEOWNERS mapping
  where supported, but does not decide canonical ownership semantics itself.

## Related Packages

- @anarchitects/nx-governance: composes this adapter into Nx executors and generators.
- @anarchitects/governance-core: target contract model and deterministic governance logic.
- @anarchitects/governance-extension-nx: consumes adapter capabilities for Nx-specific governance interpretation.
- @anarchitects/governance-adapter-typescript: Community-owned TypeScript discovery and normalization.
- @anarchitects/governance-extension-typescript: Community-owned TypeScript interpretation.

## Compatibility

- Peer dependency: Nx >=19 and <23.
- Depends on @anarchitects/governance-core.

## FAQ

### Should workspace users call this package directly?

Usually no. Nx users typically interact with @anarchitects/nx-governance commands. Direct adapter usage is for library integration and advanced tooling.

### Does this package evaluate governance rules?

No. It extracts and maps Nx data; rule and metric evaluation belongs to Governance Core and extension packages.

### Does this package parse tsconfig files or build a TypeScript import graph?

No. Those responsibilities belong to the Community TypeScript adapter. This
package only extracts Nx-owned workspace and graph context.

### Does this package make every Nx node a project-like governance subject?

No. Community contracts own generic applicability. The adapter supplies Nx facts
and canonical mapping, but missing-domain and missing-layer applicability
remain Community-owned.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) files.
