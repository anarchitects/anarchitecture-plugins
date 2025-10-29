# @anarchitects/nx-typeorm

Nx plugin that gives Rails-like ergonomics for TypeORM projects. It wires common
TypeORM workflows into the Nx task system so you can run migrations, seeds, and
bootstrap new projects without leaving `nx`.

## Purpose

- Detect TypeORM-enabled projects and infer common Nx targets (run, revert,
  seed, ensure-schema).
- Provide thin executors that proxy TypeORM CLI commands through the active
  package manager.
- Scaffold applications or libraries with ready-to-use TypeORM wiring, seeds,
  and migration directories via `nx g @anarchitects/nx-typeorm:bootstrap`.

## Installation

```bash
yarn add -D @anarchitects/nx-typeorm
```

If you rely on TypeScript seeds or migrations, also add:

```bash
yarn add -D ts-node typeorm-ts-node-commonjs
```

## Usage

### Bootstrap a project

```bash
nx g @anarchitects/nx-typeorm:bootstrap api --withCompose
```

Creates TypeORM configuration files, seed/migration directories, and patches
`app.module.ts` (for Nest apps) to use `TypeOrmModule.forRootAsync`.

### Run migrations

```bash
nx run api:run --transaction=each
```

### Generate a migration

```bash
nx run api:generate --name AddUsers --driftCheck
```

### Revert migrations

```bash
nx run api:revert --count=1
```

### Ensure schema

```bash
DATABASE_URL=postgres://... nx run data-access:ensure-schema
```

### Seed data

```bash
nx run api:seed --file tools/typeorm/seeds/index.ts --export runSeed
```

Each executor forwards any extra CLI arguments to the underlying TypeORM tool,
making it easy to customize behavior.

## Functionality Overview

- **Executors**: `generate`, `run`, `revert`, `ensure-schema`, and `seed` wrap
  TypeORM commands with Nx-friendly ergonomics.
- **Generator**: `bootstrap` lays down TypeORM config, seeds, migrations, and
  Nest integration boilerplate.
- **Inference**: Detects TypeORM projects and auto adds sensible default targets
  when you run `nx graph` or `nx run` commands.

## Tasks

- `nx build nx-typeorm` – build the plugin.
- `nx test nx-typeorm` – run Jest unit tests.
