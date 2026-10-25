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
