# Nest minimatch security fix (#653)

Date: 2026-11-21. Status: implementation candidate; publication pending.

The candidate changes `@anarchitects/nest`'s direct dependency from exact
`minimatch` 9.0.5 to exact 11.0.9. Published 0.1.1 remains affected until a new
release is published. No new package version is reserved by this record.

## Advisory and compatibility review

The reported 9.0.5 pin is within the affected ranges of
[GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26),
[GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74),
[GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj), and
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The last affects versions `>=7.0.0 <11.0.1`, so upgrading within 9.x is
insufficient. Version 11.0.9 is outside all four reported ranges. This is a
dependency correction, not a demonstrated exploit in workspace registration.

The [upstream changelog](https://github.com/isaacs/minimatch/blob/v11.0.9/changelog.md)
records a new matching implementation and removal of regex/parser internals in
11.x. Registration uses only the named `minimatch` function, with `nonegate`
and `nocomment`; none of the removed APIs is used. Its POSIX-normalized patterns
and nonempty relative project roots retain the tested behavior. Empty path
segments, Windows UNC paths and arbitrary advanced globs are not newly certified.
The package still exposes CommonJS and ESM entry points. Its `20 || >=22`
Node engine includes every existing plugin-supported Node version, so plugin
engines, Nx peers, generator interfaces and defaults remain unchanged.
Registry metadata changes minimatch's license identifier from ISC to
BlueOak-1.0.0. It remains a separately installed dependency with its upstream
license; the Nest plugin's own MIT license and packaging are unchanged.

## Architecture preflight

All 29 Meta ADRs were reviewed at
`665fe6b4761e9ec6a8ec47f82d8059474bf28641`; the revision and full inventory were
rechecked for this scope. All seven local ADRs at baseline
`32e6b850f4948daeaa5dd4b2d162a04ed8f556ff` were reviewed, including historical
and proposed records. Applicable accepted constraints include upstream-first
dependency maintenance (Meta 0014/0018), compatibility and native Nest ownership
(local Nest 12 defaults), exact release authority (Meta 0013/0016/0017), packed
consumer evidence (Meta 0024), and nested product/host layouts (Meta 0026).
No conflict was identified. The proposed workspace-integration ADR does not
authorize wider integration changes. The historical generation proposal and
local proposed documentation ADR do not override accepted decisions.

## Validation

Local host: macOS arm64, Node 24.22.3, Yarn 4.17.0, Nx 24.0.1.

- `yarn nx run-many -p nx-nest -t build test lint typecheck`: passed;
  35 suites / 679 tests, including matching, exclusions, deferred registration,
  idempotence, generators and inference. Lint retained existing warnings.
- New registration cases cover npm arrays, Yarn arrays/objects and pnpm YAML;
  exact paths, globs, globstars, braces/extglobs, nested `apps/shop/api`, exclusion
  rejection without mutation, and repeated insertion of a new nested path.
- `yarn nx run nx-nest-e2e:e2e-ci--src/nest-scenarios/application-workspace.spec.ts`:
  passed. A clean Yarn node-modules install reads the packed manifest and
  resolves 11.0.9 from the plugin's location. Public generation creates
  `apps/shop/api` as project `api`, preserves dry-run/repeat safety, and runs
  native build/test/e2e/lint plus the README compile/serve/resource quickstart.
- `yarn nx run-many -p nx-nest-e2e -t lint typecheck`: passed.
- Frozen HTTP, optional-capability and packed-library lanes: all 36 cases have
  passing evidence across ten suites. The aggregate run passed 35 cases; Node 26
  Express CJS encountered `EADDRINUSE` during member HTTP startup. The isolated
  rerun passed without code changes. Commands:

  ```sh
  yarn nx run nx-nest-e2e:e2e --testPathPatterns='(http-(node22|node24|node26|npm|capability-.*)|packed-library-node.*)\.spec\.ts$' --maxWorkers=2
  yarn nx run nx-nest-e2e:e2e-ci--src/nest-scenarios/http-node26.spec.ts --testNamePattern='node26/yarn: runs express cjs' --runInBand
  ```

  These exercise the existing Node 22.22.3 / Nx 23.2.0, Node 24.21.0 /
  Nx 24.0.1 and Node 26.0.0 / Nx 24.0.1 lanes, including Yarn 4.17.0 and the
  Node 24 npm 11.19.1 HTTP lane. Existing documented Node 22 CJS Jest exclusions
  remain exclusions, not new passes.

- Workspace immutable install, changed-file formatting, and final `npm pack`
  inspection passed. The archive contains the patched manifest, README, license,
  generator registry and compiled registration utility.

Yarn registry unions and all six npm HTTP locks were refreshed from
package-manager-generated records. Registry integrity and strict peer checks
remain enabled. Nx's own minimatch dependency is separate and is not fixed or
declared safe by this change. This record is not a whole-tree clean audit.

## Release handoff

### CI execution follow-up

The first full no-Cloud CI run timed out with buffered E2E output. Instrumented
[run 44903029786](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/44903029786/job/136842735006)
confirmed useful work through the 45-minute affected-step deadline: 33 non-E2E
tasks and 41/43 Nest suites passed, with Node 24/22 unfinished and the other
three E2E projects not yet started. No completed Nest suite reported a failure.
The final command completed two seconds before cancellation. This establishes
an insufficient budget for that serial fallback, not a deadlocked test.

The no-Cloud path now selects E2E projects from the Nx affected graph, gives
each an isolated runner, and partitions Nest with Jest's four native shards.
The `main-ci` aggregate rejects failed/cancelled/missing scheduled jobs and accepts
an intentional empty selection. Existing Cloud execution, prerequisites, caching,
coverage and test deadlines remain. This orchestration scope re-enumerated and
read all 29 Meta ADRs at `665fe6b4761e9ec6a8ec47f82d8059474bf28641` and all seven
local ADRs. Accepted Meta 0015 requires affected selection, valid caching,
resource isolation and measured scheduling; no conflicting accepted decision
was identified. Proposed local integration/documentation ADRs remain proposed.

A Docker comparison used Node 24.21.0, Linux ARM64, two CPUs and 7 GiB memory.
Its initial container lacked init and HTTP cleanup waited on orphaned zombies;
the complete HTTP application matrix passed 8/8 in 2m43s under Docker's init.
The full comparison was interrupted for shared Docker disk capacity, with no
ENOSPC or OOM kills observed; it is not a full-suite pass or an x64 runner replica.
Use `docker run --init` and sufficient space for concurrent clean installations
when reproducing these suites. The owned diagnostic container was removed.

Workflow regression checks cover affected admission, all Nest partitions, future
E2E projects, failed/malformed selection, command argument forwarding, test exit
codes and aggregate failure/cancellation propagation. Hosted completion of the
new execution layout is tracked on PR #654; local checks alone do not establish
a green full CI run.

Local validation of the correction passed all six workflow regression tests,
actionlint and changed-file formatting. Actual Nx/Jest discovery verified that
the four shards contain 11, 11, 11 and 10 specs: their union is exactly the 43
unsharded specs with no duplicates. Four shards were selected after the native
three-way hash split concentrated five long HTTP suites in one shard. The worker
cap remains three; this is a measured repository fallback, not a universal shard
count or a claim that estimated timings replace hosted execution.

### Main-branch gate review (2026-11-21)

The active [main ruleset](https://github.com/anarchitects/anarchitecture-plugins/rules/8545626)
requires the GitHub Actions `main-ci` status and up-to-date branches. It also
requires PRs, linear history and squash merges, and blocks deletion/force pushes.
There is no separate legacy branch-protection configuration. The ruleset's
existing release-integration bypass remains unchanged.

`main-ci` is the only required status, but the independent Nx compatibility and
TypeORM/PostgreSQL workflows are not dependencies of it. Their failures therefore
do not block a merge through that status requirement. PostgreSQL uses workflow
path filters; making its raw matrix checks required would leave unrelated PRs
waiting for checks that never start. Prefer one complete aggregate gate using
reusable validation jobs, or separately required stable compatibility gates with
explicit successful not-applicable results. Do not require dynamic shard names.

The repository CodeQL workflow is `disabled_inactivity`; the API reports CodeQL
default setup as `not-configured`. The latest recorded analyses are from
2026-08-24, so an active system workflow listing is not current scan evidence.
Restore the existing CodeQL workflow and verify fresh PR analyses before enforcing
a security rule. Successful scan execution alone is not a finding-severity gate;
choose the repository's code-scanning rule and thresholds explicitly. This review
changes neither security settings nor branch-protection rules.

### Publication

Merge review and exact-candidate owner release authorization remain separate.
After the authorized release, verify the published manifest, installed direct
resolution, and publication workflow before closing #653's publication criterion.
No consumer override or package publication is performed by this change.
