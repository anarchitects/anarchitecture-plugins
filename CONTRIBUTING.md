# Contributing

Thanks for contributing to this workspace.

This repository is an Nx plugin monorepo. Contributions should preserve a native Nx developer experience, stable plugin APIs, and backward compatibility for existing workspaces.

## Prerequisites

- Node.js (LTS recommended)
- Yarn (workspace uses Yarn)

## Local Setup

1. Install dependencies:

```bash
yarn install
```

2. Verify the workspace is healthy:

```bash
yarn nx graph
```

## Development Workflow

1. Create a branch from `main`.
2. Make focused changes (avoid unrelated refactors in the same PR).
3. Run affected checks early and often.
4. Update docs and tests with code changes.
5. Open a PR with a clear description, rationale, and migration notes if relevant.

## Running Tasks

Always run tasks through Nx and prefix with the package manager:

```bash
yarn nx build <project>
yarn nx test <project>
yarn nx lint <project>
```

For broader validation:

```bash
yarn nx run-many -t build,test,lint -p <project1>,<project2>
```

Use `nx affected` when working across multiple projects:

```bash
yarn nx affected -t build,test,lint
```

## Nx Plugin Guidelines

### 1. Prefer Inference (Project Crystal)

- Use `createNodesV2` when targets can be derived from conventions.
- Avoid generating explicit target config when inference can express behavior.
- Keep inferred behavior deterministic and documented.

### 2. Keep Executors Thin

- Executors should adapt options to command invocation.
- Forward stdio and return `{ success: boolean }`.
- Fail with actionable error messages.
- Avoid hidden global state and non-deterministic behavior.

### 3. Keep Generators Idempotent

- Safe to rerun without destructive side effects.
- Merge existing configuration rather than replacing it.
- Write only minimal required config.

### 4. Preserve Compatibility

- Keep stable executor names and option names when possible.
- If behavior changes, provide migration support and documentation.
- Phase in inference before removing explicit target generation.

## Testing Expectations

For plugin changes, include tests relevant to the change:

- Unit tests:
  - option parsing and validation
  - command composition
  - inference matching and target generation
- Integration tests:
  - generator output in realistic fixtures/workspaces
  - executor behavior against representative projects
- Regression tests:
  - lock in fixed bug behavior

## Documentation Expectations

Update docs for user-facing changes:

- Plugin README usage and examples
- Inference conventions and precedence rules
- Troubleshooting guidance
- Migration notes for behavior changes

## Pull Request Checklist

Before requesting review:

- [ ] Changes are scoped and focused.
- [ ] `yarn nx build <project>` passes.
- [ ] `yarn nx test <project>` passes.
- [ ] `yarn nx lint <project>` passes.
- [ ] Tests were added/updated for new behavior.
- [ ] Docs were updated for user-facing changes.
- [ ] Migration/compatibility implications are documented.

## Commit Messages

Use clear, conventional commit messages when possible:

- `feat: add inferred targets for <plugin>`
- `fix: correct <behavior> in <plugin>`
- `docs: update <plugin> usage`
- `chore: refactor internal <module>`

## Need Help?

- Check `AGENTS.md` for workspace-specific Nx guidance.
- Check `.github/copilot-instructions.md` for plugin implementation standards.
