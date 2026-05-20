# Governance Extension Host v2

## Purpose

This document records the implemented Governance Extension Host v2 model in `@anarchitects/nx-governance`.

It supports parent epic #219 and reflects the implementation work completed across #307 through #316. It also fits into the broader Governance Ecosystem roadmap documented in [governance-ecosystem-migration-plan.md](./governance-ecosystem-migration-plan.md), [governance-core-contracts.md](./governance-core-contracts.md), and [governance-workspace-adapter-contract.md](./governance-workspace-adapter-contract.md).

This document describes current behavior. It does not introduce new runtime features.

## What Extension Host v2 Means Here

Governance Extension Host v2 is the current transitional implementation that moves governance extensions toward:

- Core-owned extension contracts
- explicit governance-specific registration
- adapter-owned capabilities instead of adapter internals in extension context
- deterministic loading and contribution ordering
- structured extension-loading diagnostics
- compatibility with older `nx.json.plugins` probing during migration

It does not mean the Governance package has already been physically split. Boundary hardening and package split readiness continue later in:

- #328 Governance Boundary Hardening and Package Split Readiness
- #329 Governance Ecosystem Physical Package Split

## Responsibility Split

| Area                      | Responsibility                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Governance Core contracts | Own extension contracts, contribution interfaces, capability registry contracts, and diagnostic contracts.                        |
| Nx plugin host            | Read `nx.json`, discover/load extensions, build runtime context, and run the extension pipeline during Nx-hosted governance runs. |
| Nx adapter                | Produce adapter-owned capabilities such as `capability:nx` without exposing raw Nx internals.                                     |
| Extensions                | Contribute enrichers, rule packs, signal providers, and metric providers.                                                         |

In short:

- Core owns contracts.
- Hosts own discovery and loading.
- Adapters own capabilities.
- Extensions own ecosystem-specific intelligence.

## Implemented Configuration Model

The supported explicit registration shape is `nx.json.governance`:

```json
{
  "governance": {
    "extensions": [
      {
        "package": "@anarchitects/governance-extension-angular",
        "optional": true,
        "options": {}
      }
    ],
    "legacyPluginProbing": false
  }
}
```

Current behavior:

- Explicit extension packages are imported directly from the configured `package` value.
- Legacy compatibility probing still uses `<plugin>/governance-extension`.
- Explicit extensions load before any legacy compatibility probing.
- If explicit extensions are configured, legacy probing is disabled by default unless `legacyPluginProbing: true` is set.
- If no explicit extensions are configured, legacy probing remains enabled for compatibility.

Validation rules for `nx.json.governance.extensions`:

- each entry must be an object
- `package` must be a non-empty string
- duplicate package names are rejected
- `optional`, when provided, must be a boolean
- `options`, when provided, must be an object

## Registration Generator

The package includes an explicit registration generator:

```bash
nx g @anarchitects/nx-governance:add-extension @anarchitects/governance-extension-angular
```

What it does:

- writes `nx.json.governance.extensions`
- preserves existing `nx.json` fields
- avoids duplicate config entries
- can update the `optional` flag when explicitly provided

What it does not do:

- install npm packages
- validate that the package exists
- load the package
- change runtime discovery semantics

Package installation remains the workspace/package-manager responsibility.

## Discovery and Loading Behavior

Current extension loading order is deterministic:

1. Parse `nx.json.governance.extensions`.
2. Load explicit extension packages directly, in config order.
3. Optionally probe legacy `nx.json.plugins` entries, in normalized plugin order.
4. Register extension contributions in discovered order.

Legacy probing normalization still:

- supports string plugin entries and object plugin entries with a `plugin` field
- skips blank plugin specifiers
- skips `@anarchitects/nx-governance`
- skips local plugin specifiers starting with `.`, `/`, or `file:`

### Explicit vs legacy precedence

- Explicit registration is the preferred model.
- Legacy probing is compatibility behavior.
- When both are enabled, explicit packages are attempted first.
- Duplicate module specifiers are only loaded once.
- If different module specifiers produce the same extension `id`, registration fails.

## Optional vs Required Extensions

Explicit extension registrations currently support optional vs required behavior through the `optional` flag.

Behavior summary:

- configured optional extension missing: skipped, diagnostic emitted, run continues
- configured required extension missing: diagnostic emitted, run fails
- invalid installed extension definition: diagnostic emitted, run fails
- registration-time error: diagnostic emitted, run fails
- missing legacy `<plugin>/governance-extension` entrypoint: skipped, diagnostic emitted, run continues
- unrelated module-resolution failure inside a loaded extension: run fails

This keeps optional ecosystem intelligence non-fatal while preserving strict failure behavior for explicit required extensions.

## Extension Contracts

The public extension-facing contract is intentionally small:

```ts
export interface GovernanceExtensionDefinition {
  id: string;
  register(host: GovernanceExtensionHost): void | Promise<void>;
}
```

