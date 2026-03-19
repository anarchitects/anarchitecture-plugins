# @anarchitects/nx-typeorm

Nx plugin for TypeORM integration in Nx backend applications and libraries.
It provides:

- `nx add` / `init` setup for minimal TypeORM dependencies.
- `bootstrap` scaffolding for app runtime datasource wiring and library
  infrastructure-persistence templates.
- inferred database targets via `createNodesV2`.
- thin executors that wrap TypeORM CLI workflows.

## Installation

Use `nx add` so the plugin installs and runs `init` automatically:

```bash
nx add @anarchitects/nx-typeorm
```

This registers the plugin in `nx.json` and installs minimal dependencies:
`typeorm` and `reflect-metadata`.

You can re-run initialization later:

```bash
nx g @anarchitects/nx-typeorm:init
```

## Generators

### `init`

```bash
nx g @anarchitects/nx-typeorm:init
```

- Registers `@anarchitects/nx-typeorm` in `nx.json > plugins`.
- Adds `typeorm` and `reflect-metadata`.

### `bootstrap`

```bash
nx g @anarchitects/nx-typeorm:bootstrap --project=api
```

For applications:

- generates runtime datasource in `src/data-source.ts`.
- generates compatibility re-export `src/typeorm.datasource.ts`.
- generates shared connection helper `tools/typeorm/connection-options.ts`.
- generates TypeORM CLI migration datasource
  `tools/typeorm/datasource.migrations.ts` and seeds under `tools/typeorm`.
- preserves an existing `tools/typeorm/datasource.migrations.ts` file.
- generates a DB-specific `env.example` with URL/discrete modes.
- patches `app.module.ts` only when the app has a Nest module file.

For libraries:

- generates `schema.ts` and `1700000000000_init_schema.ts` under
  `src/infrastructure-persistence` by default.
- supports overrides with:
  - `--schemaPath=<relative-path>`
  - `--migrationsDir=<relative-dir>`
- patches project metadata (`metadata.typeorm`) with schema/domain and paths.

Additional bootstrap dependencies are installed during bootstrap:
`ts-node`, `typeorm-ts-node-commonjs`, `typeorm-ts-node-esm`,
DB driver package for selected `--db`, and `@nestjs/typeorm` only for Nest
applications.

Supported `--db` values: `postgres`, `postgresql` (normalized to `postgres`),
`mysql`, `mariadb`, `sqlite`, `better-sqlite3`, `mssql`.

Generated app datasources support two connection modes:

- `DATABASE_URL`
- discrete `TYPEORM_*` variables

The generated helper rejects mixed mode (setting `DATABASE_URL` together with
`TYPEORM_*` connection variables) and throws clear validation errors when
required variables are missing.

## Inferred Targets

When TypeORM files are detected, the plugin infers:

- `db:migrate:generate`
- `db:migrate:run`
- `db:migrate:revert`
- `db:ensure-schema`
- `db:seed` (applications)

Compatibility aliases are also inferred:

- `typeorm:generate`
- `typeorm:run`
- `typeorm:revert`
- `typeorm:ensure-schema`
- `typeorm:seed` (applications)

## Executor Usage

Run inferred targets:

```bash
nx run api:db:migrate:run --transaction=each
nx run api:db:migrate:generate --name AddUsers
nx run api:db:migrate:revert --count=2
nx run data-access:db:ensure-schema
nx run api:db:seed --file tools/typeorm/seeds/index.ts
```

`generate` supports `--check` and compatibility alias `--driftCheck` (mapped to
TypeORM check mode).

CLI executors (`generate`, `run`, `revert`) select the TypeORM runner at
runtime:

- `moduleSystem=auto` (default): detect by nearest `package.json` `type`,
  then project tsconfig module mode, then fall back to CommonJS.
- `moduleSystem=commonjs`: force `typeorm-ts-node-commonjs`.
- `moduleSystem=esm`: force `typeorm-ts-node-esm`.
