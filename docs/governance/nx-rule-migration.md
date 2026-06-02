# Nx Governance Rule Migration

## Purpose

This document records the #408 review of current rule implementations before
moving Nx-specific rules into `@anarchitects/governance-extension-nx`.

The intent of #408 is architectural relocation, not redesign. Rules should move
only when they are tied to Nx semantics such as Nx project graph
interpretation, Nx target availability, Project Crystal inferred targets, Nx
workspace structure, Nx-specific tag interpretation, or Nx conformance facts.

## Current Rule Inventory

The current built-in rule implementations live in
`packages/governance/src/core/built-in-rules.ts`.

| Rule id                   | Classification | Current owner                 | Reason                                                                                                                                                             |
| ------------------------- | -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain-boundary`         | Generic        | Governance Core compatibility | Evaluates declared project domains and project-to-project dependencies. It does not inspect Nx APIs, Nx project graph internals, targets, or inferred target data. |
| `layer-boundary`          | Generic        | Governance Core compatibility | Evaluates declared architectural layers and dependency direction. It is based on generic layer metadata, not Nx target or Project Crystal semantics.               |
| `ownership-presence`      | Generic        | Governance Core compatibility | Evaluates generic ownership metadata or CODEOWNERS-derived ownership already present on projects. It does not perform Nx-specific ownership interpretation.        |
| `project-name-convention` | Generic        | Governance Core compatibility | Evaluates configured project naming conventions with a regular expression. The rule is generic even when Nx supplies project names.                                |
| `tag-convention`          | Generic        | Governance Core compatibility | Evaluates generic tag prefixes and values. It does not interpret Nx tags beyond the normalized tag strings already present on projects.                            |
| `missing-domain`          | Generic        | Governance Core compatibility | Evaluates whether generic domain metadata is present when configured.                                                                                              |
| `missing-layer`           | Generic        | Governance Core compatibility | Evaluates whether generic layer metadata is present when configured.                                                                                               |

## Nx-Specific Rules Found

No existing rule implementation is currently Nx-specific.

The review found no current rule implementation for:

- Nx target availability.
- Project Crystal inferred target coverage.
- Nx workspace structure.
- Nx project graph-specific interpretation beyond already-normalized
  dependencies.
- Nx-specific ownership interpretation.
- Nx-specific conformance integration.
- Nx-specific target or executor metadata.

## Capability Review

`@anarchitects/governance-extension-nx` declares optional capability
requirements for facts emitted by `@anarchitects/governance-adapter-nx`,
including:

- `nx.project-graph`
- `nx.dependency-graph`
- `nx.project-metadata`
- `nx.project-tags`
- `nx.targets`
- `nx.inferred-targets`
- `nx.governance-profiles`
- `nx.ownership-evidence`

Because no existing Nx-specific rule exists, #408 does not add capability-gated
rule execution. Future Nx-specific rules must check the relevant capability
before evaluating optional Nx facts and must skip safely when optional facts are
absent unless current behavior already fails.

## Migration Outcome

No rule implementation was moved in #408 because there is no current
Nx-specific rule implementation to relocate.

The generic rule implementations remain outside
`@anarchitects/governance-extension-nx`. This preserves current behavior and
avoids moving platform-independent governance semantics into a technology
extension.

`@anarchitects/governance-extension-nx` remains the target package for future
Nx-specific rules. When such rules are introduced or migrated, they should be
registered through the public Governance Core extension contracts and must not
depend on `@anarchitects/governance-adapter-nx`, `@anarchitects/nx-governance`
host internals, executor internals, renderer internals, or monolithic source
paths.

## Behavior Preservation

Because no existing rule moved:

- Existing rule identifiers remain unchanged.
- Existing built-in rule findings remain unchanged.
- Existing host and executor behavior remain unchanged.
- Existing adapter extraction behavior remains unchanged.
- The Nx extension does not duplicate generic Core rule findings.
- No Governance Core contracts changed.
- No adapter, executor, renderer, or profile registration changes are required.

## Remaining Responsibilities

Governance Core compatibility code retains:

- rule contracts
- deterministic rule evaluation primitives
- generic project/dependency policy rules
- generic metadata and ownership rules
- generic convention rules

`@anarchitects/governance-extension-nx` owns future:

- Nx-specific rule implementations
- Nx-specific rule registration
- Nx capability-aware rule applicability
- Nx-specific interpretation of canonical nodes, relations, capabilities, and
  diagnostics

`@anarchitects/governance-adapter-nx` continues to own Nx extraction and
capability emission.

`@anarchitects/nx-governance` continues to own host composition, executors,
renderers, Project Crystal inference, and profile registration until scoped
follow-up issues change those boundaries.

## Follow-Up

#409 remains the follow-up for Nx-specific metrics and recommendations.

#410 remains the follow-up for host composition changes.
