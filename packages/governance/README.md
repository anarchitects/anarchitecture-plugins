# @anarchitects/nx-governance

An Nx plugin that turns your workspace's own project graph into an **auditable, scored, and actionable governance report**. It evaluates architectural boundaries, team ownership, documentation coverage, and dependency health — and surfaces everything as structured CLI output or machine-readable JSON that can gate CI pipelines.

---

## Why governance-as-code?

Large Nx monorepos accumulate structural debt silently: cross-domain imports slip in, projects lose clear owners, layer contracts erode over time. Traditional linting catches individual file violations but cannot reason about **workspace-level architecture intent** — which teams own which domains, which layers may depend on which, or whether the overall dependency topology is growing in complexity.

`@anarchitects/nx-governance` introduces a **governance profile** — a single JSON file that declares architectural intent — and evaluates the entire workspace against it on every run. The result is a graded health score with per-metric breakdown, actionable violation details, and prioritized recommendations.

---

## Table of contents

- [Installation](#installation)
- [Supported Nx versions](#supported-nx-versions)
- [Quick start](#quick-start)
- [Extension model](#extension-model)
- [Concepts](#concepts)
  - [Profiles](#profiles)
  - [Boundary policy source](#boundary-policy-source)
  - [Exceptions](#exceptions)
  - [Domain tags](#domain-tags)
  - [Layer tags](#layer-tags)
  - [Ownership signals](#ownership-signals)
  - [Documentation signals](#documentation-signals)
- [Generators](#generators)
  - [init](#init-generator)
  - [eslint-integration](#eslint-integration-generator)
- [Executors](#executors)
  - [workspace-graph](#workspace-graph)
  - [repo-health](#repo-health)
  - [repo-boundaries](#repo-boundaries)
  - [repo-ownership](#repo-ownership)
  - [repo-architecture](#repo-architecture)
  - [repo-snapshot](#repo-snapshot)
  - [repo-drift](#repo-drift)
  - [governance-graph](#governance-graph)
  - [repo-ai-root-cause](#repo-ai-root-cause)
  - [repo-ai-drift](#repo-ai-drift)
  - [repo-ai-pr-impact](#repo-ai-pr-impact)
  - [repo-ai-cognitive-load](#repo-ai-cognitive-load)
  - [repo-ai-recommendations](#repo-ai-recommendations)
  - [repo-ai-smell-clusters](#repo-ai-smell-clusters)
  - [repo-ai-refactoring-suggestions](#repo-ai-refactoring-suggestions)
  - [repo-ai-scorecard](#repo-ai-scorecard)
  - [repo-ai-onboarding](#repo-ai-onboarding)
- [Reports explained](#reports-explained)
  - [Health score, status, and grade](#health-score-status-and-grade)
  - [Metrics](#metrics)
  - [Violations](#violations)
  - [Recommendations](#recommendations)
  - [Warnings](#warnings)
  - [JSON output schema](#json-output-schema)
- [Profile reference](#profile-reference)
- [ESLint alignment](#eslint-alignment)
- [CI integration](#ci-integration)

---

## Installation

Use `nx add` — the standard Nx way to adopt a plugin. It installs the package and automatically runs the plugin's `init` generator in one step:

```bash
nx add @anarchitects/nx-governance
```

This is equivalent to installing the package and then running `nx g @anarchitects/nx-governance:init`, but without the manual steps. You will be prompted whether to also configure the ESLint integration (recommended).

If you need to re-run the init generator later (e.g. to add the ESLint integration to an existing install):

```bash
nx g @anarchitects/nx-governance:init
```

---

## Supported Nx versions

This plugin supports Nx versions `>=19 <23`.

The minimum is driven by the plugin's use of Project Crystal inferred targets. The upper bound is intentionally capped to avoid claiming compatibility with future major Nx releases before validation.

For package consumers, the compatibility contract is declared in `peerDependencies` in `packages/governance/package.json`.

---

## Quick start

```bash
# 1. Install the plugin and scaffold governance configuration
nx add @anarchitects/nx-governance

# 2. Tag each project with its domain and layer (see Domain tags below)
#    Add to each package.json > nx.tags:
#    ["type:plugin", "domain:billing", "layer:feature"]

# 3. Print a baseline graph summary (diagnostic foundation command)
nx workspace-graph

# 4. Run the full workspace health check
nx repo-health

# 5. Drill into specific concerns
nx repo-boundaries
nx repo-ownership
nx repo-architecture

# 6. Generate the governance graph viewer
nx governance-graph
nx governance-graph --format=json --outputPath=dist/governance/graph.json
```

---

## Extension model

`@anarchitects/nx-governance` is the shared governance core for Nx workspaces.

The core package owns:

- governance orchestration
- shared governance models
- scoring and health aggregation
- CLI and JSON reporting
- extension discovery and lifecycle

Ecosystem-specific intelligence can be added through separate Nx plugins. Those plugins contribute enrichers, rule packs, signals, and metrics into the core pipeline instead of creating their own governance model.

The first reference engine is Angular, positioned as a separate plugin:

- `@anarchitects/nx-governance-angular`

That keeps framework-specific behavior out of the core package and establishes the model for future engines such as TypeScript, React, Maven, Gradle, and .NET.

If you are building an ecosystem plugin, see [EXTENSIONS.md](./EXTENSIONS.md).

---

## Concepts

### Profiles

A **governance profile** is a JSON file at `tools/governance/profiles/<name>.json`. It is the single source of truth for what the workspace architecture _should_ look like. Every run of any governance executor reads this file and evaluates the live project graph against it.

The built-in presets are:

- `frontend-layered` for the current UI-leaning Nx layered taxonomy
- `backend-layered-3tier` for a three-tier backend taxonomy
- `backend-layered-ddd` for a DDD-oriented backend taxonomy

`layered-workspace` remains accepted as a compatibility alias for the earlier
rename, but `frontend-layered` is the primary name going forward. You can
adjust every aspect of these profiles by editing the JSON file — no TypeScript
required.

For the current responsibility split between profiles, presets, executor
options, and init wiring, see
[`docs/governance/configuration-model.md`](../../docs/governance/configuration-model.md).

### Boundary policy source

Every profile has a `boundaryPolicySource` setting:

| Value       | Behaviour                                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"profile"` | The `allowedDomainDependencies` map in the profile JSON is the authoritative rule set.                                                                                                                                                                      |
| `"eslint"`  | The runtime helper `tools/governance/eslint/dependency-constraints.mjs` is loaded at assessment time and its merged constraints are used as the primary rule set. The profile map acts as a fallback/override layer. A warning is surfaced in every report. |

Use `"eslint"` when you want ESLint's `@nx/enforce-module-boundaries` and the governance report to share a single source of truth, eliminating drift between the two enforcement layers.

### Exceptions

Profiles can declare explicit governance exceptions in the same
`tools/governance/profiles/<name>.json` file used for the rest of the
workspace policy.

Use exceptions when a known deviation must remain visible and reviewable
instead of being hidden inside generic overrides.

```jsonc
{
  "exceptions": [
    {
      "id": "orders-shared-transition",
      "source": "policy",
      "scope": {
        "source": "policy",
        "ruleId": "domain-boundary",
        "projectId": "orders-app",
        "targetProjectId": "shared-util"
      },
      "reason": "Temporary migration path during extraction.",
      "owner": "@org/architecture",
      "review": {
        "reviewBy": "2026-06-01"
      }
    },
    {
      "id": "nx-owner-warning-review",
      "source": "conformance",
      "scope": {
        "source": "conformance",
        "ruleId": "@nx/conformance/ensure-owners",
        "projectId": "orders-app"
      },
      "reason": "Ownership handoff in progress.",
      "owner": "@org/architecture",
      "review": {
        "expiresAt": "2026-07-01"
      }
    }
  ]
}
```

Practical fields:

- `id`: stable identifier used in reports
- `source`: `policy` or `conformance`
- `scope`: exact finding scope to match
- `reason`: why the deviation is tolerated for now
- `owner`: who is accountable for review/removal
- `review.reviewBy` / `review.expiresAt`: the lifecycle boundary for the exception

Runtime semantics:

- `active` exceptions suppress matching findings
- `stale` exceptions no longer suppress; their matched findings become active governance debt again
- `expired` exceptions no longer suppress; their matched findings also become active governance debt again

Exception-backed findings stay explainable in reports through
`assessment.exceptions` instead of being silently dropped.

### Domain tags

Domains represent bounded business or technical areas. Tag each project in its `package.json`:

```json
{
  "nx": {
    "tags": ["type:plugin", "domain:billing"]
  }
}
```

Equivalent `project.json` configuration is also supported:

```json
{
  "name": "billing-api",
  "tags": ["type:plugin", "domain:billing"]
}
```

The governance engine extracts the value after `domain:` and uses it to evaluate cross-domain dependency rules. Projects without a domain tag are not evaluated for domain-boundary violations — they participate in ownership and documentation checks only.

### Layer tags

Layers represent architectural tiers within a domain (e.g. Angular-style: `app → feature → ui → data-access → util`). Tag projects:

```json
{
  "nx": {
    "tags": ["domain:billing", "layer:feature"]
  }
}
```

Equivalent `project.json` configuration is also supported:

```json
{
  "name": "billing-feature",
  "tags": ["domain:billing", "layer:feature"]
}
```

The profile defines the ordered list of layers. A dependency from a project at position `i` to one at position `j < i` (i.e. a lower-index, higher-level layer) is flagged as a `layer-boundary` violation.

### Ownership signals

The plugin resolves ownership from two complementary sources and **merges** them:

1. **Project metadata** — the `nx.metadata.ownership.team` field in a project's `package.json`:

   ```json
   { "nx": { "metadata": { "ownership": { "team": "@org/platform" } } } }
   ```

   The same ownership metadata can also live in `project.json`:

   ```json
   {
     "name": "platform-core",
     "metadata": {
       "ownership": {
         "team": "@org/platform"
       }
     }
   }
   ```

2. **CODEOWNERS** — `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS` at the workspace root. The plugin parses this file and matches project roots against patterns using full glob semantics (anchored paths, wildcards, double-star). The _last matching rule_ wins, consistent with how GitHub evaluates CODEOWNERS.

When both sources provide information the ownership record is tagged `source: "merged"`. When only one is present the source is `"project-metadata"` or `"codeowners"` respectively. Projects with no ownership signal are tagged `source: "none"` and a violation is raised when `ownership.required: true` in the profile.

### Documentation signals

Documentation completeness is resolved from three places in priority order:

1. `projectOverrides.<projectName>.documentation` in the profile JSON — useful for projects that carry documentation in non-standard locations.
2. `metadata.documentation` in `project.json` or `nx.metadata.documentation` in `package.json`.
3. Absense of either results in `documentation: false` for that project.

---

## Generators

### `init` generator

Scaffolds governance configuration into any Nx workspace and registers a minimal default governance target surface.

```bash
nx g @anarchitects/nx-governance:init
```

**What it does:**

- Registers `@anarchitects/nx-governance` in `nx.json` plugins.
- Writes a minimal default root target set into `package.json > nx.targets`:
  - `repo-health`
- Writes the previous broad governance target surface only when `targetPreset: "full"` is selected.
- `targetPreset: "full"` includes drilldowns, snapshot/drift workflows, diagnostics, `governance-graph`, and AI helper targets.
- Creates only the selected starter profile file when it is missing:
  - default preset/profile: `frontend-layered`
  - backend starter presets: `backend-layered-3tier` and `backend-layered-ddd`
  - `layered-workspace` remains accepted as a compatibility alias for the frontend starter profile
- `backend-layered-3tier` and `backend-layered-ddd` are mutually exclusive because init selects a single starter preset.
- Optionally runs the `eslint-integration` generator (prompted, default: yes).

All governance executors remain available even when init writes the minimal target set. Project Crystal target inference is future work and is not implemented here. `governance-graph` remains part of the full target preset; issue #189 still owns the long-term default-target decision.

**Options:**

| Option                 | Type      | Default                                                | Description                                                                                                                                                                                                                                                                                |
| ---------------------- | --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configureEslint`      | `boolean` | `true`                                                 | Generate the ESLint integration helper and wire it into the configured flat ESLint config.                                                                                                                                                                                                 |
| `eslintConfigPath`     | `string`  | autodetect                                             | Explicit flat ESLint config file to patch when `configureEslint` is enabled. When omitted, Nx Governance checks `eslint.config.mjs`, then `eslint.config.cjs`, then `eslint.config.js`.                                                                                                    |
| `governanceHelperPath` | `string`  | `"tools/governance/eslint/dependency-constraints.mjs"` | Path where the generated depConstraints helper module should be written.                                                                                                                                                                                                                   |
| `preset`               | `string`  | `"frontend-layered"`                                   | Built-in starter preset used when init seeds a missing governance profile. Supported values are `frontend-layered`, `backend-layered-3tier`, and `backend-layered-ddd`. Backend layered 3-tier and backend layered DDD are mutually exclusive because this option selects a single preset. |
| `profile`              | `string`  | selected preset name                                   | Governance profile name wired into generated root targets and used as the default seeded profile filename. Built-in options include `frontend-layered`, `backend-layered-3tier`, and `backend-layered-ddd`. `layered-workspace` remains accepted as a compatibility alias.                 |
| `profilePath`          | `string`  | none                                                   | Governance profile path used directly when migrating inline ESLint depConstraints.                                                                                                                                                                                                         |
| `targetPreset`         | `string`  | `"minimal"`                                            | Controls which root governance targets init writes. Use `"minimal"` for the default `repo-health`-only surface, or `"full"` to restore the broader governance, diagnostic, snapshot/drift, `governance-graph`, and AI target set.                                                          |
| `skipFormat`           | `boolean` | `false`                                                | Skip Prettier formatting of generated files.                                                                                                                                                                                                                                               |

---

### `eslint-integration` generator

Generates the **shared runtime policy module** that prevents drift between ESLint module-boundary enforcement and governance boundary rules.

```bash
nx g @anarchitects/nx-governance:eslint-integration
```

**What it does, in order:**

1. **Migrates** any existing inline `depConstraints` array from the configured flat ESLint config into the selected governance profile file. When no explicit config path is provided, Nx Governance autodetects `eslint.config.mjs`, then `eslint.config.cjs`, then `eslint.config.js`.
2. **Writes** the governance depConstraints helper. By default this is `tools/governance/eslint/dependency-constraints.mjs`.
3. **Patches** the configured flat ESLint config to import `governanceDepConstraints` from that helper using the correct relative module path.

After running this generator, adding or changing domain dependency rules in a profile JSON automatically updates both governance reports _and_ ESLint enforcement on the next run — with no manual synchronisation required.

**Options:**

| Option                 | Type      | Default                                                | Description                                                                                                                                                                                                               |
| ---------------------- | --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslintConfigPath`     | `string`  | autodetect                                             | Explicit flat ESLint config file to patch. When omitted, Nx Governance checks `eslint.config.mjs`, then `eslint.config.cjs`, then `eslint.config.js`.                                                                     |
| `governanceHelperPath` | `string`  | `"tools/governance/eslint/dependency-constraints.mjs"` | Helper module output path.                                                                                                                                                                                                |
| `profile`              | `string`  | `"frontend-layered"`                                   | Profile name resolved under `tools/governance/profiles/`. Built-in options include `frontend-layered`, `backend-layered-3tier`, and `backend-layered-ddd`. `layered-workspace` remains accepted as a compatibility alias. |
| `profilePath`          | `string`  | none                                                   | Profile path used directly for migration.                                                                                                                                                                                 |
| `skipFormat`           | `boolean` | `false`                                                | Skip Prettier formatting of generated files.                                                                                                                                                                              |

This integration currently patches flat ESLint config files only. Legacy `.eslintrc*` support is intentionally out of scope here because it is a different config model with different merge and patch semantics; this cleanup keeps the change bounded to flat config autodetection plus explicit override support.

---

## Executors

### `workspace-graph`

**Intent:** Provide a minimal, diagnostic view of the workspace graph as a foundation for future governance signal integration.

```bash
nx workspace-graph
nx workspace-graph --graphJson=.nx/workspace-data/project-graph.json
```

**Output:**

- `Projects: X`
- `Dependencies: Y`

**Use when:** you need a quick graph baseline check or when validating graph ingestion independently from governance scoring/reporting.

---

### `workspace-conformance`

**Intent:** Provide a minimal, diagnostic summary of Nx Conformance findings from JSON output.

```bash
nx workspace-conformance --conformanceJson=dist/conformance-result.json
```

**Output:**

- `Findings: X`
- `Errors: Y`
- `Warnings: Z`

**Use when:** you need to validate conformance ingestion independently from governance scoring/reporting.

---

### `governance-graph`

**Intent:** Generate a governance-enriched graph artifact that uses the Nx Project Graph as the structural backbone and overlays governance findings, health/status, ownership, documentation, metrics, and filterable facets.

The MVP emits its own Governance Graph document and a static viewer. It does not replace the native Nx Graph UI.

```bash
# Root target added by init when targetPreset is "full"
nx governance-graph

# JSON artifact for CI or debugging
nx governance-graph --format=json --outputPath=dist/governance/graph.json

# HTML viewer artifact
nx governance-graph --format=html --outputPath=dist/governance/graph.html
```

**Output modes:**

- `html` (default): emits a static, self-contained viewer that can be opened directly in a browser.
- `json`: emits the Governance Graph document for CI artifacts, debugging, or future integrations.

**What the Governance Graph contains:**

- nodes and edges derived from the Nx Project Graph
- governance findings attached to nodes and edges where resolution is possible
- node and edge health/status derived from findings and metadata-backed status rules
- ownership and documentation badges
- summary counts and graph facets
- an embedded graph payload that drives the static viewer

**Static viewer MVP behaviour:**

- renders node and edge lists with governance-specific status treatment
- renders ownership and documentation badges
- exposes filters for domain, layer, ownership, documentation, severity, and violation type
- exposes a node inspector with metadata, score, findings, dependencies, and dependents
- keeps all drilldown content traceable to the embedded Governance Graph document

**MVP constraints:**

- no native Nx Graph UI integration yet
- no Nx Console integration yet
- no Nx Cloud graph overlay yet
- no historical trend view
- no cross-snapshot comparison
- no graph editing
- no custom dashboards
- the viewer is static and generated from one graph payload

Native integration with the official Nx Graph UI is intentionally outside the MVP. The MVP uses the Nx Project Graph as input, then emits a governance-enriched graph document and static viewer. Nx Graph UI/Nx Console/Nx Cloud integration can be explored as a roadmap item.

**Use when:** you want an explorable governance overlay without introducing a separate web application runtime.

---

Base options used by governance and AI executors:

| Option            | Type                | Default              | Description                                                                                                                                                                                                            |
| ----------------- | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile`         | `string`            | `"frontend-layered"` | Name of the governance profile to load from `tools/governance/profiles/`. `layered-workspace` remains accepted as a compatibility alias, and backend runs can select `backend-layered-3tier` or `backend-layered-ddd`. |
| `output`          | `"cli"` \| `"json"` | `"cli"`              | Output format. `cli` prints a human-readable report via Nx logger. `json` writes structured JSON to stdout.                                                                                                            |
| `failOnViolation` | `boolean`           | `false`              | Exit with a non-zero code when any violation is found. Use this to gate CI.                                                                                                                                            |
| `conformanceJson` | `string`            | unset                | Optional override for the Nx Conformance JSON path. If omitted, governance will try `nx.json > conformance.outputPath` before continuing without conformance signals.                                                  |

Additional options are listed per command where applicable (`snapshotDir`, `snapshotPath`, `topViolations`, `topProjects`, `baseRef`, `headRef`, ...).

### `repo-health`

**Intent:** Give a full workspace health overview — the "dashboard" view. Every metric is computed and combined into a single weighted score with a health status and compatibility grade.

```bash
nx repo-health
nx repo-health --output=json
nx repo-health --failOnViolation
```

**Metrics included:** all six (Architectural Entropy, Dependency Complexity, Domain Integrity, Ownership Coverage, Documentation Completeness, Layer Integrity).

**Signal breakdown shown:** graph, conformance, and policy source counts, plus per-type and per-severity counts. The CLI report prints deterministic `Signal Sources`, `Signal Types`, and `Signal Severity` sections, and the JSON output includes `signalBreakdown.total`, `signalBreakdown.bySource`, `signalBreakdown.byType`, and `signalBreakdown.bySeverity`.

**Metric and issue breakdown shown:** the CLI also prints `Metric Families`, `Metric Hotspots`, `Project Hotspots`, `Explainability`, and `Top Issues`. The JSON output includes `metricBreakdown.families`, `topIssues`, and structured hotspot/explainability fields under `health`.

**Conformance input resolution:** explicit `--conformanceJson` wins. If it is not provided, governance tries `nx.json > conformance.outputPath`. If neither is available, the report still renders with a `conformance` count of `0`. If `nx.json` declares an output path but the file cannot be read, governance fails with a clear configuration error.

**Use when:** you want a single number that summarises overall workspace quality, or when running a health gate in CI.

---

### `repo-boundaries`

**Intent:** Focus exclusively on structural boundary violations — where the project graph breaks the declared domain and layer contracts.

```bash
nx repo-boundaries
nx repo-boundaries --output=json --failOnViolation
```

**Metrics included:** Architectural Entropy, Domain Integrity, Layer Integrity.

**Signal breakdown shown:** boundary-scoped source, type, and severity counts only.

**Violations surfaced:**

- `domain-boundary` (severity: `error`) — a project in domain A imports a project in domain B, and B is not listed in A's `allowedDomainDependencies`.
- `layer-boundary` (severity: `warning`) — a project at layer position `i` imports a project at a higher-level layer position `j < i`.

**Use when:** doing an architecture review, onboarding a new domain, or validating that a refactor did not introduce forbidden cross-domain imports.

---

### `repo-ownership`

**Intent:** Report which projects lack a clear owner and surface the merged ownership map across metadata and CODEOWNERS.

```bash
nx repo-ownership
nx repo-ownership --output=json
```

**Metrics included:** Ownership Coverage.

**Signal breakdown shown:** ownership-scoped source, type, and severity counts only.

**Violations surfaced:**

- `ownership-presence` (severity: `warning`) — a project has neither an `ownership.team` metadata field nor a matching CODEOWNERS entry.

**Use when:** running an incident post-mortem, onboarding a new team member, or auditing accountability across a growing monorepo.

---

### `repo-architecture`

**Intent:** Report on structural complexity and entropy without the ownership signal — purely the architectural topology health.

```bash
nx repo-architecture
nx repo-architecture --output=json
```

**Metrics included:** Architectural Entropy, Dependency Complexity, Domain Integrity.

**Signal breakdown shown:** all non-ownership source, type, and severity counts.

**Violations surfaced:** all violation types _except_ `ownership-presence`.

**Use when:** you want to track architectural drift over time and are not concerned with team assignment in this particular run.

### Signal Breakdown

When governance reporting is rendered, the assessment always includes a signal breakdown with these views:

- `bySource` with fixed rows in this order:
  - `graph`
  - `conformance`
  - `policy`
- `byType` with observed signal types only, in canonical governance signal order
- `bySeverity` with fixed rows in this order:
  - `info`
  - `warning`
  - `error`

Counts are scoped to the active report type. For example, `repo-boundaries` only counts boundary-category signals, while `repo-architecture` excludes ownership-category signals. If `conformanceJson` is omitted, the `conformance` row is still present with count `0`. Severity rows are always present even when their count is `0`, while type rows are observed-only.

### Metric Families and Top Issues

Governance reporting also publishes:

- `metricBreakdown.families` with deterministic family ordering: `architecture`, `boundaries`, `ownership`, `documentation`
- `topIssues`, a unified ranked list built from filtered governance signals rather than policy violations alone

`Top Issues` is ordered by severity first, then issue frequency, then canonical signal ordering. Policy-backed issues include `ruleId` when available.

---

### `repo-snapshot`

**Intent:** Persist a point-in-time governance snapshot for trend and drift analysis.

```bash
nx repo-snapshot
nx repo-snapshot --output=json
nx repo-snapshot --snapshotDir=.governance-metrics/snapshots
```

**Additional options:**

- `snapshotDir` (default: `.governance-metrics/snapshots`)
- `metricSchemaVersion` (default: `1.1`)

Snapshot files persist the historical metric and score maps plus deterministic governance summaries used by later drift analysis:

- `health` with workspace `score`, `status`, and `grade`
- `signalBreakdown`
- `metricBreakdown`
- `topIssues`

Older `1.0` snapshots remain readable; the enriched summary fields are optional for backward compatibility.

**Use when:** you want historical governance baselines for CI trend monitoring and AI analysis.

---

### `repo-drift`

**Intent:** Compare two snapshots and classify metric, signal, issue, and violation drift as improving, stable, or worsening.

```bash
nx repo-drift
nx repo-drift --output=json
nx repo-drift --baseline=.governance-metrics/snapshots/<older>.json --current=.governance-metrics/snapshots/<newer>.json
```

**Additional options:**

- `snapshotDir` (default: `.governance-metrics/snapshots`)
- `baseline` (optional explicit baseline snapshot path)
- `current` (optional explicit current snapshot path)

`repo-drift` emits the raw `comparison`, structured `signals`, and a deterministic `summary` with:

- `overallTrend`
- `worseningCount`, `improvingCount`, `stableCount`
- `topWorsening` and `topImproving`

When both snapshots include schema `1.1` summary fields, the comparison also includes `healthDelta`, `signalDeltas`, `metricFamilyDeltas`, and `topIssueDeltas`.

**Use when:** you need deterministic drift trend signals from recent governance runs.

---

### `repo-ai-root-cause`

**Intent:** Build deterministic root-cause payloads from prioritized violations and graph context.

```bash
nx repo-ai-root-cause --output=json
nx repo-ai-root-cause --snapshotPath=.governance-metrics/snapshots/<file>.json --topViolations=10
```

**Additional options:** `snapshotDir`, `snapshotPath`, `topViolations`.

**Model 1 handoff artifacts:**

- `.governance-metrics/ai/root-cause.payload.json`
- `.governance-metrics/ai/root-cause.prompt.md`

After command execution, the CLI prints concise usage instructions for external AI assistants. The plugin does not call provider APIs directly; developers paste the generated prompt and payload into their assistant of choice.

---

### `repo-ai-drift`

**Intent:** Prepare deterministic drift interpretation payloads from snapshot deltas and trend signals.

```bash
nx repo-ai-drift --output=json
nx repo-ai-drift --baseline=.governance-metrics/snapshots/<older>.json --current=.governance-metrics/snapshots/<newer>.json
```

**Additional options:** `snapshotDir`, `baseline`, `current`.

**Model 1 handoff artifacts:**

- `.governance-metrics/ai/drift.payload.json`
- `.governance-metrics/ai/drift.prompt.md`

---

### `repo-ai-pr-impact`

**Intent:** Build deterministic PR impact payloads from git diff scope and dependency signals.

```bash
nx repo-ai-pr-impact --output=json
nx repo-ai-pr-impact --baseRef=main --headRef=HEAD
```

**Additional options:** `baseRef`, `headRef`.

**Model 1 handoff artifacts:**

- `.governance-metrics/ai/pr-impact.payload.json`
- `.governance-metrics/ai/pr-impact.prompt.md`

---

### `repo-ai-cognitive-load`

**Intent:** Build deterministic cognitive-load payloads from fanout, coupling, and scope breadth.

```bash
nx repo-ai-cognitive-load --output=json
nx repo-ai-cognitive-load --domain=orders --topProjects=10
nx repo-ai-cognitive-load --project=orders-state
```

**Additional options:** `project`, `domain`, `topProjects`.

---

### `repo-ai-recommendations`

**Intent:** Generate deterministic architecture recommendations from prioritized violations and trend signals.

```bash
nx repo-ai-recommendations --output=json
nx repo-ai-recommendations --topViolations=10
```

**Additional options:** `snapshotDir`, `topViolations`.

---

### `repo-ai-smell-clusters`

**Intent:** Cluster deterministic architecture smell signals and highlight persistent patterns.

```bash
nx repo-ai-smell-clusters --output=json
nx repo-ai-smell-clusters --topViolations=10
```

**Additional options:** `snapshotDir`, `topViolations`.

---

### `repo-ai-refactoring-suggestions`

**Intent:** Produce deterministic refactoring suggestions from hotspots, fanout pressure, and persistence signals.

```bash
nx repo-ai-refactoring-suggestions --output=json
nx repo-ai-refactoring-suggestions --topViolations=10 --topProjects=5
```

**Additional options:** `snapshotDir`, `topViolations`, `topProjects`.

---

### `repo-ai-scorecard`

**Intent:** Prepare deterministic governance scorecards from health, violations, and drift trend metadata.

```bash
nx repo-ai-scorecard --output=json
nx repo-ai-scorecard --snapshotPath=.governance-metrics/snapshots/<file>.json
```

**Additional options:** `snapshotDir`, `snapshotPath`.

**Model 1 handoff artifacts:**

- `.governance-metrics/ai/scorecard.payload.json`
- `.governance-metrics/ai/scorecard.prompt.md`

---

### `repo-ai-onboarding`

**Intent:** Prepare deterministic onboarding briefs from repo shape, hotspots, and ownership coverage signals.

```bash
nx repo-ai-onboarding --output=json
nx repo-ai-onboarding --topViolations=10 --topProjects=5
```

**Additional options:** `topViolations`, `topProjects`.

**Use when:** onboarding engineers who need a deterministic architecture overview before making changes.

---

## Reports explained

### Health score, status, and grade

Every executor computes a **health score** from 0–100, then derives a health status:

| Score  | Status     | Interpretation                                        |
| ------ | ---------- | ----------------------------------------------------- |
| 85–100 | `Good`     | Healthy overall posture with minor follow-up items.   |
| 70–84  | `Warning`  | Risk is emerging and should be prioritized soon.      |
| 0–69   | `Critical` | Intervention is needed to reduce structural exposure. |

For backward compatibility, the report also keeps the existing letter grade:

| Score  | Grade | Interpretation                                           |
| ------ | ----- | -------------------------------------------------------- |
| 90–100 | A     | Healthy — architecture aligns well with declared intent. |
| 80–89  | B     | Good — minor issues present, worth addressing.           |
| 70–79  | C     | Acceptable — some structural debt accumulating.          |
| 60–69  | D     | Concerning — multiple signals degraded.                  |
| 0–59   | F     | Critical — significant structural violations present.    |

The score is a **weighted average** of individual metric scores. Weights are configured per-profile under `metrics.*Weight`. Equal weights (0.2 each across all six metrics) are the default, meaning each metric contributes evenly. Raise a weight to make a particular concern more influential in the overall score.

Status thresholds are configurable per-profile under `health.statusThresholds`. The defaults are `goodMinScore: 85` and `warningMinScore: 70`.

Any metric scoring below 60 is listed as a **hotspot** in both CLI and JSON output. The report also emits structured `metricHotspots`, ranked `projectHotspots`, and a nested `health.explainability` payload with weakest metrics, dominant issues, a threshold-based status reason, and a deterministic summary.

### Metrics

| Metric id                    | Name                       | Direction        | Formula                                                                                        |
| ---------------------------- | -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `architectural-entropy`      | Architectural Entropy      | lower is better  | `(weighted negative signal burden) / max(structural dependency volume, 1)` → inverted to score |
| `dependency-complexity`      | Dependency Complexity      | lower is better  | `(structural dependency volume) / (projects × 4)` → inverted to score                          |
| `domain-integrity`           | Domain Integrity           | lower is better  | `(weighted domain-boundary burden) / max(structural dependency volume, 1)` → inverted to score |
| `ownership-coverage`         | Ownership Coverage         | higher is better | `(owned projects) / (total projects)` → direct score                                           |
| `documentation-completeness` | Documentation Completeness | higher is better | `(documented projects) / (total projects)` → direct score                                      |
| `layer-integrity`            | Layer Integrity            | lower is better  | `(weighted layer-boundary burden) / max(structural dependency volume, 1)` → inverted to score  |

All raw values are bounded to `[0, 1]` before scoring. "Lower is better" metrics are scored as `(1 − value) × 100`. "Higher is better" metrics are scored as `value × 100`.

Negative signal-driven metrics use deterministic internal weighting before scoring.

### Default signal aggregation weights

Severity weights:

| Severity  | Weight |
| --------- | ------ |
| `info`    | `0.25` |
| `warning` | `0.6`  |
| `error`   | `1.0`  |

Type weights:

| Signal type                 | Weight | Notes                                                                 |
| --------------------------- | ------ | --------------------------------------------------------------------- |
| `structural-dependency`     | `1.0`  | Used for dependency volume only, excluded from entropy penalty burden |
| `cross-domain-dependency`   | `0.7`  | Contributes to entropy as a graph warning signal                      |
| `missing-domain-context`    | `0.85` | Contributes to entropy as a graph warning signal                      |
| `circular-dependency`       | `1.0`  | Reserved for future negative graph signals                            |
| `conformance-violation`     | `1.0`  | Full-weight conformance penalty                                       |
| `domain-boundary-violation` | `1.0`  | Full-weight domain policy penalty                                     |
| `layer-boundary-violation`  | `0.75` | Reduced but material layer penalty                                    |
| `ownership-gap`             | `0.5`  | Used in entropy only; ownership coverage remains workspace-derived    |

### How to interpret metrics

Use the overall health score for prioritization, then make decisions at the metric level.

| Metric                       | What it measures in practice                                                 | Watch signal                                                                           | First remediation moves                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `architectural-entropy`      | Weighted negative signal burden relative to dependency volume.               | Rising entropy with stable project count usually means boundary discipline is eroding. | Triage top violation clusters, fix highest-fanout offenders first, then add CI gates for recurring rule ids.                 |
| `dependency-complexity`      | How connected the workspace is compared with its size.                       | High complexity with frequent cross-domain work indicates large blast radius risk.     | Reduce fanout in shared nodes, split overloaded libraries, tighten public APIs.                                              |
| `domain-integrity`           | Weighted burden of domain-boundary violations relative to dependency volume. | Any sustained increase usually signals implicit coupling between domains.              | Introduce explicit inter-domain contracts, route integrations through APIs, align reviews to domain ownership.               |
| `ownership-coverage`         | Portion of projects with explicit ownership metadata or CODEOWNERS coverage. | Coverage below target slows incident response and architecture decisions.              | Fill ownership gaps first in hotspot projects, then enforce ownership checks in CI.                                          |
| `documentation-completeness` | Portion of projects with documented architecture/context metadata.           | Low documentation on high-change projects increases onboarding and regression risk.    | Prioritize docs for critical and high-fanout projects, add minimum documentation policy for new projects.                    |
| `layer-integrity`            | Weighted burden of layer-boundary violations relative to dependency volume.  | Repeated layer leaks often precede test brittleness and circular dependency pressure.  | Introduce layer-facing interfaces, move implementation details downward, block upward imports in lint and governance checks. |

#### Quick threshold guide

These are operating heuristics for decision-making (not hard scientific cutoffs):

- **Score >= 85**: healthy, optimize selectively and prevent regressions.
- **Score 70-84**: acceptable but trending risk, prioritize top 1-2 weakest metrics.
- **Score < 70**: intervention zone, create a short burn-down plan tied to violation clusters.

Metric-specific caution points:

- `domain-integrity` or `layer-integrity` **below 80**: treat as structural risk, not cosmetic debt.
- `ownership-coverage` **below 90** in fast-moving repos: likely coordination bottleneck.
- `dependency-complexity` falling while entropy rises: architecture may be simplifying graph shape but still violating contracts.

#### Trend interpretation

- Prefer trend direction over one-off snapshots: 3-4 consecutive worsening runs are more actionable than a single dip.
- Small fluctuations can be noise after large refactors; focus on persistent movement and recurring hotspots.
- If overall score improves while one integrity metric worsens, treat that metric as a targeted follow-up item.

#### Score caveat

The health score is a weighted heuristic summary, not a substitute for metric-level analysis. Always validate decisions against the weakest metrics, top violations, and hotspot projects before planning remediation work.

### Violations

Each violation carries:

| Field            | Meaning                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `id`             | Unique identifier for the violation instance (e.g. `billing-payments-domain`). |
| `ruleId`         | One of `domain-boundary`, `layer-boundary`, `ownership-presence`.              |
| `project`        | The source project name.                                                       |
| `severity`       | `error` for hard boundary breaks, `warning` for soft signals.                  |
| `message`        | Human-readable description of the specific violation.                          |
| `details`        | Structured data (source/target domain, layer order, dependency type).          |
| `recommendation` | Actionable guidance for resolving the violation.                               |

Active governance burden remains in `violations`. Exception-backed
findings that are currently suppressed do not appear here; they are
reported separately under `assessment.exceptions.suppressedFindings`.

When an exception becomes `stale` or `expired`, its matched finding is no
longer suppressed and returns to the active report surfaces
(`violations`, `signalBreakdown`, `topIssues`, `health`, and
recommendations). The corresponding exception context is retained in
`assessment.exceptions.reactivatedFindings` so the debt remains
explainable.

### Recommendations

Recommendations are generated automatically from the violation and metric set:

| id                                 | Trigger                                       | Priority |
| ---------------------------------- | --------------------------------------------- | -------- |
| `reduce-cross-domain-dependencies` | Any `domain-boundary` violation present       | high     |
| `improve-ownership-coverage`       | Any `ownership-presence` violation present    | medium   |
| `reduce-dependency-complexity`     | `dependency-complexity` metric score below 60 | medium   |

### Warnings

Warnings appear when the assessment contains important context that is not itself a policy violation. The most common warning is:

> _Boundary policy source is ESLint constraints (tools/governance/eslint/dependency-constraints.mjs). Profile allowedDomainDependencies is treated as fallback._

This is emitted whenever `boundaryPolicySource` is set to `"eslint"`, reminding consumers that the live boundary rules are being read from the ESLint helper rather than the static profile JSON.

### JSON output schema

When `--output=json` is used, the full `GovernanceAssessment` is written to stdout:

```jsonc
{
  "profile": "frontend-layered",
  "warnings": ["..."], // runtime warnings
  "workspace": {
    "id": "workspace",
    "projects": [
      {
        "name": "billing-api",
        "root": "packages/billing-api",
        "type": "library",
        "tags": ["domain:billing", "layer:data-access"],
        "domain": "billing",
        "layer": "data-access",
        "ownership": {
          "team": "@org/billing",
          "contacts": ["@org/billing"],
          "source": "merged" // "project-metadata" | "codeowners" | "merged" | "none"
        }
      }
    ],
    "dependencies": [
      { "source": "billing-api", "target": "shared-utils", "type": "static" }
    ]
  },
  "violations": [
    {
      "id": "billing-api-payments-api-domain",
      "ruleId": "domain-boundary",
      "project": "billing-api",
      "severity": "error",
      "message": "Project billing-api in domain billing depends on payments-api in domain payments.",
      "details": { "sourceDomain": "billing", "targetDomain": "payments" },
      "recommendation": "Move the dependency behind an API or adjust domain boundaries."
    }
  ],
  "measurements": [
    {
      "id": "ownership-coverage",
      "name": "Ownership Coverage",
      "value": 0.857,
      "score": 86,
      "maxScore": 100,
      "unit": "ratio"
    }
  ],
  "health": {
    "score": 91,
    "status": "good",
    "grade": "A",
    "hotspots": [],
    "metricHotspots": [],
    "projectHotspots": [
      {
        "project": "billing-api",
        "count": 2,
        "dominantIssueTypes": ["domain-boundary-violation"]
      }
    ],
    "explainability": {
      "summary": "Overall health is Good at 91/100. Weakest metrics: Ownership Coverage (86). Dominant issues: domain-boundary-violation x2.",
      "statusReason": "Score 91 meets the Good threshold (85).",
      "weakestMetrics": [
        {
          "id": "ownership-coverage",
          "name": "Ownership Coverage",
          "score": 86
        }
      ],
      "dominantIssues": [
        {
          "type": "domain-boundary-violation",
          "source": "policy",
          "severity": "error",
          "count": 2,
          "projects": ["billing-api", "payments-api"],
          "ruleId": "domain-boundary",
          "message": "Domain boundary violation"
        }
      ]
    }
  },
  "exceptions": {
    "summary": {
      "declaredCount": 2,
      "matchedCount": 2,
      "suppressedPolicyViolationCount": 1,
      "suppressedConformanceFindingCount": 0,
      "unusedExceptionCount": 0,
      "activeExceptionCount": 1,
      "staleExceptionCount": 1,
      "expiredExceptionCount": 0,
      "reactivatedPolicyViolationCount": 1,
      "reactivatedConformanceFindingCount": 0
    },
    "used": [
      {
        "id": "orders-shared-transition",
        "source": "policy",
        "status": "active",
        "reason": "Temporary migration path during extraction.",
        "owner": "@org/architecture",
        "review": {
          "reviewBy": "2026-06-01"
        },
        "matchCount": 1
      }
    ],
    "unused": [],
    "suppressedFindings": [
      {
        "kind": "policy-violation",
        "exceptionId": "orders-shared-transition",
        "source": "policy",
        "status": "active",
        "ruleId": "domain-boundary",
        "category": "boundary",
        "severity": "error",
        "projectId": "orders-app",
        "targetProjectId": "shared-util",
        "relatedProjectIds": ["orders-app", "shared-util"],
        "message": "Known transition dependency."
      }
    ],
    "reactivatedFindings": [
      {
        "kind": "conformance-finding",
        "exceptionId": "nx-owner-warning-review",
        "source": "conformance",
        "status": "stale",
        "ruleId": "@nx/conformance/ensure-owners",
        "category": "ownership",
        "severity": "warning",
        "projectId": "orders-app",
        "relatedProjectIds": [],
        "message": "Ownership warning needs review."
      }
    ]
  },
  "recommendations": [
    {
      "id": "reduce-cross-domain-dependencies",
      "title": "Reduce cross-domain dependencies",
      "priority": "high",
      "reason": "..."
    }
  ]
}
```

---

## Profile reference

```jsonc
// tools/governance/profiles/frontend-layered.json
{
  // "profile" | "eslint"
  // "eslint" reads boundary rules from tools/governance/eslint/dependency-constraints.mjs
  "boundaryPolicySource": "eslint",

  // Ordered layer hierarchy — lower index = higher architectural level
  "layers": ["app", "feature", "ui", "data-access", "util"],

  // Which domains may depend on which. An empty array means no cross-domain imports.
  // Use "*" as source key for a wildcard rule applied to all domains.
  // Use "*" as a value to allow any target domain.
  "allowedDomainDependencies": {
    "billing": ["shared"],
    "payments": ["shared"],
    "shared": []
  },

  "ownership": {
    "required": true, // raise ownership-presence violations when true
    "metadataField": "ownership"
  },

  // Workspace-level health classification thresholds
  "health": {
    "statusThresholds": {
      "goodMinScore": 85,
      "warningMinScore": 70
    }
  },

  // Per-metric weight in the overall health score (must be > 0, relative scale)
  "metrics": {
    "architecturalEntropyWeight": 0.2,
    "dependencyComplexityWeight": 0.2,
    "domainIntegrityWeight": 0.2,
    "ownershipCoverageWeight": 0.2,
    "documentationCompletenessWeight": 0.2,
    "layerIntegrityWeight": 0.2
  },

  // Explicit exceptions for known, reviewable deviations.
  "exceptions": [
    {
      "id": "orders-shared-transition",
      "source": "policy",
      "scope": {
        "source": "policy",
        "ruleId": "domain-boundary",
        "projectId": "orders-app",
        "targetProjectId": "shared-util"
      },
      "reason": "Temporary migration path during extraction.",
      "owner": "@org/architecture",
      "review": {
        "reviewBy": "2026-06-01"
      }
    },
    {
      "id": "nx-owner-warning-review",
      "source": "conformance",
      "scope": {
        "source": "conformance",
        "category": "ownership",
        "projectId": "orders-app"
      },
      "reason": "Ownership handoff in progress.",
      "owner": "@org/architecture",
      "review": {
        "expiresAt": "2026-07-01"
      }
    }
  ],

  // Per-project overrides — useful for projects that cannot carry tags or metadata
  "projectOverrides": {
    "legacy-monolith": {
      "domain": "billing",
      "layer": "app",
      "ownershipTeam": "@org/billing",
      "documentation": true
    }
  }
}
```

---

## ESLint alignment

Running the `eslint-integration` generator creates a **shared runtime policy module**. By default this lives at `tools/governance/eslint/dependency-constraints.mjs`, but you can override it with `governanceHelperPath`. This module:

1. Reads all `tools/governance/profiles/*.json` files at import time.
2. Merges their `allowedDomainDependencies` maps.
3. Converts each `domain:X → [domain:Y, ...]` entry into an `@nx/enforce-module-boundaries` depConstraint object.
4. Exports the resulting array as `governanceDepConstraints`.

Your autodetected or explicitly selected flat ESLint config imports and uses this export directly:

```js
import { governanceDepConstraints } from './tools/governance/eslint/dependency-constraints.mjs';

export default [
  // ...
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          depConstraints: governanceDepConstraints,
        },
      ],
    },
  },
];
```

**The consequence:** changing a domain rule in a profile JSON propagates automatically to both ESLint enforcement (on the next `lint` run) and governance reporting (on the next `repo-boundaries` run). No manual synchronisation, no drift.

When `boundaryPolicySource` is `"eslint"` in a profile, the governance executor also imports this module at runtime. If you generate the helper to a custom path, the generator stores that path in the migrated profile file so reports and lint keep using the same constraint source.

---

## CI integration

To fail a pipeline when governance violations are present:

```yaml
# .github/workflows/ci.yml
- name: Governance health gate
  run: yarn nx repo-health --failOnViolation

- name: Boundary enforcement gate
  run: yarn nx repo-boundaries --failOnViolation
```

To archive the JSON report as a build artefact:

```yaml
- name: Generate governance report
  run: yarn nx repo-health --output=json > governance-report.json

- uses: actions/upload-artifact@v4
  with:
    name: governance-report
    path: governance-report.json
```

To track health score trends over time, pipe the JSON output into your observability platform or store it alongside test coverage reports for historical comparison.
