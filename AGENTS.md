<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Nx Plugin Implementation Workflow

- Prefer Project Crystal inference (`createNodesV2`) for convention-based targets; avoid writing explicit targets unless strictly required.
- Keep executors thin, deterministic, and tool-adapter focused. Heavy logic belongs in reusable utils.
- Keep generators idempotent, non-destructive, and minimal. Merge existing config instead of replacing it.
- Always preserve backward compatibility first. If behavior changes, provide migration logic and docs.
- Validate every plugin change through Nx tasks (`build`, `test`, `lint`) using the package manager-prefixed Nx command.
- Require tests for generators, executors, and inference behavior, including regression coverage for fixed bugs.
- Document install path using `nx add` and explain inference conventions, defaults, and precedence rules.
