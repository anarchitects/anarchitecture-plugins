# Community Contract Alignment Audit

Date: 2026-06-14  
Parent epic: #451  
Issue: #452

## Scope

This audit treats `anarchitecture-plugins` as the Nx host and integration
layer. `anarchitects/anarchitecture-community` owns the platform-independent
Governance semantics, canonical Core model, adapter contracts, and extension
contracts.

This document inventories the current plugin-side state and identifies the
follow-up work needed to align the Nx Governance packages with the published
Community Governance contracts after the hardening and boundary work.

## Upstream Community baseline

Community Governance hardening and the #357 boundary architecture work have
already been released and published. This audit assumes the plugins repository
should consume published Community package roots only and should not recreate
Community-owned behavior locally.

Relevant upstream issues:

- `anarchitecture-community#343` canonical ownership semantics
- `anarchitecture-community#344` corrected missing-domain-context hotspot attribution
- `anarchitecture-community#345` removed inert `ownership.metadataField` standalone contract
- `anarchitecture-community#347` capability/context-aware ownership-gap messaging
- `anarchitecture-community#349` TypeScript discovery projection into canonical governance attributes
- `anarchitecture-community#352` missing-domain and missing-layer applicability scoped away from infrastructure nodes
- `anarchitecture-community#357` canonical Core model, extension-owned expansions, adapter boundaries, and host configuration layering
- `anarchitecture-community#371` adapters must not runtime-depend on concrete extension implementation packages

Community packages the plugins repo should align against:

- `@anarchitects/governance-core`
- `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-extension-typescript`
- `@anarchitects/governance-adapter-dbt`
- `@anarchitects/governance-extension-dbt`

Latest published versions verified on 2026-06-14 with `npm view`:

| Package                                         | Latest published |
| ----------------------------------------------- | ---------------- |
| `@anarchitects/governance-core`                 | `0.4.1`          |
| `@anarchitects/governance-cli`                  | `0.6.0`          |
| `@anarchitects/governance-adapter-typescript`   | `0.4.1`          |
| `@anarchitects/governance-extension-typescript` | `0.2.1`          |
| `@anarchitects/governance-adapter-dbt`          | `0.1.4`          |
| `@anarchitects/governance-extension-dbt`        | `0.1.4`          |

## Current plugin package inventory

| Package                                 | Root                               | Role                            | Public entry points                                                                                                                                                         | Audit note                                                                                                                                     |
| --------------------------------------- | ---------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@anarchitects/nx-governance`           | `packages/governance`              | Nx host and integration package | `@anarchitects/nx-governance`, `@anarchitects/nx-governance/host`, `@anarchitects/nx-governance/plugin`, executors and generators from `packages/governance/src/index.json` | Owns Nx runtime composition, generators, executors, rendering, profile loading, extension loading, snapshot IO, and Project Crystal inference. |
| `@anarchitects/governance-adapter-nx`   | `packages/governance-adapter-nx`   | Nx adapter package              | `@anarchitects/governance-adapter-nx`                                                                                                                                       | Owns Nx graph/workspace extraction and Nx-to-canonical adapter mapping.                                                                        |
| `@anarchitects/governance-extension-nx` | `packages/governance-extension-nx` | Nx-specific extension package   | `@anarchitects/governance-extension-nx`                                                                                                                                     | Owns Nx-specific enrichers, rule outputs, signals, and metrics over canonical facts.                                                           |
| `nx-governance-e2e`                     | `packages/governance-e2e`          | E2E validation package          | none                                                                                                                                                                        | Test-only package for the Nx host.                                                                                                             |

Additional plugin-side compatibility shells:

- `packages/governance/src/index.ts` remains a root compatibility shell that
  re-exports `@anarchitects/governance-adapter-nx` and
  `@anarchitects/governance-core`.
- `packages/governance/src/nx-adapter/{capability,graph-adapter,read-workspace,to-governance-workspace-adapter-result,types}.ts`
  are local adapter compatibility wrappers around
  `@anarchitects/governance-adapter-nx`.
- `packages/governance/src/compatibility/root-barrel-inventory.ts` and
  `packages/governance/src/compatibility/root-barrel-compatibility.spec.ts`
  still carry legacy package-surface inventory metadata.

## Current Community dependency inventory

Direct manifest and lockfile references:

| Community package                               | Repo references                                                                                                                                 | Current repo version | Latest published | Finding                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------ |
| `@anarchitects/governance-core`                 | `packages/governance/package.json`, `packages/governance-adapter-nx/package.json`, `packages/governance-extension-nx/package.json`, `yarn.lock` | `0.2.0`              | `0.4.1`          | Bump required in `#453`.                                           |
| `@anarchitects/governance-cli`                  | no direct dependency                                                                                                                            | none                 | `0.6.0`          | Only docs, compatibility inventory, and boundary tests mention it. |
| `@anarchitects/governance-adapter-typescript`   | no direct dependency                                                                                                                            | none                 | `0.4.1`          | Only docs, compatibility inventory, and boundary tests mention it. |
| `@anarchitects/governance-extension-typescript` | no direct dependency                                                                                                                            | none                 | `0.2.1`          | Mentioned only in host extension config tests/examples.            |
| `@anarchitects/governance-adapter-dbt`          | no references found                                                                                                                             | none                 | `0.1.4`          | No current plugin-side usage.                                      |
| `@anarchitects/governance-extension-dbt`        | no references found                                                                                                                             | none                 | `0.1.4`          | No current plugin-side usage.                                      |

