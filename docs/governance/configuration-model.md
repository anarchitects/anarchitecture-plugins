# Nx Governance Configuration Model

This document captures the current responsibility split described in
[the configuration surface audit](./configuration-surface-audit.md) and
stabilized by issue #187.

Project Crystal target inference usage and compatibility are documented in
[the inference contract](./project-crystal-target-inference-contract.md) and in
[the package README](../../packages/governance/README.md#project-crystal-inference).

## Responsibility split

### Profiles

A governance profile is the runtime policy/configuration for a workspace.
Profiles are user-owned JSON files, typically under
`tools/governance/profiles/<name>.json`.

Profiles define runtime governance expectations such as:

- policy and boundary settings
- ordered `layers` plus optional explicit `allowedLayerDependencies`
- ownership and documentation expectations
- health thresholds and metric weights
- exceptions and project overrides

Executors read the selected profile file at runtime. Profiles are the explicit
configuration surface that should remain stable for CI, reports, and governance
graph generation.
Runtime profile loading belongs to the `src/profile/` layer rather than to any
concrete preset module.

Layer rules now have two modes:

- If `allowedLayerDependencies` is absent, layer-boundary evaluation falls back
  to the declared `layers` order exactly as before.
- If `allowedLayerDependencies` is present, it becomes the explicit global
  source-layer to target-layer allowlist. Missing source keys are interpreted
  strictly as allowing no outgoing layer dependencies from that source layer.

`allowedLayerDependencies` is separate from `allowedDomainDependencies`. Layer
and domain boundary findings can both apply to the same dependency.
The current ESLint integration continues to sync only
`allowedDomainDependencies`; explicit layer matrices remain runtime-governance
policy until a broader lint representation exists.

### Presets

Presets are starter templates shipped by the plugin. They provide baseline
defaults for init and documentation, but they are not the long-term runtime
identity of a workspace.

The recommended built-in preset is `frontend-layered` for the current
UI-leaning layered Nx taxonomy. The core package also ships
`backend-layered-3tier` and `backend-layered-ddd` starter presets for backend
workspaces. `layered-workspace` remains available as a compatibility alias for
the earlier neutral rename.

Presets are used to:

- provide generator defaults
- seed a starter profile file during init
- document supported starter conventions

Presets do not replace user-owned profile files.
The implementation is intentionally split between concrete preset modules and a
neutral built-in preset registry so no single preset module acts as the central
runtime entrypoint.

### Executor options

Executor options are runtime controls. They may:

- select a profile by name
- choose output format or output paths
- control failure behavior and report mode

Executor options should not duplicate governance policy that already belongs in
the selected profile file.

### Init generator

The init generator bootstraps minimal setup. It currently:

- registers the governance plugin in `nx.json`
- adds a minimal default root target set to `package.json`
  - `repo-health`
  - `governance-graph`
- treats `governance-graph` as part of the minimal target surface because it is a core reporting artifact rather than an advanced diagnostic
- adds the broader legacy target surface only when `targetPreset: "full"` is selected
- seeds one or more selected starter profile files when they are missing
  - default preset/profile selection: `frontend-layered`
  - when `profile` is omitted, the first selected preset becomes the default runtime profile for generated root targets
  - backend starter presets: `backend-layered-3tier` and `backend-layered-ddd`
  - `backend-layered-3tier` and `backend-layered-ddd` are mutually exclusive
- runs ESLint integration unless disabled

Init is not the long-term source of truth for runtime policy. It should seed
configuration and preserve user-owned targets and profiles.

## Precedence rules

The current behavior is intentionally preserved:

1. Existing user configuration wins over generator defaults.
2. Explicit executor options win over generated defaults.
3. Profile files are runtime configuration.
4. Presets are starter templates used to create or seed profile files.
5. Init must preserve existing profile and target configuration.
6. Inferred targets fill missing root targets; explicit targets remain
   authoritative when the same name exists in workspace config.

## Backward compatibility

Existing explicit targets remain supported. Existing `layered-workspace`
profile files, target options, and preset references remain supported as
compatibility aliases. New workspaces should prefer `frontend-layered` or one
of the backend presets when those taxonomies fit better. The broader governance
target surface remains available through explicit targets and the init
generator's `targetPreset: "full"` option. All executors remain available even
when init writes only the minimal root target surface. `governance-graph`
belongs to both the minimal and full target presets, while snapshot/drift,
diagnostic, and AI targets remain outside minimal. Graph generation stays
target-surface driven rather than preset-driven, and it uses the currently
selected governance profile at runtime. Core Project Crystal inference now
supplies the four root-oriented governance report targets from
`tools/governance/profiles/*.json` when explicit targets are absent, without
overriding explicit user-owned targets.

Framework-specific intelligence still belongs in extension plugins rather than
the core preset identity. This issue does not implement the future Angular
governance extension plugin.

## Relationship to target inference

Core Project Crystal inference is now implemented for the four report targets:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`

Inference discovers profile files from `tools/governance/profiles/*.json` and
uses one deterministic default profile for those stable target names.
`governance-graph` remains explicit-only. Broader inference questions such as
snapshot/drift, diagnostics, AI targets, and any future cleanup of redundant
explicit root targets remain follow-up work.
