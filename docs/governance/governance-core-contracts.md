# Governance Core Contracts

## Purpose

This document defines the platform-independent Governance Core contract direction for #227.

It provides the contract-level design that future adapters, extensions, the standalone CLI, and the existing Nx plugin host depend on. It does not implement these contracts, refactor existing types, change runtime behavior, or migrate profiles.

The document builds on:

- #225 current-state audit
- #226 target package architecture
- #230 Nx Governance compatibility contract
- #232 ecosystem migration plan

## Contract Design Goals

Governance Core should provide:

- a stable platform-independent workspace model
- a stable rule engine contract
- a stable violation/signal/measurement model
- profile-driven rule configuration
- built-in generic rule families
- extension-contributed rule packs
- deterministic assessment/report contracts
- snapshot and drift contracts
- AI-ready result/payload contracts without host coupling
- adapter and capability touchpoints without depending on adapter implementations

Governance Core must not import Nx, CLI, framework, package-manager, or source-code analysis APIs.

## Core Contract Layers

| Layer | Responsibility | Stability target |
|---|---|---|
| Domain model | Workspace, project, dependency, ownership, metadata, classification. | Stable public API after #218. |
| Rule model | Rule, rule pack, context, result, configuration. | Stable public API after #218/#227 validation. |
| Finding model | Violations, signals, measurements, diagnostics. | Stable public API after #218. |
| Assessment model | Aggregated governance assessment, reports, health, recommendations. | Stable public API after #218. |
| Snapshot/drift model | Metric snapshots, comparisons, drift signals. | Stable public API after #218. |
| Extension model | Contribution points for enrichers, rules, signals, metrics, presets. | Defined here; finalized with #229. |
| Adapter touchpoints | Workspace adapter contract and capabilities. | Defined here at high level; finalized with #228. |

## Current Model Classification

| Current concept | Proposed status | Notes |
|---|---|---|
| `GovernanceWorkspace` | Stable candidate | Needs real workspace identity beyond hardcoded `workspace`. |
| `GovernanceProject` | Stable candidate | Should remain platform-independent and metadata-extensible. |
| `GovernanceDependency` | Stable candidate | Should support source/target project ids and optional source file. |
| `Ownership` | Stable candidate | Ownership source should remain adapter/enricher-provided. |
| `GovernanceProfile` | Redesign candidate | Existing profile shape should be compatibility-mapped to rule config. |
| `Violation` | Redesign candidate | Should become richer around source/target/related project ids. |
| `Measurement` | Stable candidate | Should remain deterministic and report-friendly. |
| `HealthScore` | Stable candidate | Should remain core-owned and configurable through scoring profile. |
| `GovernanceAssessment` | Stable candidate | Should become canonical run result. |
| `MetricSnapshot` | Stable candidate | Core-owned contract; storage is host-owned. |
| `SnapshotComparison` | Stable candidate | Core-owned drift comparison contract. |
| `DriftSignal` | Stable candidate | Core-owned signal derived from snapshot comparison. |
| `AiAnalysisRequest` | Stable/experimental | Contract can remain core-owned; builders may become AI package later. |
| `AiAnalysisResult` | Stable/experimental | Contract can remain core-owned; host artifact writing stays outside core. |
| Signal types currently in `signal-engine` | Move to Core | Avoid `core -> signal-engine` dependency direction. |

## Workspace Model

Core should own a canonical workspace model.

```ts
export interface GovernanceWorkspace {
  id: string;
  name?: string;
  root?: string;
  projects: GovernanceProject[];
  dependencies: GovernanceDependency[];
  metadata?: Record<string, unknown>;
}
```

Requirements:

- `id` must not be hardcoded by Core.
- `root` is optional because not every host has a filesystem root.
- adapters/hosts may provide root, but Core rules should not require Nx workspace roots.
- metadata is extensible but should not be used as a replacement for stable fields.

## Project Model

```ts
export interface GovernanceProject {
  id: string;
  name: string;
  root?: string;
  type?: string;
  domain?: string;
  layer?: string;
  scope?: string;
  tags: string[];
  ownership?: GovernanceOwnership;
  metadata: Record<string, unknown>;
}
```

Requirements:

- `id` is the stable identifier inside Core.
- `name` is user-facing and may equal `id` in simple adapters.
- `root` is optional for non-filesystem or aggregated workspaces.
- `domain`, `layer`, and `scope` are generic governance classifications.
- tags remain generic strings, but profiles may enforce tag conventions.
- technology-specific details should go into namespaced metadata or capabilities.

