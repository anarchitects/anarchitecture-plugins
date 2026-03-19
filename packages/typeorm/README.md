# @anarchitects/nx-typeorm

Nx plugin for TypeORM integration in Nx backend applications and libraries.
It provides:

- `nx add` / `init` setup for minimal TypeORM dependencies.
- `bootstrap` scaffolding for app runtime datasource wiring and library
  infrastructure-persistence templates.
- name-first scaffold generators for TypeORM file creation workflows.
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

### Scaffolding generators

These are convenience wrappers around existing executors. They are invoked
manually via `nx g` and are not inferred targets.

`migration-create` (alias: `migration`)

```bash
nx g @anarchitects/nx-typeorm:migration-create --project=api --name="add users"
nx g @anarchitects/nx-typeorm:migration --project=api --name="add users"
```

- required: `--project`, `--name`
- optional: `--directory` (relative to project root), `--outputJs`, `--esm`,
  `--timestamp`, `--args`
- default output directory:
  - app: `tools/typeorm/migrations`
  - lib: `src/infrastructure-persistence/migrations`

`entity-create` (alias: `entity`)

```bash
nx g @anarchitects/nx-typeorm:entity-create --project=api --name="user profile"
nx g @anarchitects/nx-typeorm:entity --project=api --name="user profile"
```

- required: `--project`, `--name`
- optional: `--directory` (relative to project root), `--args`
- default output directory:
  - app: `src/entities`
  - lib: `src/infrastructure-persistence/entities`

`subscriber-create` (alias: `subscriber`)

```bash
nx g @anarchitects/nx-typeorm:subscriber-create --project=api --name="user subscriber"
nx g @anarchitects/nx-typeorm:subscriber --project=api --name="user subscriber"
```

- required: `--project`, `--name`
- optional: `--directory` (relative to project root), `--args`
- default output directory:
  - app: `src/subscribers`
  - lib: `src/infrastructure-persistence/subscribers`

## Inferred Targets

When TypeORM files are detected, the plugin infers:

- `db:migrate:generate`
- `db:migrate:run`
- `db:migrate:revert`
- `db:migrate:show`
- `db:schema:sync`
- `db:schema:log`
- `db:cache:clear`
- `db:ensure-schema`
- `db:seed` (applications)

Compatibility aliases are also inferred:

- `typeorm:generate`
- `typeorm:run`
- `typeorm:revert`
- `typeorm:show`
- `typeorm:schema:sync`
- `typeorm:schema:log`
- `typeorm:cache:clear`
- `typeorm:ensure-schema`
- `typeorm:seed` (applications)

## Executor Usage

Run inferred targets:

```bash
nx run api:db:migrate:run --transaction=each
nx run api:db:migrate:generate --name AddUsers
nx run api:db:migrate:revert --count=2
nx run api:db:migrate:show
nx run api:db:schema:sync
nx run api:db:schema:log
nx run api:db:cache:clear
nx run data-access:db:ensure-schema
nx run api:db:seed --file tools/typeorm/seeds/index.ts
```

`generate` supports `--check` and compatibility alias `--driftCheck` (mapped to
TypeORM check mode).

Datasource-backed CLI executors (`generate`, `run`, `revert`,
`migration-show`, `schema-sync`, `schema-log`, `schema-drop`, `query`,
`cache-clear`) select the TypeORM runner at runtime:

- `moduleSystem=auto` (default): detect by nearest `package.json` `type`,
  then project tsconfig module mode, then fall back to CommonJS.
- `moduleSystem=commonjs`: force `typeorm-ts-node-commonjs`.
- `moduleSystem=esm`: force `typeorm-ts-node-esm`.

When `dataSource` is omitted, datasource-backed executors (`generate`, `run`,
`revert`, `migration-show`, `schema-sync`, `schema-log`, `schema-drop`,
`query`, `cache-clear`) and `ensure-schema` infer it from the project with
this priority:

1. `tools/typeorm/datasource.migrations.ts`
2. `tools/typeorm/datasource.migrations.js`
3. `src/data-source.ts`
4. `src/data-source.js`
5. `src/typeorm.datasource.ts`
6. `src/typeorm.datasource.js`

Override inference at any time with `--dataSource=<relative-or-absolute-path>`.

## TypeORM CLI Coverage

Inference is intentionally limited to convention-safe operational commands.
Scaffolding/meta commands (`migration:create`, `entity:create`,
`subscriber:create`, `version`, `init`) are executor-only and not inferred.

| TypeORM CLI command  | nx-typeorm executor | Inferred target |
| -------------------- | ------------------- | --------------- |
| `migration:create`   | `migration-create`  | no              |
| `migration:generate` | `generate`          | yes             |
| `migration:run`      | `run`               | yes             |
| `migration:revert`   | `revert`            | yes             |
| `migration:show`     | `migration-show`    | yes             |
| `schema:sync`        | `schema-sync`       | yes             |
| `schema:log`         | `schema-log`        | yes             |
| `schema:drop`        | `schema-drop`       | no              |
| `query`              | `query`             | no              |
| `cache:clear`        | `cache-clear`       | yes             |
| `entity:create`      | `entity-create`     | no              |
| `subscriber:create`  | `subscriber-create` | no              |
| `version`            | `version`           | no              |
| `init`               | `init`              | no              |

Manual-only executors are available for explicit wiring in `project.json`.
This includes risky commands (`query`, `schema:drop`) and non-inferred
scaffolding/meta commands from the table above.

Example manual targets:

```json
{
  "targets": {
    "db:query": {
      "executor": "@anarchitects/nx-typeorm:query",
      "options": {
        "projectRoot": "apps/api",
        "query": "SELECT 1"
      }
    },
    "db:schema:drop": {
      "executor": "@anarchitects/nx-typeorm:schema-drop",
      "options": {
        "projectRoot": "apps/api"
      }
    }
  }
}
```