Stale version pins outside manifests:

- `packages/governance/src/compatibility/canonical-graph-release-gate.spec.ts`
  still expects `@anarchitects/governance-core` to be `0.2.0`.
- `docs/governance/canonical-graph-model.md` documents the canonical model as
  coming from `@anarchitects/governance-core@0.2.0`.
- `docs/governance/canonical-graph-epic-release-gate.md` still tells readers to
  pin `@anarchitects/governance-core` to `0.2.0`.
- `docs/governance/nx-governance-ownership-audit.md` still references the much
  older Community `0.0.4` baseline.

## Import and API usage findings

### Active production imports

No active production code deep-imports Community internals. Current production
imports are through published package roots only.

Production files importing published Community APIs:

- `packages/governance-adapter-nx/src/{capability,read-workspace,to-governance-workspace-adapter-result,types}.ts`
- `packages/governance-extension-nx/src/lib/governance-extension-nx.ts`
- `packages/governance/src/{index,ai-handoff/index,drift-analysis/index,snapshot-store/index}.ts`
- `packages/governance/src/extensions/{capabilities,contracts,diagnostics,runtime}.ts`
- `packages/governance/src/graph-document/{build-governance-graph-document,contracts}.ts`
- `packages/governance/src/nx-adapter/{capability,graph-adapter,read-workspace,to-governance-workspace-adapter-result,types}.ts`
- `packages/governance/src/plugin/{build-assessment-artifacts,compose-governance-runtime,governance-run-renderers,run-governance,snapshot-runtime}.ts`
- `packages/governance/src/presets/{frontend-layered/profile,registry,shared/profile-defaults}.ts`
- `packages/governance/src/profile/{load-profile-overrides,load-standalone-profile,runtime-profile}.ts`
- `packages/governance/src/reporting/{canonical-rendering-model,metric-breakdown,render-cli,render-json,render-management-report,signal-breakdown,top-issues}.ts`

### Import surface assessment

- Good: `packages/governance/src/boundaries/governance-boundaries.spec.ts`,
  `packages/governance-adapter-nx/src/adapter-boundaries.spec.ts`, and
  `packages/governance-extension-nx/src/lib/boundaries.spec.ts` already guard
  against deep Community imports and direct source-path imports from
  `anarchitecture-community`.
- Good: the active host runtime in
  `packages/governance/src/plugin/compose-governance-runtime.ts` imports only
  published `@anarchitects/governance-core` and
  `@anarchitects/governance-adapter-nx` roots.
- Watch item: `packages/governance/src/index.ts` and
  `packages/governance/src/nx-adapter/*` preserve legacy compatibility shims.
  They do not reimplement Community logic, but they keep old package-surface
  expectations alive and must be revalidated after the dependency bump.
- Boundary leak: `packages/governance/src/profile/load-standalone-profile.ts`
  is a dormant local standalone-profile validator inside the Nx host package.
  It duplicates Community CLI-owned profile validation behavior even though the
  active host runtime does not need it.

## Ownership findings

### Old ownership behavior still assumed

- `packages/governance-adapter-nx/src/to-governance-workspace-adapter-result.ts`
  still treats `project.metadata.ownership` plus CODEOWNERS output as the
  plugin-side source of canonical ownership. That logic needs revalidation
  against Community `#343` so the adapter only emits the ownership shape
  expected by Community contracts.
- `packages/governance-extension-nx/src/lib/governance-extension-nx.ts`
  treats a missing `node.ownership` as an Nx-owned rule outcome and emits a
  recommendation that explicitly names CODEOWNERS.
