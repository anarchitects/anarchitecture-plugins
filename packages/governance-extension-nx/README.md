# @anarchitects/governance-extension-nx

## Overview

@anarchitects/governance-extension-nx is the Nx-focused Governance extension package. It contributes (and is designed to grow) Nx-specific governance interpretation using Governance Core extension contracts.

Use this package when you want to register Nx-specific rules, metrics, recommendations, or enrichers in the Governance ecosystem.

## Key Concepts

- Extension boundary: isolates Nx-specific governance intelligence from host and adapter responsibilities.
- Capability-aware contributions: extension behavior can react to adapter-provided nx.\* capabilities.
- Core-first contracts: extension registration is defined through @anarchitects/governance-core extension APIs.

## Installation

Install through the host package for normal Nx usage:

```bash
yarn nx add @anarchitects/nx-governance
```

Direct installation is useful when consuming extension definitions in custom tooling.

## Quick Start

```ts
import {
  governanceExtensionNx,
  createGovernanceExtensionNx,
} from '@anarchitects/governance-extension-nx';

const extension = createGovernanceExtensionNx();
console.log(governanceExtensionNx.id, extension.version);
```

## Architecture

```mermaid
flowchart TD
  A[@anarchitects/nx-governance] --> B[@anarchitects/governance-adapter-nx]
  B --> C[@anarchitects/governance-core]
  D[@anarchitects/governance-extension-nx] --> C
```

More implementation-oriented architecture notes are available in ../../docs/architecture/governance-plugin-side-packages.md.

## Responsibilities

This package owns:

- rules
- metrics
- recommendations
- enrichers
- capability-aware Nx interpretation

This package does not own:

- Nx metadata discovery
- Nx extraction
- report rendering
- host orchestration
- Nx generators and executors

## Public API

- governanceExtensionNx
- createGovernanceExtensionNx
- GOVERNANCE_EXTENSION_NX_ID
- GOVERNANCE_EXTENSION_NX_NAME
- GOVERNANCE_EXTENSION_NX_VERSION
- GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES
- default export (governanceExtensionNx)

## Usage

Use the exported extension definition in a host composition flow that accepts Governance Core extension definitions.

```ts
import { governanceExtensionNx } from '@anarchitects/governance-extension-nx';

// Register the extension in your Governance host composition.
void governanceExtensionNx;
```

## Configuration

This package has no standalone configuration file format. Configuration is provided by the host layer (for example, profile composition and extension registration in Nx governance setup).

## Related Packages

- @anarchitects/governance-core: extension contracts and canonical governance model.
- @anarchitects/governance-adapter-nx: supplies nx.\* capabilities and canonical workspace facts.
- @anarchitects/nx-governance: user-facing host that composes adapter and extension packages.

## Compatibility

- Depends on @anarchitects/governance-core.
- Intended for composition through @anarchitects/nx-governance in Nx environments.

## FAQ

### Does this package replace the adapter package?

No. The adapter extracts Nx facts; this extension interprets Nx facts through extension contracts.

### Does this package render reports?

No. Rendering and output routing belong to host/runtime layers.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) files.