The extension execution context is Core-owned:

```ts
export interface GovernanceExtensionHostContext {
  workspaceRoot: string;
  profileName: string;
  options: Readonly<Record<string, unknown>>;
  inventory: GovernanceWorkspace;
  capabilities: GovernanceCapabilityRegistry;
}
```

Important constraints:

- extension modules must export a named `governanceExtension`
- extension `id` must be unique and non-empty
- extension-facing contracts must remain Nx-free
- extension authors should depend on governance contracts, not Nx APIs
- Nx awareness should come through capabilities

## Minimal Extension Authoring Example

```ts
import type { GovernanceExtensionDefinition } from '@anarchitects/nx-governance';

export const governanceExtension: GovernanceExtensionDefinition = {
  id: 'example-extension',
  register(host) {
    host.registerRulePack({
      evaluate(input) {
        return [];
      },
    });
  },
};
```

## Contribution Types

The implemented contribution surface is:

- `registerEnricher(...)`
- `registerRulePack(...)`
- `registerSignalProvider(...)`
- `registerMetricProvider(...)`

These contributions flow into the existing governance pipeline:

1. register extensions
2. apply enrichers
3. evaluate core policies
4. evaluate extension rule packs
5. build core signals, then collect extension signals
6. calculate core metrics, then collect extension metrics

Execution remains deterministic:

- extension registration follows discovery order
- enrichers run sequentially in registry order
- rule-pack results preserve registry order
- signal-provider results preserve registry order
- metric-provider results preserve registry order

## Capability Registry

Extension context exposes a generic capability registry:

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

The registry is generic and not Nx-specific by contract.

### `capability:nx`

The current runtime exposes one adapter-owned Nx capability:

```ts
const nxCapability = host.context.capabilities.get('capability:nx');
```

Its payload is intentionally small and stable:

- `workspaceRoot`
- `projects[].name`
- `projects[].root`
- `projects[].type`
- `projects[].tags`
- `projects[].targets`

This allows extensions to inspect Nx-aware structure without seeing:

- raw Nx project graph objects
- raw `@nx/devkit` types
- full target configuration objects
- file maps
- adapter snapshots as-is

Richer framework/language capabilities remain future work.

## Diagnostics

Extension loading and registration now produce structured host-local diagnostics.

Supported diagnostic codes:

- `governance.extension.loaded`
- `governance.extension.skipped_optional_missing`
- `governance.extension.missing_required`
- `governance.extension.invalid_definition`
- `governance.extension.duplicate_id`
- `governance.extension.registration_failed`
- `governance.extension.legacy_probing_used`
- `governance.extension.legacy_entrypoint_missing`

Current diagnostic behavior:

- diagnostics are deterministic and ordered by discovery/registration flow
- fatal cases still throw
- optional and legacy skip behavior is observable through diagnostics
- diagnostics are currently local to extension loading, not a global diagnostics/reporting framework

Future reporting and observability expansion is outside this issue.

## Compatibility Behavior

Legacy probing remains available because the implementation is still in transition.

Current rules:

- no explicit extensions configured: legacy probing is enabled by default
- explicit extensions configured: legacy probing is disabled by default
- `legacyPluginProbing: true`: enables compatibility probing alongside explicit registration
- `legacyPluginProbing: false`: disables compatibility probing even if `nx.json.plugins` is populated

When legacy probing is used:

- a deprecation warning is emitted once per governance run
- missing legacy governance entrypoints are skipped safely
- `ERR_PACKAGE_PATH_NOT_EXPORTED` is skipped only when it matches the expected governance-entrypoint lookup
- direct missing module lookups for the governance entrypoint are skipped only when they match the expected legacy lookup
- unrelated module errors are rethrown

## Test Protection

The implementation is now backed by dedicated regression coverage for:

- explicit extension loading and precedence
- legacy probing compatibility behavior
- deduplication behavior
- optional vs required extension semantics
- diagnostics ordering and fatal/non-fatal behavior
- deterministic contribution execution ordering
- capability-registry behavior
- Nx-free extension contract boundaries
- adapter-only production of `capability:nx`

This protection is intentionally in place before:

- #220 Standalone CLI MVP
- #221 Generic TypeScript Adapter
- #328 Boundary Hardening
- #329 Physical Package Split

## Non-goals

The current Extension Host v2 work does not complete:

- physical package split
- standalone CLI completion
- framework-specific extension package implementation
- full diagnostics/reporting redesign
- capability negotiation or version requirements
- removal of Nx Governance compatibility
- removal of legacy probing

## Future Work

Remaining follow-up areas include:

- #220 Standalone CLI MVP
- #221 Generic TypeScript Adapter
- #328 Governance Boundary Hardening and Package Split Readiness
- #329 Governance Ecosystem Physical Package Split

Those issues continue the migration. This document should not be read as claiming that transitional internal coupling has been fully eliminated.
