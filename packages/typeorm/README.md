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

Compatibility: supports Nx `>=19.2.0 <25`, including Nx 23 and 24, TypeScript 5.9.x and
6.x, and TypeORM 1.x. See the [plugin support matrix](https://github.com/anarchitects/anarchitecture-plugins/blob/main/docs/support-matrix.md#plugin-support-matrix).

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

- generates the connection options and runtime data source in
  `src/data-source.ts`. An existing file is reused if it exposes a named
  `AppDataSource` instance without connecting on import.
- generates `src/typeorm.datasource.ts` as a compatibility entry point.
- with `--migrationDatasource`, generates a CLI entry point in
  `tools/typeorm/datasource.migrations.ts` that reuses the runtime options
  and leaves schema synchronization off. An existing migration entry point
  is preserved when this option is enabled.
- generates a DB-specific `env.example` with URL/discrete modes.
- patches `app.module.ts` only when the app has a Nest module file.

The CLI loads entities and migrations declared in the data source options.
Nest's `autoLoadEntities` registration only applies inside the Nest app.

For libraries:

- generates `schema.ts` and `1700000000000_init_schema.ts` under
  `src/infrastructure-persistence` by default.
- supports overrides with:
  - `--schemaPath=<relative-path>`
  - `--migrationsDir=<relative-dir>`
- patches project metadata (`metadata.typeorm`) with schema/domain and paths.

For NodeNext projects, bootstrap uses emitted `.js` paths in ESM packages
(`"type": "module"`) and extensionless imports in CommonJS packages. This
applies to the app datasource imports and the library migration's schema import.

Additional bootstrap dependencies are installed during bootstrap:
`ts-node`, the DB driver package for selected `--db`, and `@nestjs/typeorm`
only for Nest applications. TypeORM 1.x provides the
`typeorm-ts-node-commonjs` and `typeorm-ts-node-esm` CLI binaries directly.

Supported `--db` values: `postgres`, `postgresql` (normalized to `postgres`),
`mysql`, `mariadb`, `better-sqlite3`, `mssql`.

For the generated `src/data-source.ts`, use `DATABASE_URL` (a file path or
`:memory:` for SQLite), or set the discrete connection fields
`TYPEORM_HOST`, `TYPEORM_PORT`, `TYPEORM_USERNAME`, `TYPEORM_PASSWORD`,
and `TYPEORM_DATABASE` as applicable. MySQL and MariaDB also accept
`TYPEORM_SOCKET_PATH` in discrete mode. Setting both modes throws an error
that lists the conflicting variable names. Driver settings such as
`TYPEORM_SCHEMA` and `TYPEORM_SSL` can accompany a URL. See the generated
`env.example` for driver defaults.

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

`migration-api` (alias: `migration-api-lib`)

```bash
nx g @anarchitects/nx-typeorm:migration-api --project=data-access --name="init users"
nx g @anarchitects/nx-typeorm:migration-api-lib --project=data-access --name="init users"
```

- library-only generator (fails for applications)
- generates migration files using TypeORM migration API (`QueryRunner`, `Table`,
  `TableColumn`, etc.) without raw SQL strings
- maintains migration state in
  `src/infrastructure-persistence/migrations/.nx-typeorm-migration-manifest.json`
- default behavior:
  - no file when entity snapshot is unchanged
  - new consolidated delta migration when entities changed
- options:
  - required: `--project`
  - required in `fileMode=new` (default): `--name`
  - optional: `--fileMode=new|patch-init` (default `new`)
  - optional: `--entityGlob=<glob-relative-to-project-root>`
    (default `src/infrastructure-persistence/entities/**/*.ts`)
  - optional: `--allowMixedMigrations` to opt into mixed manual/tool migration
    directories
  - optional: `--timestamp=<number>`
- safety behavior:
  - fails on unsupported/unresolvable decorators/options
  - fails when implicit naming cannot be resolved safely
  - fails on rename-like table/column diffs (manual migration required)
  - `patch-init` only patches bootstrap init migration
    `1700000000000_init_schema.ts` and is only allowed before any generated
    delta migration exists

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

Datasource-backed targets and their aliases leave module selection automatic.
The executor selects the runner when the target executes; inference does not
force CommonJS. Explicit `moduleSystem` values in Nx target defaults, project
target options or command-line options retain their normal Nx precedence.

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

- `moduleSystem=auto` (default): use the nearest `package.json` scope (`"type":
"module"` selects ESM; `"commonjs"` or an omitted `type` selects CommonJS).
  When no readable package scope exists within the workspace, use the project
  tsconfig module mode, then fall back to CommonJS.
- `moduleSystem=commonjs`: force `typeorm-ts-node-commonjs`.
- `moduleSystem=esm`: force `typeorm-ts-node-esm`.

For TypeScript datasources, the CLI uses the first existing project config in
this order: `tsconfig.app.json`, `tsconfig.lib.json`, `tsconfig.build.json`,
`tsconfig.json`, then a `tsConfig` path declared in project targets. An explicit
`TS_NODE_PROJECT` environment value takes precedence. CLI paths and migration
globs remain relative to the workspace root.

Updating the plugin fixes automatically inferred targets without rerunning
bootstrap or editing generated imports. Explicitly configured `moduleSystem`
overrides are preserved; remove an obsolete override or set it to `auto` to
restore detection. Keep emitted `.js` imports in NodeNext ESM source files.

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

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. The npm archive includes
`LICENSE` and `NOTICE` alongside this README. You can also read the
[license](https://github.com/anarchitects/anarchitecture-plugins/blob/main/LICENSE)
and [notice](https://github.com/anarchitects/anarchitecture-plugins/blob/main/NOTICE) online.

### Nx host dependencies

Declare matching `nx` and `@nx/devkit` versions in your workspace. These are
peer dependencies so the plugin uses your existing host toolchain. When
upgrading from a release that installed devkit transitively, add it explicitly
at your workspace's Nx version before installing this release.
Nx 19.0 and 19.1 must first be upgraded to at least 19.2.0.
