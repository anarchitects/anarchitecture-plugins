# @anarchitects/nx-js

An Nx plugin that extends [`@nx/js`](https://nx.dev/packages/js) with first-class secondary entry point generation for JavaScript and TypeScript libraries.

It provides a single generator that scaffolds the source files for a secondary entry point and automatically wires it into the library's build target — for all bundlers `@nx/js` supports, including libraries that rely on inferred targets.

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

Compatibility: supports Nx `>=21.6.4 <23`.

---

## Generators

### `secondary-entry-point`

Adds a secondary export path to an existing library.

```bash
nx g @anarchitects/nx-js:secondary-entry-point --project=<project> --name=<segment>
```

**Required options**

| Option | Description |
| --- | --- |
| `--project` | Name of the Nx library project to add the entry point to. |
| `--name` | Path segment for the new entry point (e.g. `feature`, `data/access`). |

**Optional options**

| Option | Default | Description |
| --- | --- | --- |
| `--buildTarget` | `build` | Name of the build target to update. |
| `--skipFormat` | `false` | Skip formatting generated files. |

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

| Bundler | Executor | What is updated | Mutation |
| --- | --- | --- | --- |
| `tsc` | `@nx/js:tsc` | `project.json` | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`. |
| `swc` | `@nx/js:swc` | `project.json` | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`. |
| `rollup` | `@nx/rollup:rollup` | `project.json` | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`. |
| `esbuild` | `@nx/esbuild:esbuild` | `project.json` | Appends to `options.additionalEntryPoints[]`; sets `options.generateExportsField = true`. |
| `vite` | `@nx/vite:build` | `vite.config.*` | Adds `"<segment>/index": "src/<segment>/index.ts"` to `build.lib.entry`. Converts `entry` from a string to an object if needed. |

**Inferred targets**

For libraries that use Project Crystal inference (no explicit `build` target in `project.json`), the generator detects the bundler by checking for its config file:

- `rollup.config.js|ts|mjs|mts|cjs` → treated as rollup; entry points are written into `project.json`.
- `vite.config.ts|mts|js|mjs|cjs` → treated as vite; the config file is updated directly.

**Additional notes**

- `additionalEntryPoints` is deduplicated and sorted on every update.
- `generateExportsField` is forced to `true` so Nx emits secondary exports in the built `package.json`.
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

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
