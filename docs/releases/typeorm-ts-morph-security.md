# TypeORM ts-morph dependency fix (#655)

Date: 2026-11-24. Status: implementation candidate; publication pending.

## Dependency and compatibility decision

Update the plugin and workspace development dependency from `ts-morph@^22.0.0`
to `^28.0.0`. Yarn and a fresh installed consumer resolve:

```text
@anarchitects/nx-typeorm -> ts-morph@28.0.0
  -> @ts-morph/common@0.29.1 -> minimatch@11.0.9
```

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
affects minimatch `>=7.0.0 <11.0.1`.
[Upstream PR #1697](https://github.com/dsherret/ts-morph/pull/1697) supplies
the common-package fix. No overrides, resolutions, forks or consumer patches
are needed for this path. The package's Nx/devkit, ts-node and TypeORM peers
are unchanged. No generated-file migration or public generator/executor change
is required, so the consumer README's commands remain applicable.

Registry metadata checked with `npm view`:

- `ts-morph@28.0.0` depends on `@ts-morph/common@~0.29.0`.
- `@ts-morph/common@0.29.1` depends on `minimatch@^11.0.1`.
- Resolved `minimatch@11.0.9` requires Node `20 || >=22`. The existing
  TypeORM 1.0.0 peer already requires `^20.19.0 || ^22.13.0 || >=24.11.0`,
  which is stricter. This dependency change does not raise that runtime floor;
  consumers must also satisfy their selected Nx version's requirements.

The upstream common range still admits 0.29.0. An existing consumer lock that
already pins that version must refresh the affected dependency resolution and
verify common >=0.29.1 and minimatch >=11.0.1. A clean install was tested; an
arbitrary pre-existing lock is not certified by this result. Nx's independent
minimatch dependency remains outside this fix. This is not a whole-tree audit.

## Architecture preflight

Enumerated and read all 29 files under Meta `adr/` from the clean local `main`
checkout at `5d42ccbc8ed69f9c6b0bfce0d875b1dae5b80bc2`: records 0001–0026,
including both 0001 records, both 0008 records and `ADR-0001.md`. Enumerated
and read all seven local records under `docs/adr/` at Plugins starting revision
`4e5cf4d3f12ab4843a0c9494d22fff7850451022`: Nest generation strategy,
HTTP platform scaffolding, Nx workspace integration, Nest 12 first-party defaults,
package release/versioning, public documentation, and Modern Angular 22.
No other local ADR location was found. Reviewed AGENTS, CONTRIBUTING, the
TypeORM README, support matrix and PostgreSQL compatibility guide.

Applicable accepted decisions: Meta 0004/0018 keep the repair upstream;
0013 and the local release ADR preserve independent Conventional Commit
versioning (`fix(nx-typeorm)`); 0014 requires dependency compatibility review;
0015 requires accurate cache inputs and uncached registry/database checks;
0016/0017 retain owner release authority; 0024 requires actual packed artifacts
and executable consumer evidence. Angular, Nest and Modeling decisions do not
require runtime changes here. The local documentation and Nx workspace ADRs
remain proposed, and the Nest generation strategy remains historical. No
accepted architecture conflict was identified for this bounded dependency fix.

## Validation

Local host: macOS arm64, Node 24.22.3, Yarn 4.17.0, Nx/devkit 24.0.1,
TypeScript 6.0.3. Commands use `NX_DAEMON=false`,
`NX_ISOLATE_PLUGINS=false`, `NX_NO_CLOUD=true` locally.

- `yarn nx run-many -p nx-typeorm -t build,test,lint,typecheck --output-style=static`:
  passed, 25 suites / 161 tests. Coverage includes AST bootstrap edits,
  preserved entity registration in ESM/CJS, repeated workspace/datasource setup,
  unchanged migration snapshots, rejected inputs, discovery and CLI executors.
- `nx-typeorm:test-package` (required by `test`): verifies the actual packed
  dependencies/peers, README/LICENSE/NOTICE, public scaffold previews and
  existing-file safety. The dependency check resolves recursively from each
  package in the plugin-owned ts-morph tree, including nested installs.
- `yarn nx run nx-typeorm:test-inferred-consumer --output-style=static`:
  passed in a fresh Yarn 4.18.1 consumer using Nx 24.0.1, TypeScript 6.0.3,
  TypeORM 1.1.3 and ts-node 10.9.2. Both ESM and CJS pass source/compiled
  migration discovery, including compiled execution after removing source files.
  The installed dependency tree resolves common 0.29.1 and minimatch 11.0.9.
  The existing unrelated Nest fixture resolutions do not override this path.
- `yarn nx run @anarchitecture-plugins/source:nx-compatibility --versions=19.2.0 --output-style=static`:
  passed in a fresh npm consumer with the minimum Nx/devkit 19.2.0 host,
  TypeScript 5.9.3 and TypeORM 1.0.0; init idempotence, inference and executors.
- The new dependency guard was also run against a disposable install of
  `ts-morph@22.0.0`; it correctly rejects the original minimatch 9.x path.
- `PG_COMPAT_DATABASE_URL=postgres://compat:compat@127.0.0.1:<port>/compat PG_COMPAT_EXPECTED_MAJOR=18 yarn nx run-many -p nx-typeorm -t test-postgres,test-inferred-consumer --output-style=static`:
  passed against disposable PostgreSQL 18.7. Both ESM/CJS consumers pass
  pending/run/second-run/alias/ledger/revert checks before and after the host
  build, with compiled copies present, and with only compiled datasource and
  migrations available. The executor suite also passes schema idempotence,
  JSONB query, rollback and reapplication. PostgreSQL 16/17 remain hosted lanes;
  they were not rerun locally for this candidate.
- `yarn install --immutable`: passed with existing SWC/Nest peer warnings.
- Changed-file Prettier and `git diff --check`: passed.

The local archive retains the source manifest's **0.6.5** version for testing;
it is not the published 0.6.5 artifact and must not replace it. The verified
candidate archive integrity is:

```text
sha512-T3BAMq/qg1jOIyqm/+iSHjRTZWgVMKxa2aEA84Z6jP4o1enSqsoJbRn0go/7nD0zO3iDqSkvceaQGb/Fdx0xNg==
```

## Publication and consumer handoff

Implementation does not complete the issue's publication/adoption criteria.
After review, use the established owner-authorized Nx release workflow to select
a new patch version. Record the exact published version, tag, workflow result,
registry integrity, packed manifest and README. Repeat the original dependency
reproduction and fresh install against that registry artifact. Do not reuse the
local candidate hash as the hash of the newly versioned release.

The consumer then independently verifies its compatibility and dependency path
before resuming dependent work. No release, tag, publication or consumer cutover
is performed or claimed by this implementation.
