# Plugin Support Matrix

This matrix describes the next release built from this branch. Development and
primary CI use Nx **24.0.1**; older hosts are checked with packed packages in
isolated consumer workspaces.

| Plugin                                | Nx / `@nx/devkit`              | TypeScript    | TypeORM |
| ------------------------------------- | ------------------------------ | ------------- | ------- |
| `@anarchitects/nx-governance`         | `>=19.2.0 <25`                 | 5.9.x and 6.x | n/a     |
| `@anarchitects/nx-typeorm`            | `>=19.2.0 <25`                 | 5.9.x and 6.x | 1.x     |
| `@anarchitects/governance-adapter-nx` | `>=19 <25`                     | 5.9.x and 6.x | n/a     |
| `@anarchitects/nx-js`                 | `>=21.6.4 <25` (also `@nx/js`) | 5.9.x and 6.x | n/a     |
| `@anarchitects/nest`                  | `>=23.2.0 <25`                 | `>=6.0.0 <7`  | n/a     |

`@anarchitects/governance-extension-nx` has no direct Nx peer; its packed consumer
coverage follows the adapter. Neutral governance packages do not acquire an Nx
peer dependency.

The current Nest development line requires stable Nest CLI `>=12.0.0 <13` and
Node.js `^22.22.3 || ^24.15.0 || >=26.0.0`. See its
[compatibility contract](../packages/nest/README.md#compatibility).
The historical Nest **0.0.1** contract remains documented in its
[release notes](releases/nest-0.0.1.md); these changes do not retroactively change
published package manifests.

**Breaking installation change:** governance, TypeORM, the Nx adapter and JS
now declare host-owned `nx` / `@nx/devkit` as peers; JS also peers on `@nx/js`.
Declare matching versions in the consumer workspace. This prevents silently
installing a newer devkit underneath an older Nx host.

**Breaking support correction:** governance and TypeORM previously advertised
Nx 19.0, but use `createNodesFromFiles` / `createNodesV2`, introduced in Nx 19.2.
Their minimum is now 19.2.0. Upgrade older hosts before installing the next
release. This requires release notes and breaking-change version treatment.

## TypeScript 5 policy

TypeScript 5 remains supported for the current plugin release line while it
is supported by the TypeScript ecosystem. TypeScript 6 is supported now.
The current Nest runtime is an exception: its native schematic dependency
requires TypeScript 6, so it is excluded from the TypeScript 5 compatibility lane.
TypeScript 5 support will be deprecated in a future plugin release after the
relevant TypeScript 5 support window ends; that change will be documented in
the release notes and reflected here.

The repository may use different compiler versions for individual package
build and spec projects when required by their toolchain. That does not
change the published support policy above.

TypeScript 6 is the repository default for local development and the primary
CI build, test, and typecheck lane. CI also runs a dedicated TypeScript 5.9
compatibility typecheck using `tsconfig.ts5.json`; this compatibility lane is
temporary and will be removed when TypeScript 5 support is deprecated.

## Nx policy

The `<25` upper bound is intentional. Nx 25 support requires a new compatibility
pass. Keep `nx` and first-party `@nx/*` packages aligned in consumer workspaces.

The repeatable matrix covers Nx 19.0.0 (adapter/extension only), 19.2.0, 20.0.0, 21.6.4, 22.0.0, 23.2.0 and
24.0.1 on Node 24. It installs only the plugins supporting each host, runs init
twice, builds project graphs, executes governance and TypeORM tasks, reads the
live graph through the adapter, and builds generated JS entries. Nx 23/24 also
exercise Nest generation and real inferred Vite/Rollup builds. This is sampled
host compatibility, not a claim that every Nx patch, Node version or external
bundler combination is exhaustively tested.

Run `yarn nx run @anarchitecture-plugins/source:nx-compatibility`, optionally
with `--versions=23.2.0,24.0.1`. See the
[Nx 24 audit and migration notes](migration/nx-24-compatibility.md).

For NestJS applications, generated TypeORM integration supports
`@nestjs/typeorm` 11.0.1 and 12.0.1. NestJS TypeORM 11 may report a peer warning
with stable TypeORM 1.x because its published peer range only names the 1.x
development line; the integration is nevertheless covered by the plugin's
compatibility tests.
