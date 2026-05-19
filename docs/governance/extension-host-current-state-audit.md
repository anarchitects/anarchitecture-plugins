# Extension Host Current-State Audit

## Purpose

This document records the current governance extension host behavior for issue #307 and provides legacy-state input for parent epic #219.

It is intentionally descriptive. It does not implement Extension Host v2 or change the current runtime.

## Current Discovery Flow

1. `registerGovernanceExtensions(...)` calls `discoverGovernanceExtensions(...)` and then registers each discovered extension in `nx.json.plugins` order.
2. `discoverGovernanceExtensions(...)` reads `nx.json.plugins`. If `nxJson` is not injected, it reads `nx.json` from the workspace root using the host helper in `packages/governance/src/extensions/host.ts`.
3. Plugin entries are normalized from either:
   - a string plugin entry such as `@nx/jest/plugin`
   - an object entry using its `plugin` field
4. Normalization skips:
   - non-string or blank plugin specifiers
   - `@anarchitects/nx-governance`
   - local/file plugin specifiers beginning with `.`, `/`, or `file:`
5. Each remaining plugin specifier is converted to `<plugin>/governance-extension`.
6. The host loads that module through the configured module loader. The default loader is a dynamic `import(...)`.
7. The loaded module must export a named `governanceExtension` definition with a callable `register(...)` function.
8. `registerGovernanceExtensions(...)` validates that each discovered definition has a non-empty `id`, rejects duplicate ids, instantiates a `GovernanceExtensionHost`, and runs `definition.register(host)`.
9. Contributions are merged into a registry with four buckets: enrichers, rule packs, signal providers, and metric providers.

## Current Failure Behavior

- Missing governance entrypoints are skipped rather than treated as failures.
- `ERR_PACKAGE_PATH_NOT_EXPORTED` is skipped only when the error message matches the expected governance subpath for `<plugin>/governance-extension`.
- `ERR_MODULE_NOT_FOUND` and `MODULE_NOT_FOUND` are skipped only when the missing lookup target matches the governance-extension lookup being probed.
- Generic `Cannot find module ...` messages are also skipped only when they match the governance-extension lookup target.
- Unrelated module resolution failures are rethrown. A plugin missing one of its own runtime dependencies is not silently ignored.
- Invalid extension definitions fail. The module must expose a named `governanceExtension`, and the definition must have a non-empty `id`.
- Duplicate extension ids fail.
- Registration-time errors are wrapped with extension context: extension id plus module specifier.

## Current Extension Contribution Flow

The current contribution model is already structured and deterministic:

- Enrichers run first and can replace the working `GovernanceWorkspace` before policy and extension evaluation continues.
- Rule packs run after enrichment and contribute additional violations.
- Signal providers run after core signals are built and receive the merged violation context.
- Metric providers run after core metrics are calculated and receive the merged signals, current measurements, and violations.

In `runGovernance(...)`, the extension pipeline is:

1. Build Nx workspace snapshot and governance inventory.
2. Register governance extensions.
3. Apply enrichers.
4. Evaluate core policies.
5. Evaluate extension rule packs.
6. Build core signals, then collect extension signals.
7. Calculate core metrics, then collect extension metrics.

## Current Coupling Points

- The extension host imports `@nx/devkit` for the default workspace root.
- Discovery is based on `nx.json.plugins`, which is an Nx plugin registration surface rather than a governance-specific configuration surface.
- Runtime extension context still includes `workspaceRoot`, `profileName`, options, and the current governance inventory from the Nx-hosted run.
- The current model probes Nx and Nx-adjacent plugin packages for an Anarchitects-specific subpath: `<plugin>/governance-extension`.

## Notes on Current Runtime Shape

- Host context is shallow-frozen before registration. The context object and `context.options` are immutable to extensions, but this is not a deep freeze.
- Registration order follows normalized `nx.json.plugins` order.
- Contribution attribution is carried forward through `pluginId` / `sourcePluginId` defaults when rule packs, signal providers, and metric providers emit results.
- In the current workspace, `nx.json.plugins` is populated with standard Nx plugins. Those entries are still probed for governance entrypoints and silently skipped when the governance subpath is absent.
- Issue #308 removed Nx adapter snapshot exposure from `GovernanceExtensionHostContext`. Capability-based Nx awareness remains future work under #309 and #315.

## Capability Registry Baseline

- Issue #309 introduces a Core-owned capability registry into extension execution context.
- The current runtime only exposes a minimal `capability:nx` entry.
- Rich capability payloads remain future work; the runtime still does not expose raw Nx graph objects or adapter snapshots through extension contracts.
- Adapters and hosts still conceptually own capability production, with richer Nx-aware capability data deferred to later work under #315.

## Legacy Probing Status

- Issue #313 marks arbitrary `nx.json.plugins` probing as deprecated compatibility behavior.
- Explicit `nx.json.governance.extensions` is now the preferred registration model.
- If explicit governance extensions are configured, legacy probing is disabled by default unless `nx.json.governance.legacyPluginProbing` is set to `true`.
- If no explicit governance extensions are configured, legacy probing remains enabled for backward compatibility.
- When legacy probing is used, the runtime emits a deprecation warning once per governance run.

## Diagnostic Visibility

- Issue #314 adds a host-local structured diagnostics model for extension loading and registration.
- Successful explicit loads, optional missing packages, required missing packages, invalid definitions, duplicate ids, registration failures, legacy probing usage, and skipped legacy entrypoints are now represented as deterministic diagnostics.
- The runtime still preserves existing fatal vs non-fatal behavior; diagnostics make that behavior observable rather than changing it.
- Governance runs expose these diagnostics through extension-host/artifact metadata rather than a new global diagnostics framework.

## Implications for #219

- The current behavior is acceptable as a legacy compatibility model.
- Extension Host v2 should move toward explicit governance extension registration instead of probing `nx.json.plugins`.
- Core extension contracts should become Nx-free.
- A capability/context model should replace direct adapter snapshot exposure.
- Missing optional extensions should become diagnosable behavior long-term rather than remaining silent skips.

## Non-goals

- no runtime behavior changes
- no new config model
- no capability registry
- no package split
- no new extension package

## Acceptance Checklist

- [x] current behavior documented
- [x] risks and couplings documented
- [x] v2 implications documented
- [x] no runtime code changed
