# Nx Governance Extensions

This document describes the extension model for `@anarchitects/nx-governance`.

The product architecture is:

- one shared core Nx plugin: `@anarchitects/nx-governance`
- multiple ecosystem-specific extension plugins such as `@anarchitects/nx-governance-angular`

The core owns governance orchestration, scoring, reporting, and shared data contracts. Extension plugins contribute ecosystem-specific intelligence into that shared pipeline.

## Core vs extension responsibilities

The core plugin owns:

- Nx workspace graph loading and normalization
- governance execution lifecycle
- shared governance models such as `GovernanceSignal`, `Violation`, and `Measurement`
- health scoring and score aggregation
- CLI and JSON reporting
- extension discovery and registration

Extension plugins own:

- workspace enrichers
- rule packs
- signal providers
- metric providers
- optional presets and extension-specific documentation

Extensions contribute inputs into the governance pipeline. They do not replace core scoring, reporting, or output formats.

## Discovery convention

Governance-capable Nx plugins are discovered from `nx.json.plugins`.

If a plugin wants to participate in governance, it should expose a subpath entrypoint at:

```text
<package>/governance-extension
```

That module must export a named `governanceExtension` value.

## Public authoring contracts

The core package exports the extension-facing contracts from the package root:

- `GovernanceExtensionDefinition`
- `GovernanceExtensionHostContext`
- `GovernanceExtensionHost`
- `GovernanceWorkspaceEnricher`
- `GovernanceRulePack`
- `GovernanceSignalProvider`
- `GovernanceMetricProvider`

Extensions should reuse the shared governance output types:

- `GovernanceSignal`
- `Violation`
- `Measurement`

## Execution lifecycle

At runtime, the core pipeline executes in this order:

1. Load the governance profile and Nx workspace snapshot.
2. Build the normalized governance workspace inventory.
3. Discover governance extensions from `nx.json.plugins`.
4. Register enrichers, rule packs, signal providers, and metric providers.
5. Apply enrichers to the workspace inventory.
6. Evaluate core policies and extension rule packs.
7. Build core signals and collect extension signals.
8. Build core metrics and collect extension metrics.
9. Aggregate health, render reports, and produce JSON output.

This preserves a single governance truth while allowing ecosystem-specific analysis.

## Minimal extension example

```ts
import type {
  GovernanceExtensionDefinition,
  GovernanceMetricProvider,
  GovernanceRulePack,
  GovernanceSignalProvider,
  GovernanceWorkspaceEnricher,
} from '@anarchitects/nx-governance';

const angularEnricher: GovernanceWorkspaceEnricher = {
  enrichWorkspace({ workspace }) {
    return workspace;
  },
};

const angularRules: GovernanceRulePack = {
  evaluate() {
    return [];
  },
};

const angularSignals: GovernanceSignalProvider = {
  provideSignals() {
    return [];
  },
};

const angularMetrics: GovernanceMetricProvider = {
  provideMetrics() {
    return [];
  },
};

export const governanceExtension: GovernanceExtensionDefinition = {
  id: '@anarchitects/nx-governance-angular',
  register(host) {
    host.registerEnricher(angularEnricher);
    host.registerRulePack(angularRules);
    host.registerSignalProvider(angularSignals);
    host.registerMetricProvider(angularMetrics);
  },
};
```

## Angular as the reference extension

The Angular engine is intended to be implemented as a separate package:

- `@anarchitects/nx-governance-angular`

That package is the reference model for future ecosystem engines such as:

- TypeScript
- React
- Maven
- Gradle
- .NET

The Angular plugin should contribute Angular-specific metrics, signals, rule packs, and metadata enrichers through the core contracts. It should not duplicate governance scoring or reporting infrastructure.
