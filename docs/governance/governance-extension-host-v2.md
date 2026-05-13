# Governance Extension Host v2

## Purpose

This document defines the Governance Extension Host v2 contract and capability model for #229.

It provides the architecture-level design needed by #219 and aligns with the Core contracts from #227 and the workspace adapter contract from #228.

This is a documentation-only design. It does not implement Extension Host v2, remove current behavior, create packages, move files, or change runtime behavior.

## Design Goal

Governance extensions should contribute framework, language, and ecosystem-specific intelligence through stable Core contracts without depending on Nx, adapter internals, or host implementation details.

Extension Host v2 should support:

- explicit governance extension registration
- Core-owned extension contracts
- capability-based context
- optional and required extension semantics
- deterministic diagnostics
- extension-contributed rule packs, enrichers, signals, metrics, and presets
- Nx-aware behavior through capabilities rather than direct Nx coupling
- future CLI, TypeScript, Maven, Gradle, PHP, Angular, React, NestJS, and other extensions

## Current Problem

The current extension system has useful contribution concepts, but is still Nx-coupled.

Known current issues:

- extension contracts reference Nx adapter snapshot types
- extension host imports Nx workspace APIs
- extension discovery reads `nx.json.plugins`
- extension discovery probes `<plugin>/governance-extension`
- upstream Nx plugins are not expected to export Anarchitects governance extension entrypoints
- extension context exposes adapter internals instead of stable Core capabilities

Extension Host v2 should keep the useful contribution model while replacing Nx-coupled discovery/context with explicit registration and capability-based context.

## Target Responsibility Split

| Area | Responsibility |
|---|---|
| Governance Core | Owns extension contracts, contribution interfaces, capability model, diagnostics contracts, and rule/signal/metric contracts. |
| Nx plugin host | Reads Nx-specific configuration and registers configured governance extensions for Nx runs. |
| CLI host | Reads CLI/governance configuration and registers configured governance extensions for CLI runs. |
| Adapters | Provide capabilities such as `capability:nx`, `capability:typescript`, and `capability:package-manager`. |
| Extensions | Contribute rule packs, enrichers, signal providers, metric providers, presets, and diagnostics. |

Core owns the contracts. Hosts own discovery and loading. Adapters own facts/capabilities. Extensions own domain-specific intelligence.

## Extension Definition Contract

Extensions should expose a stable definition object.

```ts
export interface GovernanceExtensionDefinition {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  capabilities?: GovernanceExtensionCapabilityRequirement[];
  rulePacks?: GovernanceRulePack[];
  enrichers?: GovernanceWorkspaceEnricher[];
  signalProviders?: GovernanceSignalProvider[];
  metricProviders?: GovernanceMetricProvider[];
  presets?: GovernanceProfilePreset[];
  diagnostics?: GovernanceExtensionDiagnosticProvider[];
}
```

Requirements:

- `id` is stable and unique.
- extension rule ids should be namespaced where appropriate.
- extensions depend on Core contracts.
- extensions should not import Nx, CLI, or adapter internals unless explicitly scoped as adapter/host-specific extensions.
- extensions may declare capability requirements.

## Contribution Types

### Rule packs

Extensions may contribute rule packs.

Examples:

- Angular architectural rules
- Maven package naming rules
- Java package/class naming rules
- TypeScript file/symbol/barrel rules
- NestJS controller/provider/module rules
- Playwright test organization rules

Rule packs use the same `GovernanceRule`, `GovernanceViolation`, and profile configuration contracts as Core rules.

### Workspace enrichers

Extensions may enrich workspace/projects with additional metadata derived from capabilities or source files.

Examples:

- Angular extension detects components/services/routes from TypeScript capability data.
- Maven extension enriches projects with groupId/artifactId metadata.
- TypeScript extension enriches projects with tsconfig path alias metadata.

Enrichers must be deterministic and should return diagnostics rather than printing directly.

### Signal providers

Extensions may provide governance signals that are not necessarily rule violations.

Examples:

- cognitive load signals
- framework smell signals
- coupling signals
- missing convention signals
- migration readiness signals

### Metric providers

Extensions may provide measurements derived from workspace facts, capabilities, signals, or violations.

Examples:

- Angular architectural consistency score
- TypeScript import hygiene score
- Maven modularity score
- framework-specific test coverage signals where available

### Presets

Extensions may provide opinionated profile presets.

Examples:

- `angular-layered`
- `typescript-package-workspace`
- `maven-modular-monolith`
- `nestjs-ddd`

Presets should compose with Core rule configuration rather than replace the Core profile model.

## Capability Model

Capabilities allow extensions to inspect available context without importing adapters or hosts.

