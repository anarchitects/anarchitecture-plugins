# Standalone Governance CLI Usage

## Purpose

The standalone Governance CLI MVP provides a minimal non-Nx host around
Governance Core.

Its job is to:

- load an explicit workspace file
- load an explicit governance profile file
- normalize both into the canonical Governance Core contracts
- run Governance Core evaluation
- render deterministic output for local use or CI

This CLI does not replace `@anarchitects/nx-governance` as the Nx integration.
It proves that the same Governance Core can execute outside Nx when given
explicit inputs.

For the MVP command and exit-code contract, see
[`standalone-cli-command-surface.md`](./standalone-cli-command-surface.md).
For the manual workspace input schema, see
[`generic-workspace-schema.md`](./generic-workspace-schema.md).
For the broader implementation context, see
[`governance-implementation-epic-alignment.md`](./governance-implementation-epic-alignment.md#220--standalone-governance-cli-mvp).

## Relationship to Governance Core and Nx Governance

- Governance Core owns the canonical `GovernanceWorkspace` model and governance
  evaluation logic.
- The standalone CLI owns file loading, validation, normalization, rendering,
  and process exit behavior.
- `@anarchitects/nx-governance` remains the Nx-specific integration for Nx
  workspaces.

The generic YAML/JSON workspace file is an external host input format. It is
not the Core model itself. The CLI validates and normalizes that file into the
canonical `GovernanceWorkspace` contract before evaluation.

## Installation

The MVP currently ships through the existing package
`@anarchitects/nx-governance`, which exposes the `agov` binary.

```bash
npm install --save-dev @anarchitects/nx-governance
```

```bash
yarn add --dev @anarchitects/nx-governance
```

```bash
pnpm add --save-dev @anarchitects/nx-governance
```

Run the binary with your package manager, for example:

```bash
npx agov check --workspace governance.workspace.yaml --profile profile.json
```

If the package naming or distribution model changes later, update this document
to match the published CLI package. For the MVP, use the installed `agov`
binary from `@anarchitects/nx-governance`.

## Inputs

The standalone CLI MVP requires two explicit files:

- `--workspace <path>`: a manual YAML or JSON workspace file
- `--profile <path>`: a governance profile JSON file

There is no workspace discovery in the MVP. The CLI does not scan source code,
inspect package-manager workspaces, or load an Nx project graph.

## Minimal Workspace Examples

### YAML

```yaml
schemaVersion: 1
workspace:
  name: demo
projects:
  - name: customer-domain
    root: src/customer/domain
    tags:
      - scope:customer
      - layer:domain
      - type:library
  - name: order-domain
    root: src/order/domain
    tags:
      - scope:order
      - layer:domain
      - type:library
dependencies:
  - source: customer-domain
    target: order-domain
    type: static
```

### JSON

```json
{
  "schemaVersion": 1,
  "workspace": {
    "name": "demo"
  },
  "projects": [
    {
      "name": "customer-domain",
      "root": "src/customer/domain",
      "tags": ["scope:customer", "layer:domain", "type:library"]
    },
    {
      "name": "order-domain",
      "root": "src/order/domain",
      "tags": ["scope:order", "layer:domain", "type:library"]
    }
  ],
  "dependencies": [
    {
      "source": "customer-domain",
      "target": "order-domain",
      "type": "static"
    }
  ]
}
```

These files are only the CLI input format. During execution they are normalized
into the canonical Governance Core workspace model.

## Profile Input

Profiles are JSON governance configuration inputs. The standalone CLI loads a
profile from the explicit path passed through `--profile` and normalizes it
into the existing Governance Core profile contract.

Example:

```json
{
  "name": "repo-boundaries",
  "description": "Minimal standalone CLI profile",
  "boundaryPolicySource": "profile",
  "layers": ["app", "domain", "infra"],
  "rules": {
    "missing-domain": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "required": true
      }
    }
  },
  "allowedLayerDependencies": {
    "app": ["domain", "infra"],
    "domain": ["infra"]
  },
  "allowedDomainDependencies": {
    "*": ["shared"]
  },
  "ownership": {
    "required": true,
    "metadataField": "ownership"
  },
  "health": {
    "statusThresholds": {
      "goodMinScore": 90,
      "warningMinScore": 75
    }
  },
  "metrics": {
    "ownership-coverage": 0.3,
    "layer-integrity": 0.8,
    "domain-integrity": 0.6,
    "documentation-completeness": 0.1,
    "dependency-complexity": 0.4,
    "architectural-entropy": 0.5
  }
}
```

## `agov check`

The MVP implements one standalone command:

```bash
agov check --workspace <path> --profile <path> [options]
```

Required options:

- `--workspace <path>`
- `--profile <path>`

Optional options:

- `--format json|markdown|table`
- `--output <path>`
- `--fail-on none|warning|error`

### JSON output

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile tools/governance/profiles/repo-boundaries.json \
  --format json
```

### Markdown output

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --format markdown \
  --output dist/governance/report.md
```

### Table output

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --format table
```

## Output Routing

By default, `agov check` writes to stdout.

Use `--output <path>` to write the rendered report to a file instead:

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --format json \
  --output dist/governance/report.json
```

The output format is independent from exit behavior. The same assessment can be
rendered as JSON, Markdown, or table output.

## Severity Thresholds and Exit Behavior

Use `--fail-on` to control when governance findings should fail the process:

- `none`: never fail because of governance findings
- `error`: fail on error findings
- `warning`: fail on warning or error findings

Example:

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --fail-on warning
```

Current `agov check` exit codes:

- `0`: evaluation completed and findings stayed below the configured threshold
- `1`: evaluation completed and findings met the configured threshold
- `2`: CLI usage, file loading, validation, or output-path failure
- `3`: unhandled runtime failure inside the CLI host

## CI Example

The standalone CLI is intended to be CI-friendly because inputs, rendering, and
exit semantics are deterministic.

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --format markdown \
  --output dist/governance/report.md \
  --fail-on error
```

A stricter CI gate can use:

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile repo-boundaries.json \
  --format json \
  --fail-on warning
```

## Troubleshooting

### Invalid workspace input

The workspace loader fails deterministically when the file:

- cannot be read
- cannot be parsed as YAML or JSON
- does not match schema version `1`
- contains invalid paths, duplicate project names, duplicate roots, or invalid
  dependency references

Start by validating the file against
[`generic-workspace-schema.md`](./generic-workspace-schema.md).

### Invalid profile input

The profile loader fails deterministically when the file:

- cannot be read
- is not valid JSON
- is missing required profile fields
- contains invalid field types or unsupported enum values

### Unsupported CLI options

The standalone CLI MVP currently supports only:

- command: `check`
- formats: `json`, `markdown`, `table`
- fail thresholds: `none`, `warning`, `error`

Unknown commands or unsupported option values return deterministic CLI errors.

## MVP Limitations

This document describes the current standalone CLI MVP. It does not include:

- automatic source-code scanning
- package-manager workspace discovery
- Nx graph loading in the standalone CLI
- Angular, React, or NestJS enrichment
- Maven, Gradle, PHP, .NET, or Python adapters
- AI integrations
- dashboard or web output
- additional standalone commands beyond the current `agov check` host

Future adapters may load other workspace formats, but they should still
normalize into the same canonical Governance Core contracts.
