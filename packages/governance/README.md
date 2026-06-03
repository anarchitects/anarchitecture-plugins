# @anarchitects/nx-governance

## Overview

@anarchitects/nx-governance is the Nx-facing Governance package. It runs Governance assessments for Nx workspaces and exposes results as CLI output, JSON, and report artifacts.

Use this package when you want to evaluate repository health, architecture boundaries, ownership signals, and dependency structure as part of local development or CI.

## Key Concepts

- Governance profiles define policy and reporting behavior for a workspace.
- Nx executors expose Governance analyses as stable Nx targets.
- Project Crystal inference can infer core governance targets from profile files.
- The host package composes adapter extraction, extension contributions, and core evaluation.

## Installation

```bash
yarn nx add @anarchitects/nx-governance
```

## Quick Start

```bash
yarn nx repo-health
yarn nx repo-boundaries
yarn nx repo-ownership
yarn nx governance-graph
```

## Architecture

@anarchitects/nx-governance is the composition root on the Nx side.

```mermaid
flowchart TD
  A[@anarchitects/nx-governance] --> B[@anarchitects/governance-adapter-nx]
  B --> C[@anarchitects/governance-core]
  D[@anarchitects/governance-extension-nx] --> C
  A --> C
```

More implementation-oriented architecture notes are available in ../../docs/architecture/governance-plugin-side-packages.md.

## Responsibilities

This package owns:

- Nx executors
- Nx generators
- Governance host runtime
- profile loading
- extension loading
- report/output orchestration

This package does not own:

- Nx metadata extraction
- Governance rule evaluation internals
- Governance metric calculation internals

## Public API

### Package entrypoints

- @anarchitects/nx-governance (compatibility root export surface)
- @anarchitects/nx-governance/host (host-owned TypeScript exports)
- @anarchitects/nx-governance/plugin (Nx plugin inference entrypoint)

### Nx generators

- @anarchitects/nx-governance:init
- @anarchitects/nx-governance:add-extension
- @anarchitects/nx-governance:eslint-integration

### Nx executors

- @anarchitects/nx-governance:repo-health
- @anarchitects/nx-governance:repo-boundaries
- @anarchitects/nx-governance:repo-ownership
- @anarchitects/nx-governance:repo-architecture
- @anarchitects/nx-governance:repo-snapshot
- @anarchitects/nx-governance:repo-drift
- @anarchitects/nx-governance:repo-management-insights
- @anarchitects/nx-governance:repo-ai-management-insights
- @anarchitects/nx-governance:repo-ai-root-cause
- @anarchitects/nx-governance:repo-ai-drift
- @anarchitects/nx-governance:repo-ai-pr-impact
- @anarchitects/nx-governance:repo-ai-cognitive-load
- @anarchitects/nx-governance:repo-ai-recommendations
- @anarchitects/nx-governance:repo-ai-smell-clusters
- @anarchitects/nx-governance:repo-ai-refactoring-suggestions
- @anarchitects/nx-governance:repo-ai-scorecard
- @anarchitects/nx-governance:repo-ai-onboarding
- @anarchitects/nx-governance:workspace-graph
- @anarchitects/nx-governance:workspace-conformance
- @anarchitects/nx-governance:governance-graph

## Usage

Run as root-level inferred/explicit commands:

```bash
yarn nx repo-health --profile=frontend-layered
yarn nx repo-architecture --output=json --outputPath=dist/governance/repo-architecture.json
yarn nx governance-graph --format=html --outputPath=dist/governance/graph.html
yarn nx governance-graph --format=json --outputPath=dist/governance/graph.json
```

Use generator-driven setup and extension registration:

```bash
yarn nx g @anarchitects/nx-governance:init
yarn nx g @anarchitects/nx-governance:add-extension
```

## Configuration

- Profiles: tools/governance/profiles/\*.json
- Plugin inference option: profileGlob
- Extension registration: nx.json and/or profile composition

## Related Packages

- @anarchitects/governance-core: canonical contracts and deterministic governance logic.
- @anarchitects/governance-adapter-nx: Nx workspace extraction and canonical adapter mapping.
- @anarchitects/governance-extension-nx: Nx-specific extension boundary for rules, metrics, and enrichers.

## Compatibility

- Peer dependencies: Nx >=19 and <23.
- Designed for Nx workspaces that want governance checks integrated into normal Nx workflows.

## FAQ

### Should I install this package or only the adapter/extension package?

Install @anarchitects/nx-governance for end-user Nx workflows. It is the package that provides Nx commands, generators, and host orchestration.

### Where are deeper internal implementation notes?

Use ../../docs/architecture/governance-plugin-side-packages.md and ../../docs/migration/governance-readme-internal-notes.md for internal architecture and migration-oriented details.

## License

Apache-2.0
