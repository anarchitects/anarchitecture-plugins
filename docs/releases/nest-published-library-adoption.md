# Publishable-library adoption: Nest plugin release readiness

Preparation record for [#597](https://github.com/anarchitects/anarchitecture-plugins/issues/597)
under [#585](https://github.com/anarchitects/anarchitecture-plugins/issues/585),
reviewed on **14 November 2026**. The baseline is merged main
`6365a37438de5bf27a06ca08d187e7a5ab9c0511` after the four prerequisite slices.
This record prepares a candidate; it is not a publication announcement or owner
authorization. Consumer instructions live in the [package README](../../packages/nest/README.md).

## Candidate behavior and ownership

A standalone publishable library or mixed monorepo can adopt the plugin while
retaining verified bounded Nest 11/12 library peers, provided the actual tooling
host is compatible stable Nest 12. Initialization validates declarations and,
when broader peers are present, installed evidence from each declaring package.
Unsupported or unprovable combinations fail before configuration changes.

Existing `@nx/js:tsc` and custom library builds retain exports, declarations,
module formats, output directories and release ownership. Nest inference applies
to native Nest owners/members; it does not convert publishable packages or supply
a publishing pipeline. Source-only generated libraries still require consumer
compilation. Package/import metadata supplies graph edges; precompiled library
builds precede application builds, including an explicit `^build` dependency when
the Nest target is renamed to `compile`.

The design remains generic and upstream-portable: Nest owns framework templates,
configuration and compilation; Nx and existing tooling own orchestration,
packaging and release. The MIT plugin adds integration and preflight validation,
without application-specific policy, copied Nest templates, peer narrowing, or
Nx dependencies in published library runtime graphs. Upstream acceptance is not
claimed. Application migration remains in [#558](https://github.com/anarchitects/anarchitecture-plugins/issues/558),
framework upgrades are separate, and optional Fastify scaffolding remains in
[#508](https://github.com/anarchitects/anarchitecture-plugins/issues/508).

## Prerequisite evidence

All four implementation PRs are merged. These are observed successful runs on the
respective PR head commits, not assumptions based solely on merge status:

| Slice                                | Merged PR                                                               | Main CI                                                                                   | Nx compatibility                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #593: peer reproduction and contract | [#598](https://github.com/anarchitects/anarchitecture-plugins/pull/598) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43068113195) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43068113068) |
| #594: installed-host validation      | [#599](https://github.com/anarchitects/anarchitecture-plugins/pull/599) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43184669660) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43184669652) |
| #595: library build coexistence      | [#600](https://github.com/anarchitects/anarchitecture-plugins/pull/600) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43215693987) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43215693946) |
| #596: clean packed consumers         | [#602](https://github.com/anarchitects/anarchitecture-plugins/pull/602) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43613809380) | [Passed](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43613809409) |

The [compatibility guide](../guides/nest-published-library-compatibility.md)
records the detailed scenarios and cache checks. Its 21 peer/build/clean-consumer
tests passed locally, with Linux validation supplied by Main CI's affected,
atomized E2E run. Do not interpret a green workflow as a dedicated proof of remote
cache reuse or as coverage of every supported version combination.

Clean Yarn node-modules consumers sample Node 22.22.3 / Nx 23.2.0,
Node 24.21.0 / Nx 24.0.1, and Node 26.0.0 / Nx 24.0.1. Each uses TypeScript 6.0.3,
Nest CLI 12.0.0 and common/core/platform-express 12.1.2. Registry resolutions are
pinned, compared after install, and followed by immutable installation. The
runtime-only consumer proves import/require, root/secondary declarations and Nest
dependency injection before Nx is installed as development tooling.

## Current artifact validation

Local validation uses macOS arm64, outer Node 24.22.3, Yarn 4.17.0 and Nx 24.0.1.
The three compatibility lanes use their separately verified exact Node binaries.

| Gate                                                 | Observed result                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package build, unit/packed tests, lint and typecheck | Passed: 32 suites, 536 tests; 16 existing lint warnings, no errors.                                                                                                       |
| Updated packed README and public surface             | Passed: three focused package tests verify README equality, generator/schema examples and aliases, runtime/type export files and license.                                 |
| Clean packed candidate consumers                     | Passed again for this candidate: all six tests in the Node 22/24/26 lanes, including public exports/declarations, native tasks and runtime use without Nx.                |
| Archive inspection                                   | 168 files; intended README and MIT license present; all declared runtime/type exports exist; no source tree, spec files or build-info files included.                     |
| Peer preservation                                    | Packed CLI `>=12.0.0 <13`, Nx/devkit `>=23.2.0 <25`, unchanged from the manifest. Library dual-major peers remain unchanged in clean consumers.                           |
| Version and full release preview                     | Passed without an explicit version specifier; Nx derives a patch from `nx-nest@0.1.0`, previews `0.1.1`, its tag and GitHub changelog. Both commands ran in dry-run mode. |

The inspected `anarchitects-nest-0.1.0.tgz` contains the current candidate code and
updated README, with the intentionally unchanged development manifest version.
It is **not** the registry's existing 0.1.0 archive or a published 0.1.1 artifact.
The versioned release artifact must be checked again after the authorized version
operation. No tarball is committed to the repository.

Packed README SHA-256:

```text
f2a46fce32cda01166dff3adb7cfec9ca081bc6287237bc994206c08ada41d39
```

Candidate archive integrity (for this local build only):

```text
sha512-mZYbh/iouw7GxebrfqKEPjOipSpncY1jxSCMqXkqmxmsFwYP3EgpQzaEKO7DluTAQH7hiZ9JQUPNeUaSonAWyA==
```

Reproduce from the repository root, with registry access for clean consumers:

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest --output-style=static
yarn nx run nx-nest-e2e:e2e --runInBand --runTestsByPath src/nest-scenarios/packed-library-node22.spec.ts src/nest-scenarios/packed-library-node24.spec.ts src/nest-scenarios/packed-library-node26.spec.ts --output-style=static
yarn nx release version --projects=nx-nest --dry-run
yarn nx release --projects=nx-nest --dry-run --skip-publish
```

## Version authority and controlled handoff

Registry inspection on 14 November 2026 found versions `0.0.0-stage`, `0.0.1`,
`0.0.2`, `0.0.3` and `0.1.0`, with `latest` at `0.1.0`. Preserve that history;
this is not a first release. The checked-in manifest remains `0.1.0` and no
existing tag or registry artifact is rewritten.

Nx Conventional Commits and independent project releases remain authoritative.
The observed patch preview comes from the existing `fix(nx-nest)` change in #599;
it is not an arbitrary version assignment in this documentation slice. Use the
exact Nx project scope `nx-nest` for package commits; `docs` is non-bumping under
the current configuration. Do not add a version plan, use `--first-release`, or
force a historical initial version. Recompute the preview on the final merged
candidate if additional changes land.

After explicit owner authorization for this release, the current **Release
(Manual)** workflow can select `projects=nx-nest`, leave `specifier` empty to use
Conventional Commits, and retain `first_release=false`. Review the final preview
before dispatch. This preparation has dispatched no workflow and created no
release, tag, version commit or registry publication.

**Publishing a GitHub Release triggers npm publication in this repository.**
Although Release invokes Nx with `--skip-publish`, the App-token-created
`release: published` event triggers **Publish**, which validates the tag/package
version, builds, typechecks, tests and publishes via npm trusted publishing.
`--skip-publish` does not make a real Release dispatch a harmless preview.
The current [release handoff](../../CONTRIBUTING.md#release-publication-and-recovery)
supersedes historical runbook instructions that treated npm publication as an
unconnected manual step.

## Remaining gates and limits

- This documentation PR's CI must pass and the final merged candidate must retain
  the packaged/compatibility evidence above. Re-run affected checks and the Nx
  release preview if code, dependencies or policy change before release.
- Obtain explicit owner publication authorization. A request to prepare or merge
  these docs does not authorize the release workflow or npm publishing.
- Verify manifest, tag and versioned tarball agreement during the authorized
  release, then confirm npm version/dist-tag, exports, peers, README and the
  successful Publish run. Until then the registry's 0.1.0 does not gain this fix.
- Samples do not certify every Node/Nx/TypeScript version, OS, package manager,
  custom builder, HTTP adapter or optional integration. Clean-install lanes cover
  the `@nx/js:tsc` CommonJS library; conditional ESM/CJS custom builds have separate
  linked-dependency evidence. Lifecycle-script side effects and Yarn PnP are not
  certified. A plugin running on Nest 11 remains unsupported.
- Library authors own evidence for every advertised runtime major. A successful
  tooling preflight is not proof that an arbitrary library works on Nest 11/12.

## Architecture preflight

All 24 Meta ADRs were fetched again at
`b2cc857bef3ecc4180ca8180db015ba5537bc497`; every content matched the prior complete
review. All six local ADRs were enumerated and unchanged. Contributor/package
guides and both existing Nest release records were reviewed for this scope.

Accepted Meta 0004/0010/0012/0016 retain ownership, stable Nest 12 tooling and
runtime independence; 0008/0009 and the local HTTP ADR preserve adapter defaults;
0013/0017 and the local release ADR govern versioning and owner authority; 0015
governs cacheable, distributed validation. The accepted local Nest-first ADR
keeps native scaffolding with Nest. The generation-strategy record is historical,
and public-package documentation policy and Meta's Nest development guide remain
proposed. Their useful guidance does not override accepted decisions. Angular
policies are outside this Node/Nx documentation scope. No policy amendment,
compatibility expansion or architecture exception is introduced.
