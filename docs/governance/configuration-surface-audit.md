# Nx Governance Configuration Surface Audit

## Purpose

This audit captures the **current post-cleanup governance surface** for epic
#182 after the preset, init, and Governance Graph cleanup issues.

It exists to document the configuration that is intentionally exposed today so
future changes can be made against an accurate baseline instead of against
stale pre-cleanup assumptions.

## Scope

This audit reflects the governance surface in:

- `packages/governance/`
- `docs/governance/`
- `tools/governance/`
- root `package.json`
- root `nx.json`

## Current init behavior

The init generator is implemented in
`packages/governance/src/generators/init/generator.ts`.

Today it:

- registers `@anarchitects/nx-governance` in `nx.json` when needed
- creates `package.json > nx.targets` when missing
- writes a **minimal** root target surface by default
  - `repo-health`
  - `governance-graph`
- restores the broader explicit root target surface only when
  `targetPreset: "full"` is selected
- seeds one or more selected starter profile files under
  `tools/governance/profiles/`
- preserves existing targets, target options, and existing profile files
- optionally runs the ESLint integration generator

Init is intentionally additive and non-destructive. It does not remove existing
root targets, overwrite user-owned target options, or replace existing profile
files.

## Current profile and preset model

Profiles are the runtime governance configuration used by executors.

- profile files live under `tools/governance/profiles/<profile-name>.json`
- executors resolve runtime behavior from the selected profile name/path
- profiles define layers, boundary policy, ownership expectations, health
  thresholds, metric weights, exceptions, and project overrides
- profiles may optionally define `allowedLayerDependencies` as an explicit
  source-layer allowlist; when absent, the ordered `layers` list remains the
  fallback layer rule model

Presets are starter templates used by init.

Current built-in starter presets:

- `frontend-layered`
- `backend-layered-3tier`
- `backend-layered-ddd`

Compatibility alias:

- `layered-workspace`

Current selection rules:

- init defaults to `frontend-layered`
- `preset` is multi-select
- when `profile` is omitted, the first selected preset becomes the default
  runtime profile wired into generated root targets
- `backend-layered-3tier` and `backend-layered-ddd` are mutually exclusive

Presets seed starter JSON. They are not executors, root target definitions, or
a replacement for user-owned runtime profiles.

## Current target surface

The generated root target surface is now split between `minimal` and `full`.

### Minimal/default

- `repo-health`
- `governance-graph`

### Full

`full` includes the minimal surface plus:

- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`
- `repo-snapshot`
- `repo-drift`
- `workspace-graph`
- `workspace-conformance`
- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`

All executors remain registered and callable even when init writes only the
minimal root target set.

The committed root `package.json` in this repository intentionally keeps a
broader explicit target surface as repository-owned configuration. That should
not be confused with the init generator default for new workspaces.

## Current Governance Graph wiring

`governance-graph` is part of both the minimal and full target presets.

Current defaults for the generated root target:

- `format: "html"`
- `outputPath: "dist/governance/graph.html"`

Supported usage:

- HTML viewer output for direct inspection
- JSON output for downstream tooling or CI artifacts via
  `--format=json --outputPath=dist/governance/graph.json`

The graph executor evaluates the currently selected governance profile at
runtime. It is target-surface driven rather than starter-preset driven.

This cleanup does **not** add native Nx Graph UI integration.

## Current executor surface

Public executors remain explicitly registered and available.

Core reporting:

- `repo-health`
- `repo-boundaries`
- `repo-ownership`
- `repo-architecture`

Support workflows:

- `repo-snapshot`
- `repo-drift`

Diagnostics:

- `workspace-graph`
- `workspace-conformance`

Graph/reporting:

- `governance-graph`

Optional AI workflows:

- `repo-ai-root-cause`
- `repo-ai-drift`
- `repo-ai-pr-impact`
- `repo-ai-cognitive-load`
- `repo-ai-recommendations`
- `repo-ai-smell-clusters`
- `repo-ai-refactoring-suggestions`
- `repo-ai-scorecard`
- `repo-ai-onboarding`

AI executors remain available but are not part of the minimal init target
surface.

## Current ESLint integration surface

The ESLint integration generator is implemented in
`packages/governance/src/generators/eslint-integration/generator.ts`.

Current behavior:

- patches **flat ESLint config** only
- autodetects `eslint.config.mjs`, then `eslint.config.cjs`, then
  `eslint.config.js`
- writes the governance helper module to
  `tools/governance/eslint/dependency-constraints.mjs` by default
- supports overriding both the ESLint config path and helper path
- migrates inline `depConstraints` into the selected governance profile when
  possible

The generated helper reads governance profiles from
`tools/governance/profiles/`, merges `allowedDomainDependencies`, and exports a
deterministic `governanceDepConstraints` array for
`@nx/enforce-module-boundaries`.

Explicit `allowedLayerDependencies` remain a runtime governance feature. The
current ESLint integration does not attempt to translate the layer matrix into
`depConstraints`.

Legacy `.eslintrc*` support is not part of this cleanup.

## Current explicit config examples in this repository

This repository now uses the current default runtime profile name:

- `tools/governance/profiles/frontend-layered.json`

The root workspace governance targets also reference `frontend-layered` instead
of any removed legacy preset name.

## Relationship to future Project Crystal inference

Project Crystal target inference is still future work.

Current state:

- explicit governance executors and explicit root targets remain supported
- init still writes explicit root targets
- future inference should fill missing governance targets without overriding
  explicit user-owned target configuration

This audit should not be read as evidence that inference is already the primary
runtime model.