```ts
export interface GovernanceCapability<TData = unknown> {
  id: string;
  version?: string;
  data?: TData;
}

export interface GovernanceCapabilityRegistry {
  has(id: string): boolean;
  get<TData = unknown>(id: string): GovernanceCapability<TData> | undefined;
  list(): GovernanceCapability[];
}
```

Capability ids should be stable and namespaced.

Initial examples:

| Capability | Producer | Consumers |
|---|---|---|
| `capability:nx` | Nx adapter | Angular extension, Nx-specific extension, reporting enrichers. |
| `capability:typescript` | TypeScript adapter or Nx+TS enrichment | Angular, React, NestJS, TypeScript extensions. |
| `capability:package-manager` | TypeScript/package adapter | TypeScript, Playwright, Node ecosystem extensions. |
| `capability:manual-workspace` | CLI manual adapter | Generic rules and diagnostics. |
| `capability:ownership` | ownership adapter/enricher | ownership rules and reports. |
| `capability:angular` | Angular extension or adapter enrichment | Angular-specific rule packs and metrics. |

## Capability Requirements

Extensions may declare capability requirements.

```ts
export interface GovernanceExtensionCapabilityRequirement {
  id: string;
  required?: boolean;
  minVersion?: string;
  reason?: string;
}
```

Interpretation:

- required capability missing: required extension cannot run and should produce a clear diagnostic/failure
- optional capability missing: extension should skip capability-specific behavior
- available capability: extension may activate richer analysis

Extensions should degrade gracefully where practical.

## Extension Execution Context

Extension context should be Core-owned and capability-based.

```ts
export interface GovernanceExtensionContext {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
  capabilities: GovernanceCapabilityRegistry;
  diagnostics: GovernanceDiagnostics;
  options?: Record<string, unknown>;
}
```

The context must not expose:

- Nx adapter snapshot types
- Nx project graph objects directly
- host-specific logger/process APIs
- CLI parser state
- filesystem access by default

If file access is needed, it should be provided through an explicit capability or controlled host utility, not assumed by every extension.

## Explicit Extension Registration

Extension Host v2 should use explicit governance extension registration as the primary model.

Potential host configuration examples:

```json
{
  "governance": {
    "extensions": [
      "@anarchitects/governance-extension-angular",
      "@anarchitects/governance-extension-typescript"
    ]
  }
}
```

Or profile-level extension configuration:

```json
{
  "extensions": {
    "@anarchitects/governance-extension-angular": {
      "enabled": true,
      "options": {
        "selectorPrefix": "aa"
      }
    }
  }
}
```

The final location of extension registration is a host/config decision. The contract requirement is that extension registration is explicit and governance-specific.

## Discovery and Loading Boundary

Core should not discover packages from disk.

Hosts may discover/load extensions from:

- explicit governance config
- profile extension configuration
- CLI flags
- Nx plugin host configuration
- package manifests in a future controlled mechanism

Host-owned discovery may use Node/module resolution, but Core must not.

## Required vs Optional Extensions

Extension Host v2 should distinguish between extension states.

| State | Meaning | Behavior |
|---|---|---|
| Not configured | Extension is not part of the run. | No action. |
| Configured optional and missing | Extension was requested but marked optional or discovered as optional. | Diagnostic warning or notice; continue. |
| Configured required and missing | Extension was explicitly required. | Fail with clear diagnostic. |
| Installed but registration fails | Extension exists but throws or returns invalid definition. | Fail clearly unless host explicitly marks it optional and non-critical. |
| Installed and incompatible | Version/capability mismatch. | Fail or skip depending on required/optional status. |
| Installed and unsupported capability missing | Extension runs partially or skips specific contributions. |

This avoids surprising failures for optional ecosystem intelligence while keeping explicitly required governance controls enforceable.

## Failure Semantics

Recommended failure model:

- missing optional extension: non-fatal diagnostic
- missing required extension: fatal diagnostic
- invalid extension definition: fatal diagnostic
- extension registration throws: fatal diagnostic unless optional and host chooses to continue
- rule evaluation throws: fatal diagnostic for that extension/rule pack
- capability-specific contribution cannot run: warning/notice if optional

Exact fatal diagnostic representation should align with the Core diagnostics contract from #227.

## Profile Configuration for Extension Rules

Extension rules should use the same profile rule configuration model as Core rules.

```json
{
  "rules": {
    "angular:component-name-convention": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "suffix": "Component"
      }
    },
    "maven:group-id-convention": {
      "enabled": true,
      "severity": "error",
      "options": {
        "pattern": "^be\\.anarchitects(\\.[a-z][a-z0-9]*)+$"
      }
    }
  }
}
```

Extension-specific operational configuration may live under `profile.extensions`.

