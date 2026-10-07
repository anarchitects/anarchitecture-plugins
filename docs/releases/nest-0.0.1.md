# @anarchitects/nest 0.0.1

Released on **7 October 2026** as the revived stable NestJS v12 Project Crystal
MVP for [#488](https://github.com/anarchitects/anarchitecture-plugins/issues/488)
and [epic #478](https://github.com/anarchitects/anarchitecture-plugins/issues/478).

- npm: [`@anarchitects/nest@0.0.1`](https://www.npmjs.com/package/@anarchitects/nest/v/0.0.1), published with the `latest` dist-tag.
- GitHub: [`nx-nest@0.0.1`](https://github.com/anarchitects/anarchitecture-plugins/releases/tag/nx-nest%400.0.1).
- Source and npm `gitHead`: `5000a4d3a9cf2251a9fd0ed11af5972f030e2c0b`.
- Release method: the repository's manual release workflow created the release;
  npm publication was completed manually by the maintainer.

Versioning and publication are already complete. This record documents the
published artifact; it does not require another version bump or publication.
The generated GitHub changelog includes historical commits from the deleted
predecessor, including schematic generation. The scope below describes what
actually ships in the revived 0.0.1 package.

## Delivered scope

- Discover root and nested projects from `nest-cli.json` with a sibling
  `package.json` or `project.json`.
- Infer cacheable `build` and continuous, uncached `start` targets backed by
  the official Nest CLI, with configurable target names.
- Resolve effective TypeScript build configuration, inherited output paths,
  and cache inputs using public Nx and TypeScript APIs.
- Register inference with `nx add` or the idempotent `init` generator after
  validating stable Nest v12 dependency declarations.
- Ship CommonJS runtime entrypoints, TypeScript declarations, and an MIT license.

Nest owns framework behavior and scaffolding. Nx owns task orchestration and
caching. The plugin remains an incubator for eventual upstream contribution;
upstream acceptance and a migration path are not part of this release.

## Install and support contract

In an Nx workspace with stable Nest v12 dependencies:

```sh
yarn nx add @anarchitects/nest@0.0.1
```

For npm workspaces, use `npm exec -- nx add @anarchitects/nest@0.0.1`.
This invokes `init` and registers `@anarchitects/nest/plugin` in `nx.json`.

| Component                         | Published contract                | Release verification baseline  |
| --------------------------------- | --------------------------------- | ------------------------------ | -------- | --- | --------- | ---------------- |
| Node.js                           | `^20.19.0                         |                                | ^22.12.0 |     | >=24.0.0` | 24.21.0 on macOS |
| `nx` / `@nx/devkit`               | `>=23.2.0 <24`, aligned versions  | 23.2.0                         |
| `@nestjs/cli`                     | `>=12.0.0 <13`, stable only       | 12.0.0                         |
| Nest common/core/platform-express | App-owned stable v12 declarations | 12.1.2                         |
| TypeScript                        | `>=5.9.0 <7`                      | 6.0.3                          |
| Rspack                            | App-owned; optional               | 2.1.10 in the packed E2E suite |

The published runtime dependencies are `semver` (`^7.7.2`), `tslib` (`^2.3.0`),
and TypeScript. The plugin does not install framework application dependencies.
The baseline is evidence for specific combinations, not a claim that every
combination within the supported ranges has been tested.

## Known limitations

- Nest prereleases and majors other than v12, Nx below 23.2, and Nx 24 are
  outside the peer contract.
- Discovery creates one Nx project per `nest-cli.json`; Nest monorepo `projects`
  entries do not become separate Nx projects.
- Custom bundler output overrides and separately configured asset destinations
  require explicit Nx `outputs`.
- TypeScript solution references do not select additional builds or outputs.
- `init` checks declarations, not installed versions, and does not install or
  upgrade Nest dependencies.
- Only `init` is provided as a generator. Application, library, and resource
  generation, Fastify scaffolding, and organizational conventions are follow-up
  work. Historical schematic features are not restored.
- Test and lint targets belong to other integrations. Additional builders,
  platform adapters, and transports are outside the tested matrix.

See the [package documentation](../../packages/nest/README.md) for configuration
precedence, output fallbacks, supported layouts, and the public API boundary.

## Release verification

On 7 October 2026, npm metadata confirmed version and `latest` both resolve to
0.0.1, with the peer/dependency contract above. The registry artifact integrity is:

```text
sha512-cd7q6lyGxJ6HKA8gUzICLu5ypItstzsLQMBKLRCBYgNanFwNj0bMb3/VNRaIK12erwrMSedIqazgWFXZNmugaw==
```

A fresh temporary npm workspace used the `standalone-esm` application files from
[the E2E fixtures](../../packages/nest-e2e/src/fixtures.ts), with the versions
above, `reflect-metadata` 0.2.2, RxJS 7.8.2, and `@types/node` 24.10.1. All
dependencies were installed from npm; the plugin was installed through `nx add`,
without repository dependency links or source export conditions.

The published-package smoke check verified:

1. `npm exec -- nx add @anarchitects/nest@0.0.1` installs the package and registers inference.
2. Both runtime entrypoints load; the installed package reports version 0.0.1.
3. Repeating `npm exec -- nx g @anarchitects/nest:init --no-interactive` leaves `nx.json` unchanged.
4. `npm exec -- nx show project nest-release-smoke --json` exposes cacheable `build` and continuous, uncached `start`, with no inferred test/lint targets.
5. `npm exec -- nx build nest-release-smoke` emits `dist/main.js`; deleting `dist` and repeating the command restores the same output from the local cache.
6. `npm exec -- nx start nest-release-smoke` serves HTTP 200 with the fixture's expected JSON response on an ephemeral loopback port.

Repository validation uses:

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest
yarn nx e2e nx-nest-e2e
```

Build, unit/packed-consumer tests, lint, and typecheck passed using existing Nx
cache entries. All seven checks in the separate E2E suite passed in a fresh run
with loopback access. The suite exercises standalone ESM, CommonJS, nested
solution/custom output, tsc monorepo, and Rspack monorepo fixtures, plus dependency
baseline and invalid-adoption checks. Its HTTP checks require permission to
listen on loopback; a restricted sandbox blocks these with `listen EPERM`.
