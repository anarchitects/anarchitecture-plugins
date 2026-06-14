# Community, Meta, and Plugin Boundaries

## Purpose

This repository is the Nx host and composition layer for Governance.

Use this note as the short boundary reference for current ownership across:

- Meta architecture guidance
- Community Governance packages
- Nx plugin packages in this repository

It complements, but does not replace:

- the Meta ADR for cooperative enrichment:
  <https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0001-cooperative-governance-enrichment.md>
- the Community Governance boundary issues:
  - <https://github.com/anarchitects/anarchitecture-community/issues/357>
  - <https://github.com/anarchitects/anarchitecture-community/issues/371>
- the plugin-side audit in
  [`community-contract-alignment-audit.md`](./community-contract-alignment-audit.md)

## Ownership Model

### Meta owns

- ecosystem-level repository interaction principles
- cross-repo architecture guidance
- cooperative enrichment principles
- repository relationship guidance

### Community Core owns

- the canonical governance model
- canonical profile policy
- generic governance semantics
- applicability semantics
- capability concepts

### Community adapters own

- source-system discovery
- extraction and parsing
- normalization into canonical facts
- projection into extension-owned expansion contracts

### Community extensions own

- technology-specific interpretation
- technology-specific diagnostics
- technology-specific rules, signals, metrics, and recommendations
- validation and interpretation of extension-owned expansion contracts

### Plugins in this repository own

- Nx graph discovery
- Nx workspace and project context
- host-level loading and composition
- Nx executors, generators, and commands
- Nx-native output, rendering, and artifact behavior

## Cooperative Enrichment

Cross-source enrichment is valid and desirable when it happens through:

- canonical Core facts
- extension-owned expansion contracts
- declared capabilities
- public package exports
- host-level adapter and extension composition

Examples:

- Nx graph facts may enrich Community TypeScript facts.
- Nx graph facts may enrich future Angular facts.
- Nx graph facts may enrich dbt, GitHub, repository, or other governance facts.

The Nx host must not achieve that enrichment by:

- duplicating discovery logic
- importing private adapter internals
- importing private extension internals
- assuming undocumented payload shapes
- moving ecosystem-specific meaning into Core for convenience
- embedding technology-specific discovery engines inside Nx plugin code when a Community adapter owns that concern

Angular is only a future adapter/extension pattern in this repository context.
It is not documented here as implemented behavior.

## Configuration Layers

Keep these layers separate:

- canonical Community profile config
- Nx host runtime config
- adapter discovery and projection config
- extension interpretation config

That means:

- canonical Community profiles are not the place for Nx runtime options
- extension activation belongs in `nx.json.governance`
- Nx runtime rendering preferences belong in Nx runtime config, not canonical policy
- adapter-specific discovery settings and extension-specific interpretation settings should stay in adapter or extension host surfaces, not in canonical policy

## Applicability and Ownership Notes

- Canonical ownership semantics are Community-owned.
- Nx packages may surface ownership evidence, including adapter-local
  CODEOWNERS-derived evidence where supported, but they do not define
  ownership-gap semantics.
- Missing-domain and missing-layer applicability is Community-owned.
- Infrastructure, runtime, or config nodes must not be documented as
  automatically project-like governance subjects unless Community contracts
  classify them that way.

## Local Reference Docs

- [`../../packages/governance/ARCHITECTURE.md`](../../packages/governance/ARCHITECTURE.md)
- [`../../packages/governance-adapter-nx/README.md`](../../packages/governance-adapter-nx/README.md)
- [`typescript-adapter-usage.md`](./typescript-adapter-usage.md)
- [`standalone-profile-compatibility.md`](./standalone-profile-compatibility.md)
- [`source-organization.md`](./source-organization.md)
