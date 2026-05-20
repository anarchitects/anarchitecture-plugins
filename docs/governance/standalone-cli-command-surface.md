# Standalone Governance CLI Command Surface

## Purpose

This document defines the MVP command surface for the standalone Governance CLI under epic #220.

It is intentionally narrow. The goal is to prove that Governance Core can run outside Nx through a dedicated CLI host without redesigning Core or replacing Nx Governance.

This is a documentation-only contract. It does not implement the CLI, create packages, or change runtime behavior.

## Design Goal

The standalone CLI should provide a minimal, deterministic host around Governance Core that can:

- load an explicit workspace input file
- load an explicit profile file
- run core governance evaluation
- render stable textual or JSON output
- fail predictably when governance findings exceed the requested threshold

The CLI is a host around Governance Core. It is not an Nx replacement.

## MVP Command Set

The MVP command surface is intentionally limited to three commands:

- `agov check`
- `agov report`
- `agov graph`

These commands are enough to validate:

- non-Nx host execution
- explicit file-based input
- Core-owned assessment and reporting contracts
- deterministic output semantics

## Shared CLI Shape

All commands should follow this general form:

```bash
agov <command> --workspace <path> --profile <path> [options]
```

### Shared required options

| Option               | Type | Purpose                                                             |
| -------------------- | ---- | ------------------------------------------------------------------- |
| `--workspace <path>` | path | Path to the explicit workspace input file consumed by the CLI host. |
| `--profile <path>`   | path | Path to the governance profile JSON file.                           |

### Shared optional options

| Option                             | Type | Default                  | Purpose                                      |
| ---------------------------------- | ---- | ------------------------ | -------------------------------------------- |
| `--format <text\|json>`            | enum | command-specific default | Output format.                               |
| `--output <path>`                  | path | stdout                   | Write result to a file instead of stdout.    |
| `--fail-on <none\|error\|warning>` | enum | command-specific default | Exit-code threshold for governance findings. |
| `--help`                           | flag | false                    | Show help for the command.                   |

### Shared defaults

- Paths are treated as explicit host inputs. The CLI does not auto-discover a workspace.
- Output goes to stdout unless `--output` is provided.
- Commands must produce deterministic output for the same workspace file, profile, and options.
- Help text should be stable and concise.

## Workspace Input Model

The CLI MVP is file-driven.

Expected input:

- a workspace file path supplied through `--workspace`
- a profile file path supplied through `--profile`

The CLI host is responsible for:

- reading the workspace file
- validating that it can be parsed
- mapping it into the Core-compatible workspace model
- reporting host/input errors clearly

The CLI MVP does not introduce:

- package-manager workspace discovery
- TypeScript source discovery
- Nx graph loading
- framework-specific adapters

## Command Contracts

## `agov check`

### Purpose

Run governance evaluation and return a pass/fail result suitable for local checks and CI gating.

### Syntax

```bash
agov check --workspace <path> --profile <path> [--format text|json] [--fail-on none|error|warning] [--output <path>]
```

### Default behavior

- default format: `text`
- default `fail-on`: `error`
- default output: stdout

### Expected semantics

- evaluates the supplied workspace against the supplied profile
- renders a concise summary
- exits non-zero when findings meet or exceed the configured threshold

### Example

```bash
agov check --workspace ./workspace.json --profile ./profiles/frontend-layered.json
```

### JSON example

```bash
agov check --workspace ./workspace.json --profile ./profiles/frontend-layered.json --format json
```

## `agov report`

### Purpose

Run governance evaluation and emit the full assessment report for humans or downstream tooling.

### Syntax

```bash
agov report --workspace <path> --profile <path> [--format text|json] [--output <path>] [--fail-on none|error|warning]
```

### Default behavior

- default format: `text`
- default `fail-on`: `none`
- default output: stdout

### Expected semantics

- produces the richer assessment output rather than only the CI-style pass/fail summary
- does not fail by default, but may do so when `--fail-on` is explicitly set
- preserves deterministic ordering of findings, signals, metrics, and summaries

