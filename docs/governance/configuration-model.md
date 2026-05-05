# Nx Governance Configuration Model

This document captures the current responsibility split described in
[the configuration surface audit](./configuration-surface-audit.md) and
stabilized by issue #187.

## Responsibility split

### Profiles

A governance profile is the runtime policy/configuration for a workspace.
Profiles are user-owned JSON files, typically under
`tools/governance/profiles/<name>.json`.

Profiles define runtime governance expectations such as:

- policy and boundary settings
- ownership and documentation expectations
- health thresholds and metric weights
- exceptions and project overrides

Executors read the selected profile file at runtime. Profiles are the explicit
configuration surface that should remain stable for CI, reports, and governance
graph generation.

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
6. Future inferred targets should fill missing targets, not override explicit targets.

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
selected governance profile at runtime. This clarification does not
introduce Project Crystal target inference.

Framework-specific intelligence still belongs in extension plugins rather than
the core preset identity. This issue does not implement the future Angular
governance extension plugin.

## Relationship to future target inference

Future Project Crystal inference should supply missing governance targets
without overriding explicit targets already present in workspace configuration.
That work remains outside issue #187.
