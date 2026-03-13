# Anarchitects Nx Plugins

Nx plugin monorepo for architecture, governance, and developer workflow automation.

This repository publishes focused Nx plugins that improve monorepo maintainability through:
- convention-over-configuration
- inference-first targets (Project Crystal)
- thin executors and safe generators
- CI-friendly outputs and quality gates

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, quality gates, and contribution standards.

## Repository Overview

The workspace is organized as independent plugin packages under `packages/`.

| Plugin | Package | Purpose |
|---|---|---|
| Nx Governance | `@anarchitects/nx-governance` | Workspace governance-as-code: boundaries, ownership, architecture health, and scored reports. |
| Nx TypeORM | `@anarchitects/nx-typeorm` | TypeORM workflows for Nx: bootstrap, migration generate/run/revert, schema checks, and seeding. |
| Nx JS | `@anarchitects/nx-js` | Extensions around `@nx/js`, including secondary entry point generation for libraries. |

## Plugin Documentation

- Governance plugin: [packages/governance/README.md](packages/governance/README.md)
- TypeORM plugin: [packages/typeorm/README.md](packages/typeorm/README.md)
- JS plugin: [packages/js/README.md](packages/js/README.md)

## Install a Plugin

Use `nx add` as the preferred Nx-native installation path.

```bash
nx add @anarchitects/nx-governance
nx add @anarchitects/nx-typeorm
nx add @anarchitects/nx-js
```

If needed, you can also install with the package manager and run plugin generators explicitly.

## Workspace Development

Install dependencies:

```bash
yarn install
```

Run plugin tasks through Nx:

```bash
yarn nx build <project>
yarn nx test <project>
yarn nx lint <project>
```

Examples:

```bash
yarn nx build nx-governance
yarn nx test nx-typeorm
yarn nx lint nx-js
```

Run affected checks before opening a PR:

```bash
yarn nx affected -t build,test,lint
```

## Design Principles

All plugins in this monorepo should follow the same standards:
- Prefer inference (`createNodesV2`) when behavior can be derived from conventions.
- Keep executors deterministic and minimal; delegate heavy work to underlying tools.
- Keep generators idempotent and non-destructive.
- Preserve backward compatibility; provide migration support for behavioral changes.
- Ship tests and docs with every user-facing change.

See [AGENTS.md](AGENTS.md) and [.github/copilot-instructions.md](.github/copilot-instructions.md) for the full implementation playbook.

## License

MIT © Anarchitects
