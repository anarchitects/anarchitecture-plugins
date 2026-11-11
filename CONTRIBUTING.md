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

- Use the current `CreateNodes` type and `createNodes` inference export when targets can be derived from conventions; retain a `createNodesV2` runtime alias where compatibility requires it. Avoid the deprecated `CreateNodesV2` type.
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

### 5. Keep the Nest Core Portable

For `@anarchitects/nest`, first read its
[ownership boundaries](packages/nest/README.md#architecture-and-ownership) and
[portable-core contributor constraints](packages/nest/README.md#contributor-constraints-for-the-portable-core).
Nest owns framework behavior, Nx owns orchestration, and test/lint integrations
own their targets. Keep Anarchitects-specific policies in separate optional
tooling. The Nest package and its E2E fixtures are MIT-licensed exceptions to the
repository's Apache-2.0 license, supporting an eventual upstream contribution.

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

## Release publication and recovery

The **Release (Manual)** workflow uses Nx to version packages and create GitHub
Releases with the Anarchitects GitHub App token. Each `release: published` event
starts **Publish** for that release's tag. Keep the App token for release creation:
events created with the workflow's default `GITHUB_TOKEN` do not trigger another
workflow. Tag pushes alone do not publish packages. This avoids GitHub's suppression
of push events when more than three tags are pushed together and follows the
[Community publishing workflow](https://github.com/anarchitects/anarchitecture-community/blob/main/.github/workflows/publish.yml).

After this workflow change is merged, recover an existing authorized release
without creating a new version:

1. Open **Actions → Publish → Run workflow** and select `main` for the workflow.
2. Enter the exact existing tag, for example `nx-js@0.2.0`, in **tag**. The CLI
   equivalent is:

   ```bash
   gh workflow run publish.yml --ref main -f tag=nx-js@0.2.0
   ```

3. Inspect the run. It checks out `refs/tags/<tag>` even when dispatched from
   `main`, validates the Nx project and package version, and queries npm for that
   exact version. A missing tag, invalid version, unknown/private project or
   registry error fails the run. An already-published version succeeds without
   publishing again or moving npm dist-tags such as `latest`.
4. For an unpublished version, the existing build, typecheck and test gates run
   before Nx publishes through npm trusted publishing. Confirm the package version
   on npm and the successful Publish run. Repeat for each missing package in a
   multi-package release batch.

Automatic publication and manual recovery use the same per-tag concurrency group.
The workflow does not create, delete or move Git tags and does not run versioning.
Keep the npm trusted publisher configured for this repository's `publish.yml`;
recovery uses the same OIDC identity and requires no npm token. Release authority
and existing owner approval remain required; recovery executes that release intent.
Tags created before this fix use manual dispatch from `main` to pick up the updated
workflow while building the original tagged source.

Run the offline regression suite with:

```bash
yarn nx run @anarchitecture-plugins/source:test-release-workflows
```

It exercises six release tags, manual tag resolution, version/project rejection,
registry failures and already-published recovery using the workflow's own scripts.
It runs in both PR CI workflows. The deterministic tests are cached; npm queries
and publication run fresh in Publish. Live acceptance requires observing one
Publish run per GitHub Release in the next authorized multi-package release and
manually replaying an existing published tag. Offline fixtures do not establish
GitHub event delivery or npm OIDC success.

See GitHub's [release and push event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
and [workflow triggering rules](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).

## Need Help?

- Check `AGENTS.md` for workspace-specific Nx guidance.
- Check `.github/copilot-instructions.md` for plugin implementation standards.