```json
{
  "extensions": {
    "@anarchitects/governance-extension-angular": {
      "enabled": true,
      "options": {
        "selectorPrefix": "aa"
      }
    }
  }
}
```

Rule behavior belongs in `profile.rules`; extension runtime/configuration behavior belongs in `profile.extensions`.

## Rule Id Namespacing

Core rule ids may be unprefixed:

- `domain-boundary`
- `layer-boundary`
- `project-name-convention`
- `tag-convention`

Extension rule ids should generally be namespaced:

- `angular:component-name-convention`
- `typescript:file-name-convention`
- `maven:group-id-convention`
- `java:package-name-convention`
- `nestjs:controller-name-convention`

This reduces collisions and keeps report output clear.

## Extension Ordering

Extension Host v2 should define deterministic ordering.

Recommended order:

1. load extension definitions
2. validate extension definitions
3. check capability requirements
4. run workspace enrichers
5. run Core and extension rule packs
6. run signal providers
7. run metric providers
8. aggregate diagnostics
9. produce final assessment/report model

Ordering should be deterministic across runs.

If extensions need ordering constraints later, introduce explicit dependency metadata rather than relying on package load order.

## Nx Awareness Through Capabilities

Nx awareness must come from `capability:nx`, not direct Nx imports in generic extensions.

Example:

- Angular extension may inspect `capability:nx` to understand Nx project targets when available.
- The same Angular extension should still run with `capability:typescript` in a non-Nx TypeScript workspace.
- Nx-specific rules, if ever needed, should live in an Nx-specific extension or the Nx adapter/host boundary, not in generic Angular logic.

## Migration from Current Extension Host

Recommended migration path for #219:

1. Introduce Core-owned extension contracts.
2. Remove Nx adapter snapshot types from extension context.
3. Introduce `GovernanceCapabilityRegistry`.
4. Make Nx adapter contribute `capability:nx`.
5. Introduce explicit governance extension registration.
6. Keep current discovery behavior only as a transitional compatibility layer if required.
7. Deprecate probing arbitrary Nx plugin packages for `/governance-extension`.
8. Add diagnostics for missing optional vs required extensions.
9. Preserve current successful extension contribution behavior where possible.

## Transitional Compatibility

The current extension host behavior may remain temporarily during migration, but it should not be the long-term primary model.

Transitional rules:

- do not break current local/self-provided extensions unexpectedly
- do not require upstream Nx plugins to expose governance extension entrypoints
- prefer explicit governance extension config for new behavior
- warn when legacy probing is used, if implemented
- document deprecation before removal

## Interaction with Adapters

Adapters provide facts and capabilities. Extensions provide interpretation.

Examples:

| Adapter output | Extension usage |
|---|---|
| Nx adapter emits `capability:nx` with project targets | Angular extension can evaluate Nx-aware Angular conventions if configured. |
| TypeScript adapter emits `capability:typescript` with import graph metadata | TypeScript extension can enforce file/import conventions. |
| Maven adapter emits JVM/package metadata capability | Maven/Java extension can enforce groupId/package/class conventions. |
| Ownership enricher emits ownership capability | Ownership extension/reporting can enrich diagnostics. |

Extensions should not need to know which adapter implementation produced the capability.

## Diagnostics

Extension Host v2 should return diagnostics that are machine-readable and host-rendered.

Diagnostic examples:

- `governance.extension.missing_optional`
- `governance.extension.missing_required`
- `governance.extension.invalid_definition`
- `governance.extension.capability_missing`
- `governance.extension.registration_failed`
- `governance.extension.rule_failed`

Hosts decide whether diagnostics are printed, serialized, or converted into exit codes.

## Non-Goals

This design does not:

- implement Extension Host v2
- remove the current extension host
- define concrete Angular/React/NestJS/Maven/Gradle/PHP rules
- define package export maps
- define exact config file locations
- implement capability providers
- implement extension package loading
- change existing Nx Governance behavior

## Open Decisions for #219

Implementation-time decisions:

- exact TypeScript interface names and file layout
- final extension registration config location
- whether registration supports package names, local paths, or imported objects
- whether optional/required status lives in host config, profile config, or both
- whether legacy Nx plugin probing remains temporarily
- how extension diagnostics become process exit behavior
- how extension ordering constraints are represented if needed
- whether extension presets are auto-loaded or explicitly selected
- how extension version compatibility is validated

## Acceptance Check for #229

- [x] Extension contracts are independent from Nx.
- [x] Extension context no longer depends on Nx adapter snapshot types.
- [x] Capability-based Nx awareness is defined.
- [x] Explicit extension registration is the primary model.
- [x] Missing optional extensions and failing installed extensions have clear semantics.
- [x] The design directly scopes #219 implementation.
