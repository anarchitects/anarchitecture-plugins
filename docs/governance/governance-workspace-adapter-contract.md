# Governance Workspace Adapter Contract

## Purpose

This document defines the workspace adapter contract and the target responsibilities of the Nx adapter for #228.

It provides the architecture-level design needed by #218, #220, and #221. It does not implement adapters, move files, change runtime behavior, create packages, or change existing Nx Governance behavior.

The document builds on:

- #225 current-state audit
- #226 target package architecture
- #227 Governance Core contracts
- #230 Nx Governance compatibility contract
- #232 migration plan

## Design Goal

Governance Core should evaluate governance rules against a platform-independent `GovernanceWorkspace`.

Adapters are responsible for translating ecosystem-specific workspace facts into this canonical Core model.

The adapter design must support:

- the current Nx plugin through an Nx adapter
- the future standalone CLI through manual workspace input
- the future generic TypeScript adapter
- future Maven, Gradle, PHP, JVM, and other ecosystem adapters
- capability-based extension intelligence
- deterministic diagnostics and error reporting

## Responsibility Split

| Area | Responsibility |
|---|---|
| Governance Core | Owns canonical workspace, project, dependency, ownership, capability, diagnostics, and adapter contracts. Runs rules against `GovernanceWorkspace`. |
| Workspace adapter | Discovers or receives ecosystem-specific workspace facts and produces Core-compatible workspace data. |
| Nx adapter | Reads Nx project graph, project metadata, dependencies, tags, targets, and optional ownership metadata, then maps them to Core contracts. |
| Nx plugin host | Owns executors, generators, Project Crystal inference, Nx logging, profile file conventions, and artifact paths. |
| CLI host | Owns CLI arguments, profile paths, manual workspace input, stdout/stderr, output rendering, and exit codes. |
| Extensions | Consume Core workspace data and capabilities to add rule packs, enrichers, signals, and metrics. |

## Adapter Contract Direction

The public adapter contract should produce a canonical Core `GovernanceWorkspace` plus capabilities and diagnostics.

Adapters may use intermediate snapshots internally, but those intermediate structures should not become Core dependencies unless they are intentionally generalized and owned by Core.

```ts
export interface GovernanceWorkspaceAdapter<TOptions = unknown> {
  id: string;
  name?: string;
  detect?(context: GovernanceAdapterDetectionContext): Promise<GovernanceAdapterDetectionResult>;
  loadWorkspace(options: TOptions, context: GovernanceAdapterExecutionContext): Promise<GovernanceWorkspaceAdapterResult>;
}

export interface GovernanceWorkspaceAdapterResult {
  workspace: GovernanceWorkspace;
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  metadata?: Record<string, unknown>;
}
```

## Detection Context

```ts
export interface GovernanceAdapterDetectionContext {
  workspaceRoot?: string;
  files?: GovernanceFileSystemReader;
  environment?: Record<string, string | undefined>;
  hints?: Record<string, unknown>;
}

export interface GovernanceAdapterDetectionResult {
  detected: boolean;
  confidence?: 'low' | 'medium' | 'high';
  reason?: string;
  diagnostics?: GovernanceDiagnostic[];
}
```

Detection is optional. Some adapters are explicitly selected by host configuration and do not need auto-detection.

Examples:

- Nx adapter detects `nx.json` and/or Nx project graph availability.
- TypeScript adapter detects package-manager workspace files and tsconfig files.
- Manual CLI adapter does not auto-detect; it receives an explicit workspace file.

## Execution Context

```ts
export interface GovernanceAdapterExecutionContext {
  workspaceRoot?: string;
  files?: GovernanceFileSystemReader;
  logger?: GovernanceDiagnosticLogger;
  capabilities?: GovernanceCapabilityRegistry;
  profileName?: string;
}
```

Requirements:

- `workspaceRoot` is optional because not every input source is filesystem-based.
- file access should be abstracted where practical.
- adapters should return diagnostics instead of printing directly.
- hosts decide how diagnostics are displayed.

## Adapter Result Requirements

Every adapter result should be:

- deterministic for the same input
- independent from host logging/output behavior
- expressed in Core contracts
- explicit about diagnostics
- explicit about capabilities
- safe for JSON serialization where practical

The result must not require Core to import adapter-specific types.

## Canonical Workspace Output

Adapters must emit the Core workspace model.

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

Workspace identity requirements:

- `id` must be adapter-provided or host-provided.
- `id` must not be hardcoded by Core.
- `id` should be stable across runs for the same workspace.
- `name` is optional and user-facing.
- `root` is optional and should be workspace-root-relative where available.

## Project Output Requirements

Adapters should emit projects with stable identifiers and normalized metadata.

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

- `id` should be unique within the workspace.
- `name` should be user-facing.
- `root` should be workspace-relative where available.
- `tags` should preserve source tags where meaningful.
- generic classification fields such as `domain`, `layer`, and `scope` should be normalized when the adapter can do so deterministically.
- technology-specific metadata should be namespaced in `metadata` or expressed through capabilities.

