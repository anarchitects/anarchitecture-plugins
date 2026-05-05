# Nx Governance Inference Requirements

## Feature Name

Project Crystal inference for Nx Governance commands.

## Problem Statement

Today, governance commands are configured explicitly by generator output. Adding or changing governance profiles requires manual config updates.

This feature should infer governance targets from profile files so commands are available by convention.

## Goals

- Infer governance targets automatically when governance profiles exist.
- Keep command names stable:
  - repo-health
  - repo-boundaries
  - repo-ownership
  - repo-architecture
- Make profile addition low-friction: create a profile file and run commands.
- Keep behavior equivalent to existing explicit target setup.

## Non-Goals

- Redesign governance engine logic.
- Introduce new governance command names.
- Change score/policy algorithms.
- Build a UI for governance results.

## Users and Primary Scenarios

- Plugin maintainer: wants inferred targets without writing root project config manually.
- Workspace maintainer: adds tools/governance/profiles/<name>.json and runs governance commands with that profile.
- CI maintainer: relies on deterministic target names in pipelines.

## Functional Requirements

### FR-1 Project Detection

Inference must activate when one or more files match:

- tools/governance/profiles/\*.json

### FR-2 Inferred Targets

For the workspace root project, infer these targets:

- repo-health
- repo-boundaries
- repo-ownership
- repo-architecture

Each inferred target must map to the existing executors in @anarchitects/nx-governance.

### FR-3 Profile Resolution

Inference must derive profile name from the filename (basename without .json).

Example:

- tools/governance/profiles/frontend-layered.json => profile frontend-layered

Inferred targets should use that profile as default option.

### FR-4 Explicit Option Override

Users must be able to override inferred profile at runtime through existing CLI options, for example:

- nx repo-health --profile=other-profile

### FR-5 Multiple Profiles

If multiple profile files exist, inference must be deterministic.

Required behavior:

- Targets remain available with stable names.
- Default profile selection strategy must be explicitly defined and documented.

Recommended strategy:

- Prefer frontend-layered when present.
- Otherwise choose lexical-first profile filename.

### FR-6 Backward Compatibility

If explicit targets already exist in workspace config or package scripts, behavior must remain functional.

No breaking change to current command invocations in CI.

### FR-7 Error Handling

If inferred default profile file is invalid JSON, command execution must fail with a clear, actionable error.

If no profile files exist, inference must not create governance targets.

### FR-8 Generator Alignment

Init/setup generator should stop writing redundant explicit governance targets once inference is enabled by default.

Migration path must preserve existing workspaces.

## Non-Functional Requirements

### NFR-1 Performance

Inference must add negligible startup overhead.

Target:

- No perceptible slowdown in nx graph/project loading for typical profile counts (1-10 files).

### NFR-2 Determinism

Given the same profile files, inferred targets and defaults must be identical across machines and CI runs.

### NFR-3 Maintainability

Implementation should stay thin:

- Keep inference logic in plugin index/inference module.
- Avoid duplicating executor option composition in multiple places.

### NFR-4 Observability

Errors and warnings must identify:

- profile path
- failing command/target
- remediation hint

## API and Configuration Requirements

- Keep current executor option schema intact.
- No new required flags for existing commands.
- Optional enhancement: support plugin config for default profile precedence in future, but not required for MVP.

## Acceptance Criteria

- AC-1: Creating tools/governance/profiles/frontend-layered.json makes governance targets appear without manual config edits.
- AC-2: nx repo-health runs successfully using inferred default profile.
- AC-3: nx repo-health --profile=<other> overrides inferred default.
- AC-4: With two profile files, default profile is selected by documented deterministic rule.
- AC-5: Removing all profile files removes inferred governance targets.
- AC-6: Existing workspaces with explicit targets still run unchanged.
- AC-7: Invalid profile JSON surfaces a clear error message naming the file.

## Testing Requirements

### Unit Tests

- Detect profile files and infer targets for root project.
- Parse profile name from filename.
- Deterministic default profile selection with multiple profiles.
- No targets inferred when zero profile files exist.

### Integration Tests

- Generated workspace with profile file can run inferred targets.
- Runtime --profile override works.
- Invalid profile JSON produces expected error output.

### Regression Tests

- Existing explicit-target workflow continues to pass.

## Migration and Rollout Requirements

### Phase 1

- Implement inference behind current behavior.
- Keep explicit target generation.
- Add docs and tests.

### Phase 2

- Update init generator to rely on inference by default.
- Keep compatibility branch for pre-existing workspaces.

### Phase 3

- Deprecation notice for redundant explicit target writing.

## Documentation Requirements

- Update governance README with:
  - inferred target behavior
  - default profile selection rule
  - multi-profile guidance
  - troubleshooting invalid profile files

## Risks and Mitigations

- Risk: profile precedence confusion.
  - Mitigation: deterministic rule + docs + explicit override examples.
- Risk: hidden conflicts with explicit targets.
  - Mitigation: compatibility tests and migration notes.
- Risk: CI drift.
  - Mitigation: keep target names stable and override option unchanged.

## Definition of Done

- All acceptance criteria satisfied.
- Unit + integration tests green.
- README updated.
- No breaking changes to existing governance command invocations.
