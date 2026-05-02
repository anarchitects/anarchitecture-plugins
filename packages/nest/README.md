# @anarchitects/nest

Nx plugin support for Nest workspaces, including the public
`@anarchitects/nest:init` generator.

## Installation

The preferred way to install and configure the plugin is:

```bash
yarn nx add @anarchitects/nest
```

`nx add` installs the plugin package and automatically executes the
`@anarchitects/nest:init` generator.

## Init Generator

The init generator is the workspace setup layer behind `nx add`. It prepares an
Nx workspace for Nest development and does not generate a Nest application.

## Purpose

`@anarchitects/nest:init` prepares an Nx workspace for Nest usage by:

- adding base Nest runtime dependencies
- adding Nest dev and tooling dependencies
- registering the `@anarchitects/nest` Nx plugin in `nx.json`
- keeping setup idempotent across repeated runs

## What It Does Not Do

The init generator does not:

- generate an application
- run `nest new`
- run `nest generate`
- execute Nest schematics
- execute the Nest CLI
- run `yarn install`, `npm install`, or `pnpm install`
- add Fastify, Zod, or SWC add-ons

## Nest v12 Prerelease Alignment

The current init flow is aligned with Nest v12 prerelease packages through
centralized constants and dependency groups in:

- `packages/nest/src/utils/nest-version.ts`
- `packages/nest/src/utils/nest-dependencies.ts`

The package currently tracks Nest prerelease alignment through those centralized
utilities. It does not claim stable Nest v12 support.

## Usage

Preferred install and setup flow:

```bash
yarn nx add @anarchitects/nest
```

Manual workspace setup via the init generator:

```bash
yarn nx g @anarchitects/nest:init
```

Explicit package manager preference:

```bash
yarn nx g @anarchitects/nest:init --packageManager=yarn
```

Skip `package.json` dependency updates:

```bash
yarn nx g @anarchitects/nest:init --skipPackageJson
```

Skip formatting:

```bash
yarn nx g @anarchitects/nest:init --skipFormat
```

Force managed Nest dependency versions to align with the centralized defaults:

```bash
yarn nx g @anarchitects/nest:init --forceVersions
```

## Options

| Option            | Type                  | Default | Description                                                                                              |
| ----------------- | --------------------- | ------: | -------------------------------------------------------------------------------------------------------- |
| `packageManager`  | `yarn \| npm \| pnpm` |  `yarn` | Preferred package manager setting for future Nest workspace integration. This does not execute installs. |
| `skipPackageJson` | `boolean`             | `false` | Skip `package.json` dependency updates.                                                                  |
| `skipFormat`      | `boolean`             | `false` | Skip formatting.                                                                                         |
| `forceVersions`   | `boolean`             | `false` | Align known Nest dependency versions to the plugin-managed values.                                       |

## Dependency Strategy

The init generator manages two dependency groups. Versions are controlled
centrally rather than hardcoded in the generator itself.

Runtime dependencies:

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `reflect-metadata`
- `rxjs`

Dev dependencies:

- `@nestjs/cli`
- `@nestjs/schematics`
- `@nestjs/testing`

## Idempotency

Running `@anarchitects/nest:init` multiple times is safe:

- missing managed dependencies are added
- existing dependency versions are preserved by default
- `--forceVersions` aligns known Nest dependencies
- plugin registration in `nx.json` is not duplicated
- unrelated dependencies and unrelated Nx configuration are preserved

## Relationship To The Application Generator

The init generator is the workspace setup layer. Application generation is a
separate capability and will build on this init setup when implemented.
