# ADR: Nest projects participate fully in the Nx workspace lifecycle

- Status: Proposed; implementation and compatibility acceptance are pending.
- Date: 2026-11-20
- Scope: The portable `@anarchitects/nest` plugin and its supported consumers.
- Capability owner and technical maintainer: Johan. Ecosystem policy changes remain with the applicable Meta authority.
- Delivery: [Epic #646](https://github.com/anarchitects/anarchitecture-plugins/issues/646)
- Evidence and acceptance: [capability matrix](../guides/nest-nx-workspace-integration.md).

## Context

The published 0.1.1 plugin supplies native Nest generation, project discovery,
package-manager registration and build/start inference. Its applications, native
Nest members and independent Nx libraries receive different levels of tooling
integration. Running a generated application successfully does not establish
shared configuration, dependency graph correctness, task caching, library
consumption, deployable output or upgrade safety.

The review was prompted by a consumer, but the contract is generic. It covers
empty and established Nx workspaces, mixed frameworks, independent projects and
native Nest monorepos. It does not make Blueprint's product, DDD, database or
hosting choices defaults for unrelated consumers.

The [accepted first-party scaffolding ADR](adr-nest12-first-party-defaults-and-compatibility.md)
keeps native Nest schematics authoritative for framework code and assigns Nx
integration and additive overlays to this plugin. This proposal elaborates that
integration responsibility. It does not revive the
[historical generation proposal](adr-nest-generation-strategy.md), alter the
[HTTP default contract](adr-nest-http-platform-scaffolding.md), or replace
the shipped package README with unimplemented promises.

## Proposed decision

### 1. Maintain explicit ownership

| Owner                         | Responsibility                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Nest                          | Framework scaffolding, module and decorator semantics, adapters, native compiler/start behavior                                            |
| Nest Nx integration           | Discover and adopt Nest projects; integrate configuration; contribute accurate graph/task metadata; provide safe generators and migrations |
| Tool integrations             | TypeScript synchronization, test/lint/format capabilities and their Nx tasks through supported public integrations                         |
| Consumer workspace            | Tool selection, shared policies, project layout/names/tags, dependency strategy, application behavior and delivery choices                 |
| Optional organization tooling | Organization-specific layout, architecture taxonomy, governance, contract and delivery presets                                             |

Reuse official Nest scaffolding and supported Nx/tool APIs. Do not fork framework
templates or create competing implementations of existing tool integrations.
Package scripts and native CLI usage may coexist with Nx, but advertised Nx
commands must retain the promised task semantics. The core remains portable and
MIT-licensed under the repository's existing package exception.

### 2. Resolve workspace policy before generating changes

Inspect existing project ownership, manifests, package-manager settings, Nx
plugin scopes, target names, shared tooling and TypeScript linking model.
Describe the effective selection and conflicts before mutation.

For new project choices, resolve explicit invocation options first, applicable Nx
generator defaults next, then existing compatible workspace policy, then a
documented supported fallback. Existing user-owned configuration is a preservation
constraint: an option does not silently authorize replacing it. Conflicts require
an actionable diagnosis or an explicit, reviewed migration path. Non-interactive
invocations must make deterministic choices or fail before writes; no hanging
prompt or unannounced tool switch.

Integrate an existing root, package-based or shared-package configuration using
that tool's actual resolution rules. Do not assume every tool supports `extends`
or that all workspaces need root config files. Initialize a missing shared policy
only through documented setup behavior. Keep necessary project-specific overrides
local; do not duplicate a shared policy into every generated application.

This includes linting, formatting, TypeScript, tests, editor settings, ignore files
and generated documentation. In particular, a generated local Prettier config
must not accidentally shadow a selected shared policy. Respect existing formatter
selection and documented opt-outs; do not install a second formatter implicitly.

### 3. Compose projects and TypeScript deliberately

Support and document each admitted workspace model: package workspaces with
project references, supported legacy path aliases, independent configurations,
and native Nest owner/member projects. Preserve the active model and do not
silently convert it. Keep Nest compiler requirements local so browser and
framework-neutral packages remain unaffected.

Separate production, test and tooling compilation scopes where needed. Integrate
existing Nx synchronization for reference-based workspaces; do not create a
second reference-maintenance authority. Dependencies must be declared in their
owning packages through the workspace package manager. Do not rely on hoisting
to conceal missing declarations or peers.

Distinguish source-only, buildable and publishable libraries. Preserve externally
owned library builds, exports and releases. A mode is supported only with a proven
consumer path, including transitive dependencies, test transforms and runtime
resolution. The generator must not infer which application consumes a new library.
Once that dependency is explicitly declared, the selected supported compilation
model must work without undocumented consumer repairs.

### 4. Make graphs and task behavior trustworthy

Prefer deterministic, read-only, scoped inference through public Nx APIs. Graph
construction must not install packages, execute builds or mutate files. Use Nx's
existing JavaScript dependency analysis where sufficient; add dependencies only
for facts it cannot represent, with source evidence and incremental behavior.

Define target ownership and collision behavior across inferred targets, package
scripts, explicit project configuration and target defaults. Preserve Nx's actual
precedence rules. Validate resolved tasks rather than assuming registration means
the expected configuration won. Ordinary documented commands must not silently
lose caching, output restoration, prerequisite ordering or continuous behavior.

Model build, serve/watch/debug, test, lint, typecheck and formatting according to
their selected tools. Separate formatting/checking from mutating fix/write tasks.
Keep deploy, publish, database mutations and fresh external-state checks uncached.
Integration-test caching requires controlled, represented environment/fixtures.

Cacheable tasks must declare relevant source, dependency, toolchain, configuration,
environment and argument inputs and all required outputs. Prove restoration and
invalidation, not just task success. Shared native-owner builds may need broad
inputs initially; document this conservative choice and measure task granularity
before optimizing it. Validate affected selection and safe parallel execution
without requiring Nx Cloud connectivity or automatically configuring CI.

### 5. Define build and delivery boundaries

For every supported builder/library mode, document emitted entrypoints, module
format, assets, source maps, external runtime dependencies and output ownership.
Verify the declared output can run in a clean runtime environment. Reuse supported
Nx pruning/copying/packaging facilities where appropriate and preserve consumer
custom packaging. Unsupported custom builders receive precise manual-review
diagnostics, not a false success claim.

Application runtime dependencies are distinct from development tooling. No
deployment provider, container platform, telemetry service, release workflow or
secret is selected merely by generating or adopting a project. Optional integrations
remain explicit and independently tested.

### 6. Preserve customization through adoption and upgrades

Keep `init`, new-project generation, adoption and versioned migration distinct.
Initialization must not regenerate source or convert existing projects. Plan and
validate supported transforms before writes; dry-run and rejected preflight must
leave the Tree, filesystem, manifests and lockfile unchanged. Re-running supported
setup must be idempotent; new-project generation may reject an occupied destination.
Install callbacks run only after successful generation and honor skip-install.

Provide reviewed migrations when plugin-owned configuration or public behavior
changes, with documented rollback and consumer customization boundaries. Reuse
[epic #558](https://github.com/anarchitects/anarchitecture-plugins/issues/558)
for legacy Nx-to-native conversion; this proposal does not create a competing
converter or activate its separately deferred bulk migration.

### 7. Treat public usability and compatibility as part of the plugin

Schemas, Nx Console descriptions, errors and generated guides must match shipped
behavior. Generated documentation should explain workspace commands, configuration
ownership and supported production output without making a commercial service
the default operational path. Retain necessary upstream attribution and licenses.

Test the packed artifact, exported APIs, schemas, migrations and license material
in clean consumers. Publish exact supported and tested version/layout combinations;
an untested package manager, PnP layout, OS, framework or builder is not implicitly
supported. Retain public Nx API discipline and measure cold/warm graph overhead.

Resolve the current difference between Nx community-listing dependency guidance
and this plugin's tested `nx`/`@nx/devkit` peer strategy through a recorded
compatibility decision. Listing guidance is not evidence that the current runtime
is broken and does not authorize an untested dependency rewrite.

## Acceptance and rollout

The linked matrix defines capability IDs, positive/negative expectations,
evidence records, compatibility dimensions and phased work. Acceptance of this
ADR establishes the target contract, not a claim that every capability ships.
Each implementation slice requires current preflight, maintainer review and
focused packed-consumer evidence. Mark explicit limitations instead of treating
all tests or workspace combinations as passed.

The capability owner accepts technical readiness and separately authorizes any
release. Consumers separately authorize adoption. Ecosystem policy amendments
follow Meta authority. This proposal authorizes no publication, application
migration, CI rollout, framework-major upgrade or HTTP default change.

## Alternatives and consequences

- Retaining only native defaults plus build/start registration minimizes transforms
  but leaves workspace policy, library consumption and lifecycle integration to
  repeated consumer work. It does not meet the proposed full integration contract.
- Replacing native generation with custom templates gives uniform output but
  duplicates framework ownership and increases drift; rejected.
- Forcing one root toolchain/layout on all consumers simplifies tests but breaks
  legitimate package-based, mixed-framework and customized workspaces; rejected.
- Composing supported integrations adds compatibility and migration work. The
  benefit is consistent workspace behavior while preserving native Nest ownership.

## References

- [Nx plugins](https://nx.dev/docs/features/nx-plugins)
- [Nx project configuration and precedence](https://nx.dev/docs/reference/project-configuration)
- [TypeScript project linking](https://nx.dev/docs/kb/typescript-project-linking)
- [Sync generators](https://nx.dev/docs/concepts/sync-generators)
- [Migration generators](https://nx.dev/docs/kb/migration-generators)
- [Prettier configuration resolution](https://prettier.io/docs/configuration)
- [Nx plugin distribution guidance](https://nx.dev/docs/kb/publish-plugin)
- [Meta ADR-0015: task caching and distribution](https://github.com/anarchitects/anarchitecture-meta/blob/dd0bda9ca3692a45366fb3156ca7b57d5fdf5f0b/adr/0015-nx-task-caching-and-distributed-execution.md)
- [Meta ADR-0016: architecture and ownership](https://github.com/anarchitects/anarchitecture-meta/blob/dd0bda9ca3692a45366fb3156ca7b57d5fdf5f0b/adr/0016-sdlc-ownership-and-architecture-authority.md)
