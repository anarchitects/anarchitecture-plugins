# @anarchitects/nx-js

An Nx plugin that extends [`@nx/js`](https://nx.dev/packages/js) with first-class secondary entry point generation for JavaScript and TypeScript libraries.

It provides a generator that scaffolds secondary entry point source files and configures supported executor builds or inferred Vite/Rollup library builds. Custom and dynamic build configurations may require manual setup.

---

## Installation

Use `nx add` — the standard Nx way to adopt a plugin:

```bash
nx add @anarchitects/nx-js
```

Or install manually:

```bash
yarn add -D @anarchitects/nx-js
# or
npm install -D @anarchitects/nx-js
```

Compatibility: supports Nx `>=21.6.4 <25`, including Nx 23 and 24, and TypeScript
5.9.x and 6.x. See the [plugin support matrix](../../docs/support-matrix.md).

---

## Generators

### `secondary-entry-point`

Adds a secondary export path to an existing library.

```bash
nx g @anarchitects/nx-js:secondary-entry-point --project=<project> --name=<segment>
```

**Required options**

| Option      | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| `--project` | Name of the Nx library project to add the entry point to.             |
| `--name`    | Path segment for the new entry point (e.g. `feature`, `data/access`). |

**Optional options**

| Option          | Default | Description                         |
| --------------- | ------- | ----------------------------------- |
| `--buildTarget` | `build` | Name of the build target to update. |
| `--skipFormat`  | `false` | Skip formatting generated files.    |

#### What it does

The generator always runs these steps:

1. Validates `--project` and `--name`.
2. Normalizes `--name` into path-safe segments (e.g. `Data/Access` → `data/access`).
3. Creates source files in the library:
   - `src/<segment>/index.ts`
   - `src/<segment>/lib/<leaf-segment>.ts`
4. Fails if `src/<segment>/index.ts` already exists.
5. Updates the build target configuration based on the bundler in use (see table below).

#### Bundler behavior

| Bundler   | Executor              | What is updated | Mutation                                                                                                                        |
| --------- | --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `tsc`     | `@nx/js:tsc`          | `project.json`  | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`.                                       |
| `swc`     | `@nx/js:swc`          | `project.json`  | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`.                                       |
| `rollup`  | `@nx/rollup:rollup`   | `project.json`  | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`.                                       |
| `esbuild` | `@nx/esbuild:esbuild` | `project.json`  | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`.                                       |
| `vite`    | `@nx/vite:build`      | `vite.config.*` | Adds `"<segment>/index": "src/<segment>/index.ts"` to `build.lib.entry`. Converts `entry` from a string to an object if needed. |

**Inferred targets**

For libraries that use Project Crystal inference (no explicit `build` target in `project.json`), the generator detects the bundler by checking for its config file:

- `rollup.config.js|ts|mjs|mts|cjs|cts` → updates a static Rollup `input` string/map, including the native config argument of `@nx/rollup/with-nx`. The primary entry and custom settings are preserved. Package exports remain consumer-owned; add the secondary export when publishing.
- `vite.config.ts|mts|js|mjs|cjs|cts` → updates `build.lib.entry` directly.

Target overrides such as `dependsOn` do not disable inference detection. Dynamic
Rollup configurations are preserved with instructions for manual configuration.
Nx 24 removes the Rollup and Vite executors listed above; those rows
describe compatibility with older Nx workspaces. Run Nx's official migrations
before upgrading an executor-based workspace. Inferred esbuild/custom command
targets require manual configuration; the generator reports unsupported targets.

**Additional notes**

- `additionalEntryPoints` is deduplicated and sorted on every update.
- With a supported legacy executor, `generateExportsField` is set to `true` so Nx emits secondary exports in the built `package.json`.
- The generator never mutates the source `package.json` exports directly.
- Unknown executors are skipped with a warning so you can configure entry points manually.

#### Example

```bash
nx g @anarchitects/nx-js:secondary-entry-point --project=my-lib --name=feature
```

Created files:

```text
libs/my-lib/src/feature/index.ts
libs/my-lib/src/feature/lib/feature.ts
```

For `tsc`, `swc`, `rollup`, `esbuild` — `project.json` build options after the run:

```json
{
  "options": {
    "additionalEntryPoints": ["libs/my-lib/src/feature/index.ts"],
    "generateExportsField": true
  }
}
```

For `vite` — `vite.config.*` after the run:

```ts
entry: {
  index: 'src/index.ts',
  'feature/index': 'src/feature/index.ts',
}
```

---

## Development

Build:

```bash
yarn nx build nx-js
```

Test:

```bash
yarn nx test nx-js
```

Lint:

```bash
yarn nx lint nx-js
```

---

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) files.

### Nx host dependencies

Declare matching `nx` and `@nx/devkit` versions in your workspace. These are
peer dependencies so the plugin uses your existing host toolchain. When
upgrading from a release that installed devkit transitively, add it explicitly
at your workspace's Nx version before installing this release.
The matching `@nx/js` version is also a required peer dependency.
