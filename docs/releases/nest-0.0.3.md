# @anarchitects/nest 0.0.3 release validation

Pre-release validation for [#556](https://github.com/anarchitects/anarchitecture-plugins/issues/556),
performed on 9 October 2026 from `docs/556-nest-public-readme`, based on main
`6453048f6677fb58c43229c4a54c13696302406c`. This is an internal validation record,
not a publication announcement. The canonical consumer documentation is
[the package README](../../packages/nest/README.md).

## Scope and evidence

The planned release includes independent Nx-native Nest libraries alongside
native Nest CLI members, workspace/TypeScript linking, artifact and resource
generation, and application consumption with Angular coexistence. Nest remains
stable v12-only. This documentation change does not alter production behavior.
The prerequisite issues #547 through #555 are closed. Final sign-off remains
conditional on the checks below and the PR's Linux CI result.

Validation uses Node 24.21.0, Yarn 4.17.0 with node-modules linking, Nx 23.2.0,
Nest CLI 12.0.0, Nest framework 12.1.2, and TypeScript 6.0.3 on macOS. These are
verification versions, not a replacement for the package's supported ranges.

| Gate                                                | Evidence                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository build/test/lint/typecheck                | Passed: 32 tasks across 10 projects (28 cache hits); Nest unit/packed-package tests: 31 suites, 483 tests.                                                                          |
| Full Nest E2E, including packed Angular coexistence | Passed: 23 suites, 31 tests, uncached, in 330 seconds.                                                                                                                              |
| Public quickstart                                   | Packed application/resource generation, native tests, inferred compile/serve metadata, and HTTP response are covered by `application-workspace.spec.ts`.                            |
| Library consumption                                 | Packed consumer scenarios cover workspace dependencies, source compilation, test transforms, runtime HTTP, graph edges, cache invalidation, and Angular configuration preservation. |
| Catalog/schema/documentation agreement              | `package.spec.ts` checks all generator names and aliases, documented flags/enums against packed schemas, declared compatibility ranges, and README identity.                        |
| Package contents                                    | `npm pack --json --ignore-scripts` produced 166 files; its README is byte-for-byte identical to `packages/nest/README.md`.                                                          |
| Release dry-run                                     | Explicit `0.0.3` resolves from tag `nx-nest@0.0.2`, previews the manifest update and `nx-nest@0.0.3` GitHub release, and exits successfully without publishing.                     |

Packed README SHA-256:

```text
01bcdd64289125b4e0cf4d0a7272df820fd030afc550d6a9f47aa3a46cab9730
```

The inspected archive is named `anarchitects-nest-0.0.2.tgz` because the checked-in
manifest intentionally remains at 0.0.2 until the release operation. It contains
the planned release's current code and documentation; it is not a published
0.0.3 artifact. The packed-package regression also compares the shipped README
directly with its source on future runs.

## Reproduction

From the repository root:

```sh
NX_NO_CLOUD=true NX_DAEMON=false yarn nx run-many -t build,test,lint,typecheck --parallel=2 --outputStyle=static
NX_NO_CLOUD=true NX_DAEMON=false yarn nx run nx-nest-e2e:e2e --skipNxCache --outputStyle=static
NX_NO_CLOUD=true NX_DAEMON=false yarn nx release 0.0.3 --projects=nx-nest --dry-run --skip-publish
```

Run the full unit and E2E suites sequentially to avoid competing heavy consumer
install/build workloads. Local validation uses bounded external execution:
20 minutes for repository checks, 30 minutes for the full E2E suite, and four
minutes for the release dry-run. Existing per-command and test limits remain
unchanged. CI retains Nx Cloud distribution and atomized Jest E2E targets.

Use the **explicit** release specifier `0.0.3`. The dry-run validates that planned
version; it does not claim conventional-commit inference chooses a patch release
despite the accumulated feature commits. The manual release workflow accepts
`projects=nx-nest`, `specifier=0.0.3`, and `first_release=false` after merge to main.
It currently skips npm publishing; publishing is a separate maintainer action.
No release workflow or publishing operation was triggered for this validation.

## Remaining boundaries

- Independent libraries initially export ESM TypeScript source. Consumer-owned
  compilation and decorator metadata are required; precompiled publication and
  default CJS/Jest source-package consumption are not promised.
- Workspace registration covers npm, Yarn, Bun, and pnpm, but the complete
  consumer validation uses Yarn's node-modules linker, not every package manager
  or Yarn PnP.
- Custom compiler, bundler, test, lint, and transport configurations remain
  consumer-owned as documented in the public README.
- Linux CI must be green before merge. Final publication requires validation of
  the versioned release artifact and registry metadata; this record is pre-release.
