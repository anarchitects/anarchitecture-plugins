# Nx Governance Extensions

This is the practical guide for registering and authoring governance extensions for the Nx Governance host.

For the architecture-level model and roadmap context, see:

- [`docs/governance/governance-extension-host-v2.md`](../../docs/governance/governance-extension-host-v2.md)
- [`docs/governance/governance-ecosystem-migration-plan.md`](../../docs/governance/governance-ecosystem-migration-plan.md)

## Registering an extension

The preferred registration model is explicit governance config in `nx.json`:

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

You can write that config manually or use the generator:

```bash
nx g @anarchitects/nx-governance:add-extension @anarchitects/governance-extension-angular
```

The generator:

- writes config only
- does not install packages
- does not validate package existence
- does not load packages during generation

## Loading behavior

Current loading behavior is deterministic:

1. explicit `nx.json.governance.extensions`
2. legacy compatibility probing from `nx.json.plugins`, when enabled

Important details:

- explicit extension packages are imported directly from their configured `package` value
- legacy probing uses `<plugin>/governance-extension`
- explicit registration takes precedence
- duplicate module specifiers are not loaded twice
- duplicate extension ids still fail

## Optional vs required extensions

Use `optional: true` when an extension should not fail the governance run if the package is absent.

Current behavior:

- optional missing extension: skipped
- required missing extension: fails
- invalid installed extension: fails
- registration failure inside an installed extension: fails

## Legacy probing compatibility

Legacy probing still exists for compatibility, but it is no longer the preferred model.

Behavior:

- if no explicit governance extensions are configured, legacy probing is enabled by default
- if explicit governance extensions are configured, legacy probing is disabled by default
- set `legacyPluginProbing: true` to force compatibility probing alongside explicit registration

Legacy probing still safely skips missing governance entrypoints on ordinary Nx plugins.

## Minimal extension authoring example

```ts
import type { GovernanceExtensionDefinition } from '@anarchitects/governance-core';

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

Requirements:

- export a named `governanceExtension`
- declare a unique, non-empty `id`
- depend on governance contracts, not Nx APIs
- use capabilities for ecosystem awareness

## Public extension contracts

Use the published `@anarchitects/governance-core` package for extension-facing contracts:

- `GovernanceExtensionDefinition`
- `GovernanceExtensionHost`
- `GovernanceExtensionHostContext`
- `GovernanceWorkspaceEnricher`
- `GovernanceExtensionRulePack`
- `GovernanceSignalProvider`
- `GovernanceMetricProvider`
- `GovernanceCapabilityRegistry`

Extensions should also reuse shared output contracts such as:

- `GovernanceSignal`
- `Violation`
- `Measurement`

The `@anarchitects/nx-governance` package root remains a compatibility shell for existing consumers, but it is no longer the canonical extension authoring surface.

## Capability usage

Extensions should feature-detect capabilities instead of importing adapter internals.

Example:

```ts
const nxCapability = host.context.capabilities.get('capability:nx');
```

`capability:nx` currently exposes stable, minimal Nx-aware data:

- workspace root
- project names
- project roots
- project types
- project tags
- project target names

It does not expose raw Nx project graph internals or `@nx/devkit` types.

## Contribution lifecycle

At runtime, governance executes extension contributions in this order:

1. register extensions
2. apply enrichers
3. evaluate core policies
4. evaluate extension rule packs
5. build core signals, then collect extension signals
6. calculate core metrics, then collect extension metrics

This keeps scoring and reporting centralized while allowing ecosystem-specific intelligence to plug into the shared pipeline.