## Dependency Model

```ts
export interface GovernanceDependency {
  sourceProjectId: string;
  targetProjectId: string;
  type: string;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
}
```

Requirements:

- Core dependencies are project-to-project dependencies.
- source-code import analysis is adapter responsibility, not Core responsibility.
- dependency `type` should remain string-extensible.
- profiles may configure allowed dependency types.

## Ownership Model

```ts
export interface GovernanceOwnership {
  team?: string;
  contacts?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}
```

Requirements:

- Core evaluates ownership facts but does not discover ownership.
- CODEOWNERS, package metadata, YAML, or external systems are adapter/enricher concerns.
- ownership source should be preserved for diagnostics and explainability.

## Rule Engine Contract

Core should own a rule engine contract that can evaluate built-in and extension-provided rules.

```ts
export interface GovernanceRule<TOptions = unknown> {
  id: string;
  name: string;
  description?: string;
  category: GovernanceRuleCategory;
  defaultSeverity: GovernanceSeverity;
  evaluate(context: GovernanceRuleContext<TOptions>): GovernanceRuleResult;
}

export interface GovernanceRulePack {
  id: string;
  name: string;
  rules: GovernanceRule[];
}

export interface GovernanceRuleContext<TOptions = unknown> {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
  options: TOptions;
  capabilities: GovernanceCapabilityRegistry;
  diagnostics: GovernanceDiagnostics;
}

export interface GovernanceRuleResult {
  violations?: GovernanceViolation[];
  signals?: GovernanceSignal[];
  measurements?: GovernanceMeasurement[];
}
```

Requirements:

- Rules operate on Core contracts, not host/adapter internals.
- Rules may return violations, signals, and measurements.
- Rule packs may be built-in or extension-contributed.
- Core should provide deterministic ordering for results.

## Core Rule and Violation Taxonomy

Core should provide a small built-in generic rule pack. Profiles decide which rules are enabled and how they behave.

### Boundary Governance

Initial built-in candidates:

| Rule id | Initial status | Purpose |
|---|---|---|
| `domain-boundary` | Initial | Enforce allowed dependencies between domains. |
| `layer-boundary` | Initial | Enforce allowed dependencies between layers. |

### Convention Governance

Naming and convention governance is a generic Core capability because it can be evaluated against project names, roots, tags, domains, layers, and metadata.

| Rule id | Initial status | Purpose |
|---|---|---|
| `project-name-convention` | Initial | Enforce project name pattern. |
| `project-root-convention` | Initial | Enforce project root/path convention where root exists. |
| `tag-convention` | Initial | Enforce allowed/required tag prefixes and tag value patterns. |
| `domain-name-convention` | Deferred | Enforce domain naming where domain taxonomy becomes explicit. |
| `layer-name-convention` | Deferred | Enforce layer naming where layer taxonomy becomes explicit. |

### Ownership Governance

| Rule id | Initial status | Purpose |
|---|---|---|
| `ownership-presence` | Initial | Require ownership facts for projects. |

### Documentation / Metadata Governance

| Rule id | Initial status | Purpose |
|---|---|---|
| `documentation-presence` | Initial | Require documentation marker or metadata. |
| `missing-domain` | Initial | Require domain classification where configured. |
| `missing-layer` | Initial | Require layer classification where configured. |
| `missing-classification` | Deferred | Generalized classification completeness rule. |

### Structural Governance

| Rule id | Initial status | Purpose |
|---|---|---|
| `circular-dependency` | Deferred | Detect cycles in project dependency graph. |
| `forbidden-dependency-type` | Initial | Enforce allowed dependency types. |

### Snapshot / Drift Governance

Drift should initially be represented through snapshot comparison, `DriftSignal`, and governance signals rather than normal single-run violations.

Initial Core drift contracts:

- `MetricSnapshot`
- `SnapshotComparison`
- `DriftSignal`

Deferred:

- treating drift as first-class violations
- drift-specific rule ids
- automated remediation based on drift

## Violation Model

```ts
export interface GovernanceViolation {
  id: string;
  ruleId: string;
  severity: GovernanceSeverity;
  category: GovernanceViolationCategory;
  message: string;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds?: string[];
  details?: Record<string, unknown>;
  recommendation?: string;
  remediation?: GovernanceRemediation;
  sourcePluginId?: string;
}
```

Requirements:

- `ruleId` links the violation to a Core or extension rule.
- `sourceProjectId` / `targetProjectId` support dependency violations.
- `relatedProjectIds` supports cycles, clusters, smells, and multi-project findings.
- `sourcePluginId` attributes extension-contributed findings.
- `details` may carry structured machine-readable context.

