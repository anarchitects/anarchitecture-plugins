# @anarchitects/nest

An incubator for stable NestJS v12 integration with Nx. The portable core is
intended for eventual contribution to `@nx/nest`, rather than a permanent fork.

## Status

This package discovers Nest projects through the `@anarchitects/nest/plugin`
entrypoint. It does not yet infer targets or provide generators or executors.
Those features are tracked in
[epic #478](https://github.com/anarchitects/anarchitecture-plugins/issues/478).

## Compatibility

| Peer          | Supported range | Reason                                                                                              |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `nx`          | `>=23.2.0 <24`  | Initial validation uses the repository's Nx 23.2 baseline; older and future majors are not claimed. |
| `@nx/devkit`  | `>=23.2.0 <24`  | Keep the plugin API aligned with the installed Nx version.                                          |
| `@nestjs/cli` | `>=12.0.0 <13`  | Stable Nest v12 CLI only; prereleases and older majors are excluded.                                |

Use the same version of `nx` and `@nx/devkit`. Node.js must satisfy
`^20.19.0 || ^22.12.0 || >=24.0.0`, matching the Nx 23 runtime baseline.
The CLI peer establishes the framework tooling contract; the plugin does not
install or import the application's `@nestjs/core` or platform adapter.
Application dependencies remain owned by the Nest project.

These ranges establish the package contract. Full Nest v12 project-shape
validation is planned in #485; current coverage validates packaging, loading,
and project discovery.

## Installation and registration

Once a revived version is published, install it in an Nx workspace using:

```sh
yarn nx add @anarchitects/nest
```

The plugin has no init generator yet (#486), so registration is manual.
Add the entry to the existing `plugins` array in `nx.json`:

```json
{
  "plugins": ["@anarchitects/nest/plugin"]
}
```

Registration discovers `**/nest-cli.json` at the workspace root or in nested
directories. A config must have a sibling `package.json` or `project.json`;
configs without either are ignored, even if a parent directory has a manifest.
The config's directory becomes the Nx project root (`.` at the workspace root).
The plugin adds `nest` technology metadata and lets Nx's built-in plugins merge
project names and explicit configuration from the manifests.

Discovery uses filenames only; it does not parse or validate Nest config
contents, execute the Nest CLI, change the working directory, or write a cache.
Nest `sourceRoot`, `root`, and `projects` fields do not relocate the Nx project
or create separate child nodes. In Nest monorepo mode, this stage discovers the
directory containing `nest-cli.json`. There are no plugin options yet.

No targets are inferred at this stage. Subsequent issues add Nest-owned `build`
and `start` commands. Existing explicit targets remain unchanged.
Jest, Vitest, ESLint, and Oxlint remain the responsibility of their respective
Nx integrations.

Both the root and `/plugin` entrypoints provide compiled CommonJS JavaScript,
loadable with `require` or ESM `import`, plus TypeScript declarations. Workspace
development uses the repository's source export condition. Discovery uses only
public Nx APIs and Node filesystem reads. The plugin uses no
private Nx APIs, copied Nest templates, or historical plugin implementation.

## Development and release

```sh
yarn nx run-many -t build test lint typecheck -p nx-nest
yarn nx release --projects nx-nest --first-release --dry-run
```

The TypeScript, Jest, ESLint, and publish targets are inferred by the workspace's
existing Nx plugins. Tests depend on the build to verify the actual packed
artifact, including both entrypoints, the shipped declarations and license,
and discovery through Nx's project graph in a temporary consumer workspace.

The Nx project is `nx-nest`; the npm package is `@anarchitects/nest`. The existing
independent release configuration can version just this project. The manual
release workflow accepts `nx-nest`, and the publish workflow selects it from a
`nx-nest@<version>` tag. Packaging uses `packages/nest/package.json` and its
in-place `dist` directory. No publishing is performed as part of shell setup.

## License and upstream path

All new code under `packages/nest` is MIT-licensed under the adjacent
[LICENSE](./LICENSE), an explicit package-level exception to the repository's
root Apache-2.0 license. Contributions to this package must retain that license
and existing attribution so the core can be contributed to the MIT-licensed Nx
repository without a later relicensing step.

The architectural reference remains
[Nx PR #35551](https://github.com/nrwl/nx/pull/35551). Discovery follows its
config-directory and sibling-manifest rules, without its private Nx API or
target-cache dependencies. The deleted Anarchitects implementation is not restored.