- `packages/governance/src/graph-document/derive-governance-graph-status.ts`
  still distinguishes between "no ownership metadata or CODEOWNERS mapping" and
  "required ownership metadata is missing", which is older plugin-owned wording
  rather than Community-owned capability/context-aware wording.

### Removed `ownership.metadataField` contract still embedded

The removed Community `ownership.metadataField` contract is still assumed in
plugin-side profiles, defaults, fixtures, tests, and docs:

- `tools/governance/profiles/frontend-layered.json`
- `packages/governance/src/presets/shared/profile-defaults.ts`
- `packages/governance/src/profile/load-standalone-profile.ts`
- `packages/governance/src/profile/fixtures/standalone-profile.json`
- `docs/governance/standalone-profile-compatibility.md`
- `docs/governance/standalone-cli-usage.md`
- tests under `packages/governance/src/profile/*.spec.ts`,
  `packages/governance/src/plugin/compose-governance-runtime.spec.ts`,
  `packages/governance/src/extensions/runtime.spec.ts`,
  `packages/governance/src/generators/eslint-integration/generator.spec.ts`,
  `packages/governance/src/presets/registry.spec.ts`, and
  `packages/governance-extension-nx/src/lib/governance-extension-nx.spec.ts`

## Diagnostics and message findings

Ownership-gap wording is still pinned to old plugin assumptions instead of the
Community `#347` capability/context-aware diagnostics:

- `packages/governance-extension-nx/src/lib/governance-extension-nx.ts`
  emits:
  - `Nx node "<id>" is missing canonical ownership.`
  - `Add CODEOWNERS coverage or ownership metadata for node "<id>".`
- `packages/governance/src/graph-document/derive-governance-graph-status.ts`
  emits:
  - `No ownership metadata or CODEOWNERS mapping was found.`
  - `Required ownership metadata is missing.`
- Message snapshots that will need to move with the Community wording live in:
  - `packages/governance-extension-nx/src/lib/governance-extension-nx.spec.ts`
  - `packages/governance/src/graph-document/derive-governance-graph-status.spec.ts`
  - `packages/governance/src/executors/governance-graph/viewer.spec.ts`
  - `packages/governance/src/reporting/rendering.spec.ts`

## Hotspot and attribution findings

- No production plugin code was found that branches on the old
  missing-domain-context attribution shape. Host reporting mostly delegates to
  Community output:
  - `packages/governance/src/reporting/top-issues.ts` re-exports the Core
    helper directly.
  - `packages/governance/src/reporting/signal-breakdown.ts` re-exports the Core
    helper directly.
  - `packages/governance/src/reporting/render-cli.ts` reads generic
    `assessment.health.hotspots` and generic canonical references.
- The remaining risk is in fixture and viewer expectations, not in active
  aggregation logic. Examples that hard-code `missing-domain-context` fixtures
  live in:
  - `packages/governance/src/graph-document/build-governance-graph-document.spec.ts`
  - `packages/governance/src/executors/governance-graph/viewer.spec.ts`
  - `packages/governance/src/reporting/signal-breakdown.spec.ts`

These should be revalidated after the Community bump because `#344` changed the
upstream attribution behavior.

## TypeScript discovery findings

- No active runtime package in this repository directly depends on
  `@anarchitects/governance-adapter-typescript`.
- `packages/governance/src/extensions/config.spec.ts`,
  `packages/governance/src/nx-host/extensions/host.spec.ts`, and
  `packages/governance/src/generators/add-extension/generator.spec.ts` still
  use `@anarchitects/governance-extension-typescript` as an external example
  package name. That is fine as a host-level extension-loading example, but it
  should be revalidated against the current published extension package version.
- `docs/governance/typescript-adapter-usage.md` still contains older contract
  assumptions that need review for Community `#349`:
  - it describes adapter output as canonical data suitable for
    `GovernanceWorkspace.dependencies`, while the current canonical model uses
    `relations`
  - it documents tag-driven projection into `scope`, `domain`, and `layer`,
    which must be checked against the current published projection contract

## Metadata applicability findings

- No production plugin-side code was found that explicitly reintroduces
  missing-domain or missing-layer findings for infrastructure-like nodes.
  Current behavior is delegated to Community rule evaluation.
- The remaining risk is documentation and fixtures that still describe the rules
  generically without the Community `#352` applicability caveat:
  - `docs/governance/nx-rule-migration.md`
  - `docs/governance/governance-core-contracts.md`
  - standalone profile examples and tests that still enable `missing-domain`
    without scoping commentary

This means `#457` is primarily a revalidation and documentation issue unless
the dependency bump reveals a runtime mismatch.

## Boundary and configuration layering findings

### Clean boundaries already in place