## Signals vs Violations vs Measurements

Core must distinguish three concepts.

| Concept | Meaning | Example |
|---|---|---|
| Violation | A concrete breach of an enabled rule. | `project-a` depends on forbidden domain `billing`. |
| Signal | An observation that may influence scoring, AI, drift, or reporting. | Cross-domain dependency observed. |
| Measurement | A calculated metric/score derived from workspace, signals, and violations. | Domain integrity score is 72. |

Not every signal is a violation. Not every measurement comes directly from violations. This separation is important for AI, drift, cognitive load, and conformance imports.

## Profile-Driven Rule Configuration

Profiles should configure Core and extension rules.

```ts
export interface GovernanceProfile {
  name: string;
  description?: string;
  rules: Record<string, GovernanceRuleConfig>;
  scoring?: GovernanceScoringProfile;
  exceptions?: GovernanceException[];
  projectOverrides?: Record<string, GovernanceProjectOverride>;
  extensions?: Record<string, unknown>;
  compatibility?: GovernanceProfileCompatibility;
}

export interface GovernanceRuleConfig<TOptions = unknown> {
  enabled?: boolean;
  severity?: GovernanceSeverity;
  options?: TOptions;
}
```

Profiles should be able to configure:

- enabled/disabled rules
- severity per rule
- thresholds
- allowed domain dependencies
- allowed layer dependencies
- naming patterns
- project root patterns
- required tag prefixes
- allowed tag prefixes
- required classifications
- allowed dependency types
- scoring weights
- exception policy
- extension-specific rule configuration

## Example Profile Rule Configuration

```json
{
  "rules": {
    "domain-boundary": {
      "enabled": true,
      "severity": "error",
      "options": {
        "allowedDependencies": {
          "booking": ["shared", "identity"],
          "billing": ["shared", "identity"],
          "*": ["shared"]
        }
      }
    },
    "layer-boundary": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "allowedDependencies": {
          "ui": ["ui", "application"],
          "application": ["application", "domain"],
          "domain": ["domain"],
          "infrastructure": ["infrastructure", "domain"]
        }
      }
    },
    "project-name-convention": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "pattern": "^[a-z][a-z0-9-]*$",
        "message": "Project names must use kebab-case."
      }
    },
    "tag-convention": {
      "enabled": true,
      "severity": "info",
      "options": {
        "requiredPrefixes": ["scope", "type"],
        "allowedPrefixes": ["scope", "type", "layer", "domain", "platform"],
        "valuePattern": "^[a-z][a-z0-9-]*$"
      }
    }
  }
}
```

## Backward Compatibility Mapping

Current Nx Governance profiles should keep working during #218.

The implementation can map the existing profile shape into the future rule configuration model internally.

| Current profile concept | Future rule config mapping |
|---|---|
| `allowedDomainDependencies` | `rules['domain-boundary'].options.allowedDependencies` |
| `layers` / layer dependency config | `rules['layer-boundary'].options.allowedDependencies` |
| ownership config | `rules['ownership-presence'].options` |
| health thresholds | `scoring.thresholds` |
| metric weights | `scoring.metricWeights` |
| project overrides | `projectOverrides` |
| exceptions | `exceptions` |
| `boundaryPolicySource` | compatibility field or host-side migration concern, not a long-term Core primitive |

Existing users should not need to rewrite profiles as part of #218.

## Scoring Contract

```ts
export interface GovernanceScoringProfile {
  metricWeights?: Record<string, number>;
  thresholds?: GovernanceHealthThresholds;
}

export interface GovernanceHealthThresholds {
  goodMinScore: number;
  warningMinScore: number;
}
```

Requirements:

- scoring is Core-owned and profile-driven.
- measurements remain deterministic.
- health grade/status is derived from score and thresholds.
- extension metrics may contribute measurements if registered through Core contracts.

## Assessment and Report Contract

```ts
export interface GovernanceAssessment {
  workspace: GovernanceWorkspace;
  profileName: string;
  violations: GovernanceViolation[];
  signals: GovernanceSignal[];
  measurements: GovernanceMeasurement[];
  health: GovernanceHealthScore;
  recommendations: GovernanceRecommendation[];
  diagnostics?: GovernanceDiagnostics;
  metadata?: Record<string, unknown>;
}
```

Requirements:

- deterministic JSON output should serialize from this contract.
- host renderers may transform the assessment into CLI, Markdown, or HTML output.
- Core should not own terminal stdout/stderr behavior.
- Core should not own filesystem artifact writing.

## Snapshot and Drift Contracts

Core should own snapshot and drift data contracts, while hosts own persistence.

```ts
export interface MetricSnapshot {
  id: string;
  createdAt: string;
  workspaceId: string;
  profileName: string;
  health: GovernanceHealthScore;
  measurements: GovernanceMeasurement[];
  violations: GovernanceViolation[];
  metadata?: Record<string, unknown>;
}

export interface SnapshotComparison {
  baseline: MetricSnapshot;
  current: MetricSnapshot;
  scoreDelta: number;
  measurementDeltas: GovernanceMeasurementDelta[];
  violationDeltas: GovernanceViolationDelta[];
  driftSignals: DriftSignal[];
}
```

Requirements:

- Core owns comparison semantics.
- Nx/CLI hosts own locating `.governance-metrics/snapshots` or other storage.
- drift can feed AI/reporting without being forced into normal violations.

## AI-Ready Contracts

AI contracts can remain Core-owned where they are generic and deterministic.

Core may own:

- AI request/result data contracts
- structured root-cause input contracts
- structured drift input contracts
- structured PR-impact input contracts
- cognitive-load and onboarding summary contracts

Hosts should own:

- writing `.payload.json` files
- writing `.prompt.md` files
- choosing artifact paths
- printing instructions to the user
- invoking external AI tools, if ever added later

A future `@anarchitects/governance-ai` package may own AI-specific builders if they become too large for Core.

## Capability Model Touchpoints

Capabilities allow extensions to become context-aware without importing adapters/hosts.

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

Examples:

- `capability:nx`
- `capability:typescript`
- `capability:package-manager`
- `capability:angular`

Capability data should be structured and namespaced. Extensions should prefer capabilities over importing adapter or host internals.

## Extension-Contributed Rule Packs

Extensions should be able to contribute rule packs without Core changes.

```ts
export interface GovernanceExtensionDefinition {
  id: string;
  name?: string;
  rulePacks?: GovernanceRulePack[];
  enrichers?: GovernanceWorkspaceEnricher[];
  signalProviders?: GovernanceSignalProvider[];
  metricProviders?: GovernanceMetricProvider[];
  presets?: GovernanceProfilePreset[];
}
```

Requirements:

- extension rule ids should be namespaced where appropriate.
- extension violations use the same `GovernanceViolation` contract.
- extension rule configuration lives under `profile.rules` and/or `profile.extensions`.
- extension failures and optional extension behavior are finalized in #229.

## Diagnostics Contract

```ts
export interface GovernanceDiagnostics {
  warnings: GovernanceDiagnostic[];
  errors: GovernanceDiagnostic[];
  notices?: GovernanceDiagnostic[];
}

export interface GovernanceDiagnostic {
  code: string;
  message: string;
  source?: string;
  details?: Record<string, unknown>;
}
```

Requirements:

- diagnostics should be machine-readable.
- hosts decide how to display diagnostics.
- adapter/extension diagnostics should be carried without coupling Core to implementations.

## Open Decisions for #218

These are implementation-time decisions and should not block this contract document:

- exact TypeScript type names and file layout
- how much of current `GovernanceProfile` is preserved verbatim
- whether signal engine becomes a Core submodule or just moves signal types into Core
- whether adapter contract returns `GovernanceWorkspace` directly or intermediate adapter output
- how rule result ordering is implemented
- how profile compatibility mapping is implemented
- exact JSON schema validation strategy, if any
- whether AI builders stay in Core or move to a future package

## Acceptance Check for #227

- [x] Core contracts are documented without Nx-specific dependencies.
- [x] Current model types are classified as stable, internal, or requiring redesign.
- [x] The rule engine contract is specific enough for #218 to implement.
- [x] Built-in generic Core rule families are documented.
- [x] Candidate Core rule ids are documented and classified as initial or deferred.
- [x] Naming convention governance is explicitly included.
- [x] The difference between Core-supported rule types and profile-enabled rules is documented.
- [x] The profile contract can support current built-in rules and future extension-specific configuration.
- [x] Profiles can enable, disable, configure, and override Core rules.
- [x] Extension-contributed rules are supported without requiring Core changes.
- [x] The distinction between violations, signals, and measurements is documented.
- [x] The report/result contract supports deterministic JSON output.
- [x] The contracts support snapshot, drift, and AI-ready payloads without coupling the core to a host.
