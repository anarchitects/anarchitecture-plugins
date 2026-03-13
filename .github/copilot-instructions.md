# Copilot Instructions - anarchitects-plugins (General Nx Plugin Approach)

## Goal

Provide a consistent, high-quality approach for building Nx plugins in this workspace:

- Native Nx developer experience first
- Convention over configuration via Project Crystal inference
- Thin executors and generators with clear responsibilities
- Strong validation through unit and integration tests
- Backward-compatible migrations for existing workspaces

## Core Principles

- Prefer inferred targets over generated explicit target config.
- Keep plugin APIs stable: stable executor names, stable option names, stable command behavior.
- Keep executors thin; delegate heavy work to the underlying toolchain.
- Keep generators idempotent and safe to rerun.
- Build migration paths before introducing breaking behavior changes.

## Standard Plugin Structure

- `src/generators/*`: scaffold and workspace configuration updates
- `src/executors/*`: runtime command adapters
- `src/plugin/index.ts`: Project Crystal inference (`createNodesV2`)
- `src/utils/*`: parsing, detection, shared helpers
- `src/migrations/*` (if needed): behavior-preserving upgrades

## Generators (What to Build)

- Provide an `init` generator for one-command onboarding.
- Add domain-specific generators only when they reduce repetitive user work.
- Write only minimum config required; avoid duplicating inferred targets.
- Detect existing files and merge non-destructively.
- Keep generator side effects explicit and documented.

Generator requirements:

- Input schema with defaults and validation
- Clear dry-run style logging where appropriate
- Idempotent behavior when rerun
- Tests for fresh workspace and existing workspace scenarios

## Executors (How to Run)

Implement small TypeScript executors that:

- Build command arguments deterministically from schema options
- Forward stdio (`inherit`) for interactive diagnostics
- Exit non-zero on failure
- Support pass-through args when useful
- Return `{ success: boolean }` consistently

Executor requirements:

- Helpful error messages with remediation hints
- No hidden global state
- Deterministic behavior between local and CI
- Explicit cache guidance (`cache: false`) for non-reproducible IO tasks

## Inference (Project Crystal)

Use `createNodesV2` for target discovery whenever targets can be derived from file conventions.

Inference requirements:

- Match on real source-of-truth files (for example tool config, manifest, profile files)
- Infer stable target names
- Use documented, deterministic default options
- Avoid inference when no convention files exist
- Keep inferred behavior equivalent to explicit behavior

When multiple convention files exist, define and document precedence rules.

## Compatibility and Migration Strategy

- Phase in inference before removing explicit target generation.
- Keep existing workspaces working without manual intervention.
- If config model changes, provide migration generators or codemods.
- Document deprecations first, then enforce in a later phase.

## Testing Strategy

Every plugin feature should include the following tests:

- Unit tests:
  - option parsing and validation
  - command composition
  - inference matching and target generation
- Integration tests:
  - generator output in a temp workspace
  - executor behavior against representative fixtures
  - inferred targets runnable through Nx
- Regression tests:
  - prior bug behavior locked with explicit test coverage

Use Nx tasks for verification:

- `yarn nx build <plugin-project>`
- `yarn nx test <plugin-project>`
- `yarn nx lint <plugin-project>`

## Documentation Requirements

For each plugin, keep README documentation implementation-ready:

- Install via `nx add <plugin-package>` as primary path
- Quickstart for generator + executor usage
- Inference conventions and precedence rules
- Command reference with examples
- Troubleshooting section with actionable errors

## Pull Request Quality Bar

Before merge:

- Build, test, and lint are green for the plugin project
- New behavior covered by tests
- Breaking changes have migration path and documentation
- README updated for user-facing changes
- No unrelated refactors bundled with feature work

## Suggested Delivery Sequence

1. Define target UX and conventions.
2. Implement inference and shared utils.
3. Implement/adjust executors.
4. Implement/adjust generators.
5. Add migration support (if needed).
6. Add/refresh tests.
7. Update README and usage examples.

## Rules of Thumb

- If inference can express it, do not write explicit target config.
- If users must repeat a manual step twice, consider a generator.
- If behavior depends on file presence, test both present and absent states.
- If a default is chosen automatically, make it deterministic and documented.
- Prefer small, composable utilities over monolithic executor logic.
