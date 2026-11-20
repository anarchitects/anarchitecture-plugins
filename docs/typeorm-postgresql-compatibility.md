# TypeORM PostgreSQL compatibility

The reusable TypeORM plugin is not restricted to the PostgreSQL 16 version used by Anarchitects applications. The `TypeORM PostgreSQL compatibility` workflow runs the built plugin against disposable PostgreSQL 16, 17 and 18 services on Node 24.

The `nx-typeorm:test-postgres` target builds the plugin and exercises its actual ensure-schema, migration-run, query and migration-revert executors. It verifies the server major, schema and migration idempotence, JSONB writes and reads, migration-history bookkeeping, rollback and reapplication. Each run creates and removes a unique schema. It accepts only a loopback database URL and never connects to the Hetzner server.

```sh
PG_COMPAT_DATABASE_URL=postgres://compat:compat@127.0.0.1:5432/compat \
PG_COMPAT_EXPECTED_MAJOR=18 \
yarn nx run nx-typeorm:test-postgres --skip-nx-cache
```

Use a disposable local database. CI provides a fresh database for each major and runs without Nx result caching. Review the checks on the actual commit before claiming compatibility. This covers the committed TypeORM/pg versions and executor paths; it does not certify every driver version, generated application, database extension or operating system.

The integration test exposed an existing CLI-detection defect: resolving `typeorm/package.json` fails with TypeORM's export map. The detector now resolves the actual ESM/CommonJS runner file and retains the standalone-runner fallback. Unit regressions cover both module formats. No dependency versions, Nest defaults, package versions or release settings change. The fix uses the exact `nx-typeorm` Conventional Commit scope; publication remains a separate reviewed operation under the accepted versioning ADR.

## Fresh inferred-target consumers (#644)

`nx-typeorm:test-inferred-consumer` packs the local TypeORM and Nest plugins,
installs them into an independent Yarn workspace, and runs public generators
with a dry run first. It generates fresh ESM and CJS Nest applications and
bootstraps each with `--migrationDatasource`. No generated datasource, compiler
configuration or module mode is patched.

The fixture executes inferred `db:migrate:show` before and after the ordinary
Nest compile target. A closed loopback port must produce `ECONNREFUSED`, proving
that datasource loading progressed to the database connection. With
`PG_COMPAT_DATABASE_URL`, it also verifies pending/applied status, the compatibility
alias, migration execution, repeated-run idempotence, database table/history
state, and revert against an isolated schema. The PostgreSQL 16/17/18 workflow
runs this target alongside the existing executor compatibility suite.

```sh
PG_COMPAT_DATABASE_URL=postgres://compat:compat@127.0.0.1:5432/compat \
yarn nx run nx-typeorm:test-inferred-consumer --output-style=static
```

The target is uncached because it installs registry dependencies and reads live
database state. Direct reproduction dependencies are pinned; transitive registry
resolution can change. Omitting the database URL runs only the loader/compile
checks and explicitly reports that PostgreSQL lifecycle validation was skipped.

### Architecture preflight — 20 November 2026

Enumerated and read all **28 Meta ADR files** from the clean local Meta checkout
at `dd0bda9ca3692a45366fb3156ca7b57d5fdf5f0b`, including both 0001 records,
both 0008 records and `ADR-0001.md`, and all **six local ADRs** at Plugins
`31a5e31bdf00c4a408db5b59bf3fc9391a0ef165`. No other local ADR location was
found. Reviewed contributor instructions, the TypeORM consumer guide, support
matrix and PostgreSQL compatibility guidance for the affected scope.

- Meta 0004/0018 retain this fix in the upstream Nx integration package.
- Meta 0008/0009/0010/0022 and the accepted local Nest decisions preserve
  framework ownership, current HTTP defaults and evidenced ESM/CJS support.
- Meta 0013/0017 and the local release ADR retain independent versioning and
  owner-controlled publication. This change performs no release or version bump.
- Meta 0015 requires accurate task dependencies and uncached live database
  checks; the consumer target declares both plugin builds as prerequisites.
- Accepted Meta 0024 requires matching consumer guidance and packed evidence.
  The local public-documentation ADR remains proposed; the historical Nest
  generation proposal and governance proposals do not override accepted rules.
- Angular and Modeling policies were read but do not require changes to this
  Node/Nx tooling. No architecture conflict blocks the implementation.

### Observed regression and validation

The new inference and package-boundary unit tests fail on the original code.
Removing the forced runner fixes ESM loading and its PostgreSQL cycle. The fresh
CJS runtime check additionally exposes missing project compiler configuration
when the TypeORM CLI runs at the workspace root. Passing the detected project
tsconfig through the child process's `TS_NODE_PROJECT` fixes that case while
preserving an explicit environment override and workspace-relative CLI paths.
See [ts-node configuration](https://typestrong.org/ts-node/docs/configuration/)
for the underlying config lookup behavior.

Local validation uses macOS arm64, Node 24.22.3, Yarn 4.18.1, Nx/devkit/js 24.0.1,
TypeScript 6.0.3, Nest CLI 12.0.13, Nest runtime 12.5.1, Nest TypeORM 12.0.3,
TypeORM 1.1.3, ts-node 10.9.2 and pg 8.23.1, with PostgreSQL 18.6 in a disposable
Docker container. Both module modes pass datasource loading before/after compile
and migration status/run/idempotence/revert. This is local candidate evidence;
hosted PostgreSQL 16/17/18 results and publication remain separate outcomes.
