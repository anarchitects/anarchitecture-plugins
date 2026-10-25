# Nx 24 compatibility audit

Tracking: [#588](https://github.com/anarchitects/anarchitecture-plugins/issues/588).
The issue was created before implementation on `fix/588-nx-24-compatibility`.
The development toolchain is aligned to Nx **24.0.1**. Published support ranges
are recorded in the [support matrix](../support-matrix.md).

## Architecture preflight

All six local ADRs and all seventeen Meta ADRs were enumerated and read before
implementation, including proposed and historical records. Meta was reviewed at
`71c46b1d044804f4b8eeaa062537d1b2d72a9c04` (2026-10-24), with the remote ADR
inventory checked against the local checkout.

Local inventory (`docs/adr/`):

- `adr-nest-generation-strategy.md` — historical proposal; the shipped README contract takes precedence.
- `adr-nest-http-platform-scaffolding.md` — accepted.
- `adr-nest12-first-party-defaults-and-compatibility.md` — accepted.
- `adr-package-initial-release-and-nx-versioning.md` — accepted.
- `adr-public-package-documentation.md` — proposed; followed as documentation guidance.
- `modern-angular-22-signal-forms.md` — accepted; no Angular output changes in this work.

Meta inventory (`anarchitecture-meta/adr/`):

- `ADR-0001.md` — accepted.
- `0001-two-core-implementation-styles.md` — accepted.
- `0001-cooperative-governance-enrichment.md` — proposed.
- `0002-modulith-first-ecosystem-position.md` — accepted.
- `0003-cross-repo-ai-enablement-model.md` — accepted.
- `0004-meta-owns-landscape-contracts.md` — accepted.
- `0005-governance-hierarchy-and-policy-inheritance.md` — proposed.
- `0006-archi-as-reference-implementation-for-enterprise-architecture-governance.md` — proposed.
- `0007-governance-workspace-layering-model.md` — proposed.
- `0008-http-platform-independence.md` — accepted.
- `0008-modern-angular-22-signal-forms.md` — accepted.
- `0009-native-node-candidate-default.md` — accepted.
- `0010-nest-first-runtime-and-dependency-policy.md` — accepted.
- `0011-nest12-authn-authz-contracts-and-compatibility.md` — accepted.
- `0012-canonical-public-api-contract-ownership.md` — accepted.
- `0013-package-initial-release-and-nx-versioning.md` — accepted.
- `0014-renovate-and-dependabot-dependency-management.md` — accepted.

Relevant constraints: preserve independent package SemVer, public target and
executor names, repeat-safe init, host-neutral governance boundaries, and Nest
12 native tooling. HTTP adapter defaults and Fastify compatibility are outside
this change. The accepted local scaffolding contract remains additive; the
historical generation proposal does not authorize replacing the revived plugin.
The governance compatibility contract and package engineering documentation
were also reviewed. No accepted ADR conflict requires an amendment.

## Findings and implementation

- Nx 24 removes deprecated Jest, ESLint, Vite and Rollup executors. The official
  required migrations were run, including their manual review prompts. Five
  explicit Jest targets now rely on the existing Jest inference registrations;
  their options, environment, outputs and dependency relationships are retained.
  Obsolete ESLint executor defaults were removed; inferred lint inputs still
  include `tools/eslint-rules/**/*`.
- `affected.legacy: true` preserves the prior project-based affected selection,
  as recommended by Nx's compatibility migration. Adopting task-based affected
  selection is a separate change. Release pre-builds use the pinned local Nx.
- No local custom hashers, ultracache rename candidates, obsolete typed-linting
  defaults, file-server readiness targets or Vite helper migrations remained.
  Completed migration plans and generated agent prompts are not retained.
- Inferred Rollup secondary entries now modify static native `input` settings,
  including the native config argument of `withNx`, instead of injecting removed
  executor options into the Rollup command. Target overrides preserve inference.
  Custom source roots are resolved relative to the project. Dynamic configs and
  single-file outputs are preserved with manual instructions. Source package
  exports remain consumer-owned. Legacy executor support remains available on
  compatible older Nx hosts; `@nx/esbuild:esbuild` still exists in Nx 24.
- Governance exposes both its named inference hook/name and its default plugin
  object; TypeORM also exposes named hooks. Older Nx loaders otherwise attempt
  to mutate a frozen ESM namespace or miss default-only `createNodesV2` exports.
- Governance and TypeORM previously claimed Nx 19.0 despite importing an API
  introduced in 19.2. Their minimum is corrected to **19.2.0**, and all Nx support
  ceilings become `<25`. JS retains 21.6.4; Nest retains 23.2.0; the adapter
  retains 19.0. Neutral governance packages do not gain Nx dependencies.
- Host-owned `nx` and `@nx/devkit` are explicit peers for governance, TypeORM,
  the Nx adapter and JS; JS also peers on `@nx/js`. Broad regular dependencies
  could otherwise install a newer devkit inside an older host. The consumer
  matrix uses no overrides and asserts each plugin resolves the host versions.
- Nest installed-consumer tests use the installed `NX_VERSION`, and use static
  task logs for diagnostic assertions under Nx 24's summarized output.

## Consumer upgrade and release treatment

Align `nx` and first-party `@nx/*` packages and run Nx's official migrations
before upgrading executor-based workspaces. Retain the versions and runtime
requirements in the support matrix; there is no automatic Nx-major upgrade
inside these plugins' init generators.

The host-package peer change also requires consumers of governance, TypeORM,
the Nx adapter and JS to declare matching `nx` and `@nx/devkit` versions in their
workspace; JS additionally requires the matching `@nx/js`. This is a breaking
installation-contract change for those four packages. Existing aligned
workspaces retain runtime compatibility. Use the package manager to add any
missing peers at the workspace's existing Nx version, then run the usual plugin
init. Do not install an unqualified latest devkit into an older workspace.

Governance/TypeORM consumers on Nx 19.0 or 19.1 must migrate to at least 19.2.0
before installing the next plugin release. Treat this peer-floor correction as
a **breaking support change** in the independent package release notes and
Conventional Commit metadata. No package versions or published releases are
changed by this audit.

For an existing inferred Rollup target previously configured by the secondary
entry generator, move its secondary inputs into `rollup.config.*` and remove
`additionalEntryPoints` / `generateExportsField` from the inferred target's
options. Configure package exports explicitly when publishing. Existing source
entries are never overwritten; rerunning the generator for an existing entry
continues to fail safely. No automatic migration deletes consumer options or
rewrites dynamic tool configurations.

## Verification

The pre-upgrade Nx 23.2 build/test/lint/typecheck baseline passed after rerunning
the Nest tests outside the restricted process sandbox. The Nx 24 validation
commands are:

```sh
yarn nx run-many -t build test lint typecheck -p nx-js,nx-typeorm,nx-governance,governance-adapter-nx,governance-extension-nx,nx-nest --parallel=2
yarn nx run @anarchitecture-plugins/source:nx-compatibility
yarn nx run nx-nest-e2e:e2e --testPathPatterns='(discovery|configuration|esm-rspack|cjs-rspack|vitest|nx-library-linking)\.spec\.ts$'
```

Local results on Node 24.22.1: all seven packed-consumer lanes passed with normal
peer resolution and no overrides; Nx 24 plugin build/test/lint/typecheck tasks
passed; TypeScript 5.9 compatibility and the harness lint passed. The six selected
Nest installed-consumer suites passed (the library-linking suite was rerun after
fixing its summarized-output assertion). E2E project lint/typecheck also passed.
The broader, unrelated database and service integration scenarios were not run.

The packed-consumer matrix is a separate CI workflow. Its exact-version lanes
exercise real npm resolution, package entry points, repeated init, project graph
inference, governance/TypeORM executors, the live Nx adapter, and generated JS
build output. Nx 19.0 is adapter/extension only; JS starts at 21.6.4 and Nest at
23.2. The 23/24 lanes build real inferred Vite and Rollup entries. The separate
Nest scenarios cover native ESM/CJS builds, Rspack, Vitest, discovery,
configuration and Nx library linking. Coverage is sampled; it does not assert
that all Nx patches or Node versions were tested.

References: [Nx 24 release](https://github.com/nrwl/nx/releases/tag/24.0.0),
[Nx createNodes API compatibility](https://nx.dev/extending-nx/recipes/migrating-create-nodes),
and the installed Nx 24.0.1 migration implementations and package manifests.
