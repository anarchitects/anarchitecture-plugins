# Community TypeScript Adapter Integration

## Purpose

This repository is the Nx host and integration layer for Governance. It does
not define or implement portable TypeScript discovery.

TypeScript discovery, normalization, and TypeScript-specific interpretation are
owned by the published Community Governance packages:

- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-extension-typescript`

Use this document to understand how `@anarchitects/nx-governance` should
compose with those packages. Do not treat it as the source of truth for
TypeScript adapter internals, `tsconfig` parsing rules, import-graph rules, or
TypeScript extension semantics.

For the broader Meta / Community / Plugins boundary model, see
[`community-meta-plugin-boundaries.md`](./community-meta-plugin-boundaries.md).

## Ownership Boundaries

Nx plugin packages own:

- Nx project graph discovery
- Nx workspace and project context extraction
- Nx executors, generators, commands, and reporting
- host-level loading of Governance Core, adapters, and extensions
- composition of Nx graph facts with Community-owned governance facts

Community TypeScript adapter owns:

- package-manager workspace discovery
- `tsconfig` discovery and parsing
- path-alias discovery
- static import analysis
- TypeScript dependency and source-artifact extraction
- normalization of portable TypeScript facts into canonical Core contracts
- projection of TypeScript-owned facts into public extension-owned contracts

Community TypeScript extension owns:

- TypeScript-specific interpretation
- TypeScript-specific diagnostics
- TypeScript-specific signals, metrics, and recommendations
- validation and interpretation of TypeScript-owned expansion contracts

## Composition Rule

Cooperative enrichment is allowed, but it must happen through stable public
contracts:

- canonical nodes and relations
- declared capabilities
- public package-root exports
- extension-owned enrichers and registrations
- host-level composition

The Nx host must not:

- parse `tsconfig` files as a substitute for the Community adapter
- build a local TypeScript import graph
- normalize TypeScript adapter payloads through private assumptions
- import Community adapter or extension internals
- copy Community TypeScript discovery examples as local executable behavior

## Expected Nx Host Flow

The intended composition model is:

```text
Nx workspace
  -> @anarchitects/governance-adapter-nx
  -> canonical Nx adapter result

TypeScript source workspace
  -> @anarchitects/governance-adapter-typescript
  -> canonical TypeScript adapter result + TypeScript-owned facts

Nx host composition
  -> Governance Core
  -> optional @anarchitects/governance-extension-typescript
  -> Nx-native reports and artifacts
```

This means:

- Nx graph facts remain plugin-owned.
- TypeScript facts come from the Community TypeScript adapter output.
- TypeScript interpretation is loaded through the Community TypeScript
  extension, not through plugin-local helper logic.
- The same host-composition rule should apply to future ecosystems such as
  Angular, dbt, or repository adapters when those Community packages exist.

## Current Plugin-Side Expectations

In this repository:

- host/runtime code must stay limited to published package-root imports
- TypeScript extension package names may appear as opaque configuration examples
  for extension loading
- no production package should depend on private Community adapter or extension
  paths
- no production package should reintroduce local `typescript-adapter`
  implementation folders

## Docs Scope

Detailed documentation of TypeScript discovery behavior belongs with the
Community packages that own it. If the published TypeScript adapter changes its
workspace detection, `tsconfig` support, canonical projection, or extension
expansion contracts, update the Community package docs first and keep this
document focused on Nx host composition only.

For the cooperative enrichment model behind this split, see
`anarchitects/anarchitecture-meta` ADR
`adr/0001-cooperative-governance-enrichment.md`.