- Active runtime imports are already constrained to published Community package
  roots.
- Boundary tests already fail on deep `@anarchitects/governance-core/*` imports,
  direct `@anarchitects/governance-cli` imports, direct
  `@anarchitects/governance-adapter-typescript` imports, and direct Community
  source-path imports.
- `packages/governance-adapter-nx` does not runtime-import concrete extension
  implementation packages, which is aligned with Community `#371`.

### Remaining layering leaks

- `packages/governance/src/profile/runtime-profile.ts` and
  `packages/governance/src/profile/load-profile-overrides.ts` still define a
  mixed profile file contract that combines canonical Governance policy data
  with Nx host/runtime concerns such as:
  - `composition`
  - `exceptions`
  - `eslint.helperPath`
  - `nodeOverrides`
- `tools/governance/profiles/frontend-layered.json` is still an Nx runtime
  override document, not a clean canonical Community profile document.
- `packages/governance/src/nx-host/extensions/config.ts` merges extension
  registration from both `profileComposition` and `nx.json.governance`, which
  means extension package activation is still partially encoded in profile files
  rather than staying purely in host configuration.
- `packages/governance/src/profile/load-standalone-profile.ts` keeps
  standalone-CLI-oriented validation logic inside the Nx host package even
  though Community CLI owns that contract.

## Docs and examples findings

Highest-value stale docs/examples:

- `docs/governance/canonical-graph-model.md`
- `docs/governance/canonical-graph-epic-release-gate.md`
- `docs/governance/nx-governance-ownership-audit.md`
- `docs/governance/standalone-profile-compatibility.md`
- `docs/governance/standalone-cli-usage.md`
- `docs/governance/typescript-adapter-usage.md`

Main issues across those docs:

- stale Community version numbers
- obsolete `ownership.metadataField` examples
- old standalone-profile ownership contract wording
- TypeScript adapter wording that predates the current canonical `relations`
  model and the newer projection contract
- profile examples that still mix host/runtime concerns with canonical profile
  concerns

## Follow-up implementation plan

- [ ] `#453` dependency bump and API consumption alignment
  - Bump `@anarchitects/governance-core` from `0.2.0` to `0.4.1` in the three
    plugin package manifests and `yarn.lock`.
  - Refresh version guards and versioned docs:
    `packages/governance/src/compatibility/canonical-graph-release-gate.spec.ts`,
    `docs/governance/canonical-graph-model.md`,
    `docs/governance/canonical-graph-epic-release-gate.md`,
    `docs/governance/nx-governance-ownership-audit.md`.
  - Revalidate the compatibility shell and host runtime against the latest
    published Core API surface.
- [ ] `#454` canonical ownership handling
  - Remove or replace plugin-side assumptions around
    `ownership.metadataField`.
  - Revalidate `packages/governance-adapter-nx/src/to-governance-workspace-adapter-result.ts`
    against Community canonical ownership semantics.
  - Keep CODEOWNERS extraction adapter-local, but keep canonical ownership
    semantics Community-owned.
- [ ] `#455` capability/context-aware diagnostic messaging
  - Update ownership-gap wording in
    `packages/governance-extension-nx/src/lib/governance-extension-nx.ts`.
  - Update ownership status wording in
    `packages/governance/src/graph-document/derive-governance-graph-status.ts`.
  - Update affected renderer/viewer/test snapshots.
- [ ] `#456` TypeScript discovery projection consumption
  - Revalidate `docs/governance/typescript-adapter-usage.md` against the
    published TypeScript adapter output contract after Community `#349`.
  - Recheck extension-host examples that name
    `@anarchitects/governance-extension-typescript`.
- [ ] `#457` metadata rule applicability
  - Revalidate docs and fixtures that discuss `missing-domain`,
    `missing-layer`, and `missing-domain-context`.
  - Confirm the plugins host does not reintroduce infrastructure-node findings
    after the Core bump.
- [ ] `#458` Community `#357` and `#371` boundary alignment
  - Reduce or remove plugin-side standalone profile validation from
    `@anarchitects/nx-governance`.
  - Separate canonical Community profile configuration from Nx host/runtime
    configuration more explicitly.
  - Review whether profile-driven extension activation should continue to exist
    alongside `nx.json.governance`.
- [ ] `#459` docs and examples alignment
  - Update stale versions, stale ownership examples, TypeScript adapter docs,
    and profile-layering examples in the docs listed above.

## New issues

No new follow-up issue is required from this audit. The concrete findings fit
within `#453` through `#459`, with the dormant standalone-profile loader and the
mixed profile/config layering concerns belonging under `#458`.