### Example

```bash
agov report --workspace ./workspace.json --profile ./profiles/frontend-layered.json --output ./dist/governance-report.txt
```

### JSON example

```bash
agov report --workspace ./workspace.json --profile ./profiles/frontend-layered.json --format json --output ./dist/governance-report.json
```

## `agov graph`

### Purpose

Produce a governance-oriented graph/document view from the explicit workspace input without requiring Nx.

### Syntax

```bash
agov graph --workspace <path> --profile <path> [--format text|json] [--output <path>] [--fail-on none|error|warning]
```

### Default behavior

- default format: `json`
- default `fail-on`: `none`
- default output: stdout

### Expected semantics

- renders a graph/document-oriented output derived from the normalized governance workspace and assessment state
- remains deterministic for the same input
- does not imply Nx project graph support; it only reflects the supplied workspace file

### Example

```bash
agov graph --workspace ./workspace.json --profile ./profiles/frontend-layered.json --output ./dist/governance-graph.json
```

## Output and Exit-Code Semantics

The CLI host should keep exit-code behavior simple:

| `--fail-on` value | Behavior                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| `none`            | Always exit 0 unless there is a host/input/runtime failure.                    |
| `error`           | Exit non-zero when error-severity governance findings are present.             |
| `warning`         | Exit non-zero when warning- or error-severity governance findings are present. |

Host/input/runtime failures are distinct from governance findings and should still fail regardless of `--fail-on`.

Examples of host/input/runtime failure:

- workspace file cannot be read
- workspace file cannot be parsed
- profile file cannot be read
- profile file cannot be parsed
- output file cannot be written

## Deterministic Behavior Expectations

The CLI MVP must preserve deterministic host behavior.

For the same:

- workspace file contents
- profile file contents
- command
- option set

the CLI should produce the same:

- exit code
- JSON output
- textual section ordering
- graph/document ordering

The CLI host should not:

- crawl the filesystem for additional projects
- infer package-manager structure
- discover hidden adapters
- inject environment-dependent ordering

## Help Surface

The help surface should stay intentionally small.

Expected top-level help:

```bash
agov --help
```

Expected command help:

```bash
agov check --help
agov report --help
agov graph --help
```

Help output should document:

- command purpose
- required inputs
- shared options
- command-specific defaults
- failure-threshold behavior

## CLI Host Responsibilities vs Governance Core Responsibilities

### CLI host responsibilities

- parse CLI arguments
- read workspace/profile files
- validate command-line usage
- map explicit input into Core-compatible contracts
- choose output renderer based on `--format`
- write stdout or output files
- set exit codes
- print help text

### Governance Core responsibilities

- evaluate governance rules against the normalized workspace model
- build deterministic findings, signals, and measurements
- aggregate assessment state
- produce report/graph-ready data structures through existing contracts

### Out of scope for Core

- CLI parsing
- stdout/stderr behavior
- path resolution
- filesystem discovery
- package-manager discovery
- Nx-specific behavior

## Why the MVP Is Intentionally Small

The MVP should validate one architectural question only:

Can Governance Core run correctly and deterministically through a non-Nx host?

That question does not require:

- TypeScript import graph discovery
- package-manager workspace discovery
- framework-specific adapters
- AI handoff features
- Nx-compatible feature parity

A small command surface reduces risk and keeps implementation issues focused on host/Core separation rather than ecosystem breadth.

## Non-goals

This MVP does not include:

- TypeScript import graph analysis
- package-manager discovery
- Maven support
- Gradle support
- PHP support
- .NET support
- Python support
- AI integrations
- framework-specific adapters
- Nx project graph loading
- replacement of Nx Governance
- redesign of Governance Core
- redesign of Nx Governance

## Follow-on Implementation Guidance

This document is meant to be specific enough for follow-up implementation issues to define:

- CLI argument parsing
- workspace file schema selection
- text vs JSON rendering behavior
- exit-code behavior
- graph/document output shape

Without reopening the MVP scope.