## Dependency Output Requirements

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

- dependencies should reference project ids emitted by the same workspace result.
- dependencies to unknown projects should either be filtered, represented as external dependencies by later contract extension, or reported as diagnostics.
- `type` should preserve meaningful adapter information, for example `static`, `implicit`, `dynamic`, `package`, or `unknown`.
- source-file-level details are optional and adapter-specific.

## Capability Contribution

Adapters should contribute capabilities that extensions can consume without importing adapter internals.

```ts
export interface GovernanceCapability<TData = unknown> {
  id: string;
  version?: string;
  data?: TData;
}
```

Examples:

| Capability | Producer | Purpose |
|---|---|---|
| `capability:nx` | Nx adapter | Communicates Nx project graph and target metadata availability. |
| `capability:typescript` | TypeScript adapter | Communicates TypeScript source analysis and tsconfig/path data availability. |
| `capability:package-manager` | TypeScript/package adapter | Communicates package-manager workspace data availability. |
| `capability:manual-workspace` | CLI manual adapter | Indicates workspace was supplied through explicit YAML/JSON input. |
| `capability:ownership` | Ownership enricher/adapter | Indicates ownership facts were supplied and their source. |

Capability data must be structured and namespaced. Extensions should treat capabilities as optional and feature-detect them.

## Diagnostics Contract

Adapters should return diagnostics instead of throwing for recoverable conditions.

Examples of diagnostics:

- workspace root not found
- optional metadata file missing
- duplicate project id
- dependency target not found
- malformed tag ignored
- CODEOWNERS file not found
- package-manager workspace pattern did not match any project

Fatal errors should throw or return a fatal diagnostic according to the host/core error contract finalized during implementation.

```ts
export interface GovernanceDiagnostic {
  code: string;
  message: string;
  source?: string;
  details?: Record<string, unknown>;
}
```

## Nx Adapter Responsibilities

The Nx adapter should own Nx-specific workspace discovery and mapping.

It should own:

- loading the Nx project graph
- reading Nx workspace metadata
- reading Nx project nodes
- reading Nx dependency graph edges
- mapping Nx projects to `GovernanceProject`
- mapping Nx dependencies to `GovernanceDependency`
- reading Nx tags and metadata
- reading project-level metadata from Nx conventions
- deriving governance classifications from tags and metadata
- contributing `capability:nx`
- returning adapter diagnostics

It may initially own:

- CODEOWNERS-to-project ownership mapping, to preserve current behavior
- compatibility mapping from current Nx metadata conventions to Core workspace fields

It must not own:

- Project Crystal target inference
- Nx executor registration
- Nx generator behavior
- CLI argument parsing
- generic Core rule semantics
- scoring model
- report/result contracts
- framework-specific rule packs

## Nx Adapter Capability

The Nx adapter should contribute a capability similar to:

```ts
export interface NxGovernanceCapabilityData {
  projectGraphAvailable: boolean;
  projectTargetsAvailable: boolean;
  tagsAvailable: boolean;
  metadataAvailable: boolean;
  nxVersion?: string;
  source?: 'nx-project-graph';
}
```

Capability id:

```text
capability:nx
```

Extensions may use this to enhance behavior when Nx context exists, but generic extensions must not require it unless they are explicitly Nx-specific.

## Nx Adapter Mapping Rules

### Projects

Nx graph nodes should map to Core projects.

| Nx source | Core field |
|---|---|
| graph node name | `GovernanceProject.id` and/or `name` |
| project root | `GovernanceProject.root` |
| project type | `GovernanceProject.type` |
| tags | `GovernanceProject.tags` |
| metadata | `GovernanceProject.metadata` |
| inferred domain/scope/layer tags | `domain`, `scope`, `layer` |
| ownership metadata / CODEOWNERS | `ownership` |

### Dependencies

Nx graph dependencies should map to Core dependencies.

| Nx source | Core field |
|---|---|
| source project | `sourceProjectId` |
| target project | `targetProjectId` |
| dependency type | `type` |
| source file | `sourceFile` where available |
| extra dependency data | `metadata` |

Dependencies to projects outside the known graph should be handled consistently. The initial compatibility-preserving behavior may filter to known projects, but this should be documented in implementation tests.

## CODEOWNERS Position

Current behavior derives ownership from CODEOWNERS in the Nx adapter path.

Recommended migration position:

1. Keep CODEOWNERS mapping in the Nx adapter initially to preserve compatibility.
2. Represent ownership through Core `GovernanceOwnership`.
3. Capture the ownership source in `ownership.source`, for example `codeowners`.
4. Later evaluate whether CODEOWNERS should become a generic filesystem ownership enricher usable by CLI and TypeScript adapter.

This avoids breaking current behavior while keeping the long-term design open.

## Inventory / Normalization Boundary

Current `buildInventory` logic is valuable but currently depends on Nx adapter snapshot types.

Target direction:

- Core may own generic normalization from adapter result to canonical workspace.
- Adapter-specific snapshots should remain private to adapters.
- Any generic intermediate adapter output type should be Core-owned and not named after Nx.
- `buildInventory` should stop importing `../nx-adapter/types.js` during #218.

Recommended implementation path:

1. Introduce Core-owned adapter result contract.
2. Update inventory normalization to consume that contract.
3. Keep Nx adapter internals stable.
4. Preserve current output behavior and tests.

## Intermediate Snapshot Decision

The target public contract should return `GovernanceWorkspaceAdapterResult` with canonical `GovernanceWorkspace`.

Adapters may internally use snapshots, for example:

```text
Nx project graph -> private Nx snapshot -> GovernanceWorkspaceAdapterResult
```

The private snapshot should not leak into:

- Core contracts
- extension context
- rule contexts
- CLI host contracts
- other adapters

If a shared intermediate type becomes necessary, it should be named generically and owned by Core, for example `GovernanceWorkspaceSourceSnapshot`, not `AdapterWorkspaceSnapshot` from `nx-adapter`.

## Manual CLI Adapter

The CLI MVP can use a manual YAML/JSON adapter.

Responsibilities:

- read an explicit workspace file
- validate minimal project/dependency structure
- map it to `GovernanceWorkspace`
- contribute `capability:manual-workspace`
- return diagnostics for invalid references or duplicate ids

Non-goals:

- no TypeScript import graph analysis
- no package-manager discovery
- no Nx graph loading

This adapter proves Core independence without expanding scope into source analysis.

## Generic TypeScript Adapter

The TypeScript adapter should build after the CLI MVP.

Responsibilities:

- detect package-manager workspaces
- parse `package.json` workspaces
- parse `pnpm-workspace.yaml` where needed
- parse npm/yarn workspace patterns where needed
- parse tsconfig path aliases
- discover projects using configured globs
- build static TypeScript/JavaScript import dependency graph
- emit `GovernanceWorkspace`
- contribute `capability:typescript`
- contribute `capability:package-manager`

Non-goals:

- no Nx graph loading
- no Angular/React/NestJS-specific rules
- no CLI command behavior
- no ownership of Core rule semantics

## Extension Relationship

Extensions should consume adapter-provided capabilities, not adapter internals.

Examples:

- Angular extension can run with `capability:typescript` and optionally improve analysis with `capability:nx`.
- Maven/Java extension can consume a future JVM/package capability.
- Nx-specific extension can require `capability:nx` if explicitly scoped as Nx-specific.

Extension contracts should not expose Nx adapter snapshots or TypeScript adapter internals.

## Error and Failure Semantics

Recommended direction:

| Condition | Behavior |
|---|---|
| Adapter explicitly selected but cannot run | Fail with clear fatal diagnostic. |
| Adapter auto-detection has low confidence | Return detection result and allow host to choose. |
| Optional metadata missing | Continue with warning diagnostic. |
| Duplicate project ids | Fail or return fatal diagnostic. |
| Dependency references unknown project | Warn/filter initially for compatibility; future external dependency model may improve this. |
| Capability unavailable | Extensions should skip capability-specific behavior unless required. |

Exact fatal/warning mechanics can be finalized during #218/#228 implementation.

## Compatibility Constraints

During #218:

- existing Nx graph interpretation should remain stable
- current tag/domain/layer/scope mapping should remain stable
- CODEOWNERS behavior should remain stable
- current report output should remain stable
- current AI/snapshot/drift behavior should remain stable
- current executor/generator behavior should remain stable
- adapter extraction should happen behind existing Nx target surface

## Migration Notes for #218

Recommended sequence:

1. Define Core-owned adapter result types internally.
2. Update inventory normalization to depend on Core-owned adapter result types.
3. Keep current Nx adapter behavior unchanged.
4. Make Nx adapter emit the Core-owned adapter result shape.
5. Move Nx-specific data into `metadata` and `capability:nx` where needed.
6. Remove Nx adapter type imports from Core-facing contracts.
7. Add tests for mapping behavior before moving files.
8. Preserve current user-facing Nx target behavior.

## Future Questions

Open decisions for #218/#228 implementation:

- exact TypeScript interface names and file layout
- whether adapter `detect` should be async-only or sync/async
- how fatal diagnostics are represented
- whether external dependencies need a first-class Core model
- how much Nx project target data belongs in metadata versus `capability:nx`
- long-term home for CODEOWNERS mapping
- how multi-workspace / PolyGraph identity should be represented
- whether adapters can compose, for example Nx adapter plus TypeScript enrichment

## Acceptance Check for #228

- [x] Governance Core no longer conceptually depends on Nx adapter snapshot types.
- [x] Nx adapter responsibilities are explicit.
- [x] Adapter output is defined clearly enough for #218 implementation.
- [x] Capability contribution from adapters is defined.
- [x] Workspace identity and project identity requirements are documented.
- [x] The design supports future manual CLI and TypeScript adapters.
