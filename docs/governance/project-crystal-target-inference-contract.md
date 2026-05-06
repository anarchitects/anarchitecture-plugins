# Project Crystal target inference contract

## Purpose

This document defines the **implementation contract** for inferring Nx
Governance targets from governance profile/configuration files in Project
Crystal work for epic #181.

Its role is to make #206 directly implementable while preserving the current
governance runtime model and backward compatibility surface documented in
[configuration-surface-audit.md](./configuration-surface-audit.md).
User-facing usage examples live in
[../../packages/governance/README.md#project-crystal-inference](../../packages/governance/README.md#project-crystal-inference).

## Non-goals

This issue does **not** do any of the following:

- no runtime behavior changes
- no `createNodesV2` source implementation
- no cleanup of generated root targets
- no removal of explicit target support
- no Angular-specific governance intelligence
- no Nx Graph UI integration
- no Nx Console integration
- no Nx Cloud integration

## Reference Project Crystal pattern

Project Crystal inference follows a standard Nx plugin pattern:

- a plugin exports `createNodesV2`
- `createNodesV2` declares a glob for authoritative config files
- Nx passes matching files to the plugin
- the plugin converts those files into inferred targets on a project
- inferred target names are deterministic
- inferred inputs and outputs are deterministic
- explicit targets remain available for compatibility and overrides

Minimal conceptual shape:

```ts
export const createNodesV2 = [
  'path/to/config/files/*.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      createNodesFromConfigFile,
      configFiles,
      options,
      context
    );
  },
];
```

For Nx Governance, `packages/governance/src/plugin/index.ts` now implements
`createNodesV2` for the four core report targets. This contract remains the
authoritative definition of what the inferred targets should look like and how
they must coexist with explicit workspace-owned targets.

Current implementation shape:

```ts
export const createNodesV2 = [
  'tools/governance/profiles/*.json',
  async (profileFiles, options, context) =>
    createNodesFromFiles(
      createGovernanceNodesFromProfile,
      profileFiles,
      options,
      context
    ),
];
```

## Authoritative inference source

Authoritative inference source for MVP:

- `tools/governance/profiles/*.json`

Decision:

- inference is triggered by the presence of one or more files matching
  `tools/governance/profiles/*.json`
- profile file **existence and filename** are sufficient for target inference
- the inference layer should not require parsing profile JSON to decide whether
  core targets exist

Rationale:

- current plugin index already watches `tools/governance/profiles/*.json`
- current runtime profile model is rooted in `tools/governance/profiles/`
- avoiding JSON parsing in inference keeps startup deterministic and thin
- malformed JSON is better surfaced by the existing runtime profile loader when
  an inferred target is executed

Additional files that do **not** participate in target existence inference for
MVP:

- `nx.json`
- `package.json > nx.targets`
- `tools/governance/eslint/dependency-constraints.mjs`
- conformance output files
- snapshot or AI artifact files

Future considerations:

- plugin options in `nx.json`
- explicit `profilePath`-style config files outside `tools/governance/profiles/`
- dedicated graph config, if one is introduced later

## Project attachment model

Decision:

- inferred governance targets attach to the **root project `.`**

Contract shape:

```ts
projects: {
  '.': {
    targets: {
      'repo-health': {},
      'repo-boundaries': {},
      'repo-ownership': {},
      'repo-architecture': {},
    },
  },
}
```

`governance-graph` is not inferred by default in this contract and therefore is
not included in the default inferred set below.

Rationale:

- current explicit governance targets are root-oriented
- init writes governance targets to `package.json > nx.targets`
- current docs and CI examples use root-style invocations such as
  `nx repo-health`
- attaching to `.` minimizes migration risk and avoids inventing a synthetic
  project identity that users do not currently configure against

Rejected for MVP:

- synthetic governance project
- hybrid root + synthetic project split

## Inferred target set

Decision:

- infer the four core governance report targets by default
- do **not** infer `governance-graph` in MVP

| Target              | Inferred by default? | Source profile                      | Executor                                        | Default options                                   | Default output path                                      | Inputs                                                                    | Outputs                                                                                 | Notes                                                  |
| ------------------- | -------------------: | ----------------------------------- | ----------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `repo-health`       |                  yes | workspace default profile selection | `@anarchitects/nx-governance:repo-health`       | `{ profile, output: "cli" }`                      | none                                                     | `default`, `{workspaceRoot}/tools/governance/**/*`, selected profile file | none                                                                                    | `conformanceJson` remains an explicit runtime override |
| `repo-boundaries`   |                  yes | workspace default profile selection | `@anarchitects/nx-governance:repo-boundaries`   | `{ profile, output: "cli" }`                      | none                                                     | `default`, `{workspaceRoot}/tools/governance/**/*`, selected profile file | none                                                                                    | same runtime option surface as explicit target         |
| `repo-ownership`    |                  yes | workspace default profile selection | `@anarchitects/nx-governance:repo-ownership`    | `{ profile, output: "cli" }`                      | none                                                     | `default`, `{workspaceRoot}/tools/governance/**/*`, selected profile file | none                                                                                    | same runtime option surface as explicit target         |
| `repo-architecture` |                  yes | workspace default profile selection | `@anarchitects/nx-governance:repo-architecture` | `{ profile, output: "cli" }`                      | none                                                     | `default`, `{workspaceRoot}/tools/governance/**/*`, selected profile file | none                                                                                    | same runtime option surface as explicit target         |
| `governance-graph`  |                   no | n/a in MVP                          | `@anarchitects/nx-governance:governance-graph`  | current explicit target defaults remain supported | `dist/governance/graph.html` when explicit target exists | n/a for inference MVP                                                     | `dist/governance/graph.html` or `dist/governance/graph.json` when explicitly configured | stays explicit-only for now                            |

Notes:

- “Default output path” is `none` for the four report targets because current
  executors render CLI or JSON to stdout rather than producing a file artifact
- the inferred contract intentionally mirrors existing executor defaults rather
  than inventing new output locations

## Target naming rules

Decision:

- inferred governance targets use the existing stable target names directly
- target names are **not** derived from individual profile filenames in MVP

Deterministic naming priority:

1. use the existing stable target names
   - `repo-health`
   - `repo-boundaries`
   - `repo-ownership`
   - `repo-architecture`
2. ignore profile-internal `kind`, `type`, or equivalent fields for target
   naming in MVP
3. do not derive new target names from profile filenames
4. do not introduce fallback target names for unknown/future profile files

Examples:

- `tools/governance/profiles/frontend-layered.json`
  - contributes to default profile selection
  - does **not** rename inferred targets
  - inferred targets remain `repo-health`, `repo-boundaries`,
    `repo-ownership`, and `repo-architecture`
- `tools/governance/profiles/backend-layered-3tier.json`
  - also contributes only to default profile selection
- if both files exist, target names still remain the same four stable names

Non-contract examples:

- `tools/governance/profiles/repo-health.json -> repo-health`
- `tools/governance/profiles/repo-boundaries.json -> repo-boundaries`

Those filename-to-target mappings are **not** part of the MVP contract because
the current governance profile model is architecture/profile oriented, not
report-type oriented.

## Default profile selection

Decision:

- inferred core targets share one deterministic **workspace default profile**
- explicit runtime profile override always wins

Contract:

1. One profile exists.
   - use that profile basename as the inferred `profile` option.
2. Multiple profiles exist.
   - if `frontend-layered.json` exists, use `frontend-layered`
   - otherwise choose the lexical-first profile basename
3. A target maps to a known profile name.
   - not applicable in MVP because target names are not profile-derived
4. No matching profile exists.
   - no governance targets are inferred
5. User provides explicit profile via target options.
   - explicit target options win when an explicit target exists
6. User provides explicit profile via CLI override.
   - existing executor behavior remains supported, for example:
     `nx repo-health --profile=other-profile`

Current usage note:

- users normally continue to run the inferred root targets directly, for
  example `nx repo-health`
- if a workspace prefers explicit root-project addressing, the target can also
  be invoked through the root project name, for example
  `nx run <root-project-name>:repo-health`

Rationale:

- this follows the current `INFERENCE_REQUIREMENTS.md` recommendation
- it preserves `frontend-layered` as the current default where present
- it avoids silently choosing an arbitrary profile when multiple files exist

## Explicit target compatibility

Decision:

- explicit configured targets take precedence over inferred targets with the
  same name

Compatibility contract:

- if a root or project target named `repo-health`, `repo-boundaries`,
  `repo-ownership`, or `repo-architecture` is already explicitly configured,
  the explicit target remains authoritative after Nx merges inferred and
  explicit configuration
- inferred targets must not override explicit `executor`, `options`,
  `metadata`, `inputs`, or `outputs`
- explicit targets may continue to use custom `profile`, `conformanceJson`, or
  other supported executor options
- explicit `governance-graph` targets remain fully supported, including custom
  `format` and `outputPath`, because `governance-graph` is not inferred in MVP
- inference must not emit a migration-breaking error for duplicates

Warning behavior:

- no warning is required for MVP
- duplicate explicit-vs-inferred names are expected compatibility behavior

Opt-out:

- no dedicated opt-out plugin option is required for MVP
- users can continue to rely on explicit targets where they need custom wiring

## `governance-graph` decision

Decision:

- keep `governance-graph` **explicit-only** for now

Rationale:

- current audit shows a stable explicit target convention for
  `governance-graph`
- current init writes `governance-graph` explicitly in the minimal target
  preset
- `governance-graph` has distinct file-output behavior not shared by the core
  report targets
- there is no stable existing profile-to-graph mapping convention in the repo
- keeping it explicit-only is the safest conservative contract for #206

What remains supported:

- explicit root target name `governance-graph`
- executor `@anarchitects/nx-governance:governance-graph`
- current explicit defaults:
  - `format: "html"`
  - `outputPath: "dist/governance/graph.html"`

## Plugin options contract

Decision:

- keep the MVP plugin options contract minimal
- do not add target-name customization options
- do not add graph inference options in MVP because graph inference is out of
  scope for the contract

Intended plugin options interface for #206:

```ts
export interface GovernancePluginOptions {
  profileGlob?: string;
}
```

| Option        | Type     | Default                            | Purpose                                                                                |
| ------------- | -------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `profileGlob` | `string` | `tools/governance/profiles/*.json` | Advanced override for the authoritative profile discovery glob used by `createNodesV2` |

Explicitly not included in MVP:

- target-name overrides
- default profile override option in `nx.json`
- `inferGraphTarget`
- synthetic project naming options

Rationale:

- stable target names are already part of the current compatibility surface
- extra configurability would make the first implementation harder to reason
  about and test

## Cache/input/output contract

Decision:

- inferred targets should use deterministic inputs rooted in the governance
  configuration surface
- inferred core report targets should declare **no file outputs** by default

Core inferred target input contract:

```ts
inputs: [
  'default',
  '{workspaceRoot}/tools/governance/**/*',
  '{workspaceRoot}/nx.json',
];
```

Profile-specific note:

- the selected default profile file is already covered by
  `{workspaceRoot}/tools/governance/**/*`
- this keeps the contract simple and aligned with the current profile/config
  surface

Core inferred target output contract:

```ts
outputs: [];
```

Rationale:

- current core report executors emit CLI or JSON to stdout
- they do not currently write a deterministic report file artifact by default
- inventing output paths here would change the behavioral contract rather than
  document it

Explicit-only graph output contract retained for compatibility:

- `governance-graph` explicit target:
  - `dist/governance/graph.html` by default
  - `dist/governance/graph.json` when `format=json`

## Error and edge-case behavior

Contract:

- no profiles found
  - infer no governance targets
- malformed profile JSON
  - inference still uses file existence only
  - malformed JSON fails when the target executes through the existing runtime
    profile loader, with the file path named in the error
- unknown profile name
  - if the file exists, it can still become the selected default profile by
    filename
  - runtime success still depends on the existing profile loader and profile
    content
- duplicate profile-to-target mapping
  - not applicable in MVP because target names are fixed and not derived
    per-profile
- same target defined explicitly and inferred
  - explicit target wins
  - inferred duplicate is skipped
- missing output path
  - not applicable to inferred core report targets because they have no default
    file outputs
- unsupported `governance-graph` inference
  - `governance-graph` is not inferred in MVP, so no fallback inference path is
    needed

## Implementation handoff for #206

Likely files to modify:

- `packages/governance/src/plugin/index.ts`
- potentially a small helper module under `packages/governance/src/plugin/`
  for profile selection and target construction
- tests near plugin inference behavior once added

Exact authoritative glob:

```ts
'tools/governance/profiles/*.json';
```

Expected `createNodesV2` shape:

```ts
export const createNodesV2: CreateNodesV2<GovernancePluginOptions> = [
  'tools/governance/profiles/*.json',
  async (profileFiles, options, context) =>
    createNodesFromFiles(
      createGovernanceNodesFromProfile,
      profileFiles,
      options,
      context
    ),
];
```

Target mapping contract for #206:

- if `profileFiles.length === 0`, return no inferred governance targets
- otherwise infer root-project `.` targets:
  - `repo-health`
  - `repo-boundaries`
  - `repo-ownership`
  - `repo-architecture`
- do not infer `governance-graph`
- use selected default profile:
  - `frontend-layered` if present
  - else lexical-first basename

Minimal plugin options interface for #206:

```ts
export interface GovernancePluginOptions {
  profileGlob?: string;
}
```

Compatibility rule for #206:

- explicit target wins over inferred target with the same name

Edge cases to test in #208:

- zero profile files -> no inferred targets
- one profile file -> inferred targets use that basename as `profile`
- multiple profile files with `frontend-layered` present -> default profile is
  `frontend-layered`
- multiple profile files without `frontend-layered` -> lexical-first profile is
  selected
- explicit target with same name -> explicit target remains authoritative
- malformed profile JSON -> inferred target exists, execution fails with a clear
  runtime error naming the file
- `governance-graph` remains uninferred
