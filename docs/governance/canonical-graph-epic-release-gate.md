# Canonical Graph Epic Release Gate

This note is the pre-close release gate for Governance canonical graph epic `#427`.

It covers plugin-side cleanup only:

- canonical host/runtime composition
- root package entrypoint compatibility shell wording
- plugin-side `@anarchitects/governance-core` version alignment

It does not claim repo-wide removal of every Nx source-system
`projectId`-shaped field in adapter graph snapshot helpers or capability
payloads that intentionally describe the upstream Nx project graph.

## Automated Guard

`packages/governance/src/compatibility/canonical-graph-release-gate.spec.ts` enforces the narrow plugin-side gate:

- no legacy Core project/dependency contracts in the canonical runtime or root shell sources
- no `workspace.projects` / `workspace.dependencies` or `inventory.projects` / `inventory.dependencies` in those sources
- no stale `Omit<GovernanceWorkspace, 'projects' | 'dependencies'>` typing
- all plugin-side packages depending on `@anarchitects/governance-core` are pinned to `0.2.0`

## Raw Audit Scans

Run these from the repo root before closing `#427`:

```bash
rg "GovernanceProjectInput|GovernanceDependencyInput|GovernanceProject|GovernanceDependency|GovernanceCompatibilityWorkspace" packages --glob '!**/*.md'
rg "workspace\\.projects|workspace\\.dependencies|inventory\\.projects|inventory\\.dependencies|assessment\\.workspace\\.projects|assessment\\.workspace\\.dependencies" packages --glob '!**/*.md'
rg "projectId|sourceProjectId|targetProjectId|relatedProjectIds|affectedProjects|Violation\\.project" packages --glob '!**/*.md'
rg "Omit<GovernanceWorkspace, 'projects' \\| 'dependencies'>|Omit<GovernanceWorkspace, \\\"projects\\\" \\| \\\"dependencies\\\">" packages --glob '!**/*.md'
rg '"@anarchitects/governance-core": "0.2.0"' packages/*/package.json
```

## Expected Interpretation

- The canonical runtime and root package entrypoint shell should stay clean under the automated guard.
- Raw `projectId`-style hits are only acceptable when they remain inside Nx
  source-system adapter helpers or capability payloads and do not represent
  Governance Core workspace, inventory, runtime, or graph-document contracts.
- Historical or transitional hits outside that narrow surface need explicit
  triage before epic closure.
- Mentions in superseded or historical docs are acceptable only when clearly marked as historical.
- Root package compatibility wording is acceptable only when it means package entrypoint compatibility, not governance model compatibility.
