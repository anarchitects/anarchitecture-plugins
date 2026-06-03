# @anarchitects/governance-adapter-nx

## Overview

@anarchitects/governance-adapter-nx provides Nx-specific extraction and mapping for Governance. It reads Nx workspace/project graph information and maps that data into Governance Core contracts.

Use this package when you need programmatic access to canonical Nx governance inputs, capabilities, and adapter results.

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

This package does not own:

- Governance rule evaluation
- recommendation generation
- Nx host orchestration
- Nx generators and executors
- report rendering

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

## Related Packages

- @anarchitects/nx-governance: composes this adapter into Nx executors and generators.
- @anarchitects/governance-core: target contract model and deterministic governance logic.
- @anarchitects/governance-extension-nx: consumes adapter capabilities for Nx-specific governance interpretation.

## Compatibility

- Peer dependency: Nx >=19 and <23.
- Depends on @anarchitects/governance-core.

## FAQ

### Should workspace users call this package directly?

Usually no. Nx users typically interact with @anarchitects/nx-governance commands. Direct adapter usage is for library integration and advanced tooling.

### Does this package evaluate governance rules?

No. It extracts and maps Nx data; rule and metric evaluation belongs to Governance Core and extension packages.

## License

Apache-2.0
