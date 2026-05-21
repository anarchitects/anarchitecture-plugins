# Generic TypeScript Adapter Usage

## Purpose

The Generic TypeScript Adapter is the first real non-Nx adapter for Governance.

Its job is to analyze a non-Nx TypeScript or JavaScript repository, normalize
that repository into canonical governance project and dependency data, and hand
that normalized data to Governance Core.

It is not an Nx replacement. `@anarchitects/nx-governance` remains the Nx
integration.

## Relationship to CLI, Core, and Nx Governance

The runtime boundary is:

```text
non-Nx TypeScript workspace
  -> package-manager workspace parser
  -> tsconfig parser
  -> project discovery and tag mapping
  -> static import graph
  -> project dependency mapping
  -> canonical GovernanceWorkspace data
  -> Governance Core
  -> agov output
```

Responsibilities are split as follows:

- The standalone CLI is the host.
- The TypeScript Adapter is the non-Nx analysis and normalization layer.
- Governance Core owns the canonical workspace and profile contracts and the
  governance evaluation logic.
- Nx Governance remains the Nx-specific integration.

## Current MVP Boundary

The TypeScript Adapter modules are implemented as deterministic library
building blocks.

The standalone CLI on this branch still exposes the manual generic workspace
path:

```bash
agov check --workspace <workspace.yaml|workspace.json> --profile <profile.json>
```

There is no implemented `--adapter typescript` CLI flag yet.

Use this document to understand:

- which non-Nx TypeScript workspace conventions the adapter supports
- how project discovery and tag mapping work
- which diagnostics the adapter emits
- what the future standalone TypeScript adapter execution path is expected to
  consume

For the currently executable CLI surface, see
[standalone-cli-usage.md](./standalone-cli-usage.md). For the generic manual
workspace schema, see
[generic-workspace-schema.md](./generic-workspace-schema.md).

## Supported Workspace Conventions

The MVP supports these package-manager workspace conventions:

- `pnpm-workspace.yaml`
- `package.json.workspaces` array form
- `package.json.workspaces.packages` object form

Examples:

### pnpm

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### npm or yarn

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

### npm or yarn object form

```json
{
  "workspaces": {
    "packages": ["apps/*", "packages/*"]
  }
}
```

The adapter normalizes workspace patterns and package roots deterministically.
Duplicate patterns and duplicate package roots are collapsed.

## Supported TypeScript Resolution

The MVP supports:

- `tsconfig.json`
- `tsconfig.base.json`
- `compilerOptions.baseUrl`
- `compilerOptions.paths`
- local `extends` chains using relative or absolute file paths

Example:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/customer": ["packages/customer/src/index.ts"],
      "@app/order/*": ["packages/order/src/*"],
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

Supported `extends` behavior is intentionally small:

- relative `extends` paths are supported
- absolute `extends` paths are supported
- circular `extends` chains are diagnosed deterministically
- package-name based `extends` resolution is not supported in this MVP

## Project Discovery Configuration

Project discovery is driven by deterministic glob rules over resolved workspace
package roots.

The current adapter config shape is:

```ts
type TypeScriptProjectDiscoveryConfig = {
  projects: Array<{
    pattern: string;
    name?: string;
    tags?: string[];
  }>;
};
```

Example:

```yaml
discovery:
  projects:
    - pattern: 'packages/*'
      name: '{segment:1}'
      tags:
        - 'type:library'
        - 'scope:{segment:1}'
    - pattern: 'apps/*'
      name: '{segment:1}'
      tags:
        - 'type:app'
```

Notes:

- Discovery runs against normalized workspace package roots, not arbitrary
  source folders.
- Matches are sorted deterministically.
- Duplicate project roots produce diagnostics.
- Duplicate project names produce diagnostics.
- Patterns with no matches also produce diagnostics.

## Tag Mapping

Tags remain simple strings for the MVP.

The supported placeholder syntax is limited to:

- `{segment:1}`
- `{segment:2}`
- and so on

The segment index is relative to wildcard captures in the matched discovery
pattern.

Example:

```yaml
projects:
  - pattern: 'packages/*/*'
    name: '{segment:1}-{segment:2}'
    tags:
      - 'scope:{segment:1}'
      - 'layer:{segment:2}'
      - 'type:library'
```

From those tags, the adapter also derives canonical governance fields when the
tag prefixes exist:

- `scope:<value>`
- `domain:<value>`
- `layer:<value>`

## Static Import Dependency Analysis

The MVP analyzes source files under discovered project roots and builds a
deterministic static import graph.

Supported source extensions:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`

Ignored by default:

- `.d.ts`
- `node_modules`
- `dist`
- `build`
- `coverage`
- `out`

Supported import forms:

- `import ... from '...'`
- `import type ... from '...'`
- `export ... from '...'`
- `export * from '...'`
- string-literal `import('...')`

Non-literal dynamic imports are diagnosed and ignored for deterministic MVP
analysis.

## Import-to-Project Mapping

The adapter maps file-level imports to project-level governance dependencies.

MVP behavior:

- relative imports may resolve to other discovered projects
- tsconfig path aliases may resolve to other discovered projects
- workspace package imports may resolve to other discovered projects
- intra-project imports are ignored
- external package imports are ignored for governance dependencies
- unresolved internal-looking imports produce diagnostics

The final output is canonical project dependency data suitable for
`GovernanceWorkspace.dependencies`.

## Deterministic Diagnostics

The TypeScript Adapter emits structured deterministic diagnostics instead of
throwing where practical.

Examples include:

- `governance.typescript_adapter.invalid_package_json`
- `governance.typescript_adapter.no_workspace_indicators`
- `governance.typescript_adapter.invalid_workspace_config`
- `governance.typescript_adapter.unsupported_workspace_format`
- `governance.typescript_adapter.no_workspace_packages_found`
- `governance.typescript_adapter.invalid_tsconfig`
- `governance.typescript_adapter.invalid_tsconfig_extends`
- `governance.typescript_adapter.circular_tsconfig_extends`
- `governance.typescript_adapter.invalid_path_alias`
- `governance.typescript_adapter.invalid_discovery_pattern`
- `governance.typescript_adapter.discovery_pattern_no_matches`
- `governance.typescript_adapter.duplicate_project_root`
- `governance.typescript_adapter.duplicate_project_name`
- `governance.typescript_adapter.invalid_tag_template`
- `governance.typescript_adapter.source_file_parse_error`
- `governance.typescript_adapter.unresolved_import`
- `governance.typescript_adapter.unresolved_internal_import`
- `governance.typescript_adapter.ambiguous_project_match`

Diagnostics are designed to remain stable in code, message intent, and JSON
pointer-style `path` fields.

## CLI Usage Today

Today, the standalone CLI executes against the generic manual workspace schema,
not directly against a TypeScript repository root.

Current command shape:

```bash
agov check \
  --workspace governance.workspace.yaml \
  --profile governance.profile.json \
  --format json
```

The current CLI also supports:

- `--format json|markdown|table`
- `--output <path>`
- `--fail-on none|warning|error`

See [standalone-cli-usage.md](./standalone-cli-usage.md) for runnable command
examples and [standalone-cli-command-surface.md](./standalone-cli-command-surface.md)
for the CLI contract.

## Practical Example Repository Shape

```text
package.json
tsconfig.base.json
apps/
  web/
    package.json
    src/
      main.ts
packages/
  customer/
    package.json
    src/
      index.ts
  order/
    package.json
    src/
      service.ts
  shared/
    package.json
    src/
      index.ts
```

Example imports that fit the MVP:

```ts
import { Customer } from '@app/customer';
import { OrderService } from '@app/order/service';
import { shared } from '@shared/index';
```

## Troubleshooting

If detection reports no supported workspace indicators:

- confirm `pnpm-workspace.yaml` or `package.json.workspaces` exists
- confirm `package.json` is valid JSON
- confirm you are pointing at the repository root

If tsconfig alias resolution fails:

- confirm `baseUrl` is set as expected
- confirm `paths` values are arrays of non-empty strings
- confirm alias targets point to real files
- confirm `extends` points to a local relative or absolute config file

If discovery produces no projects:

- confirm workspace package patterns actually match package roots
- confirm discovery patterns line up with package roots, not arbitrary folders
- confirm your `{segment:N}` placeholders reference real wildcard captures

If dependency mapping misses imports:

- confirm the imported file is inside a discovered project
- confirm the import is static or a string-literal dynamic import
- confirm unresolved internal-looking imports are not being mistaken for
  external packages

## MVP Limitations

This adapter intentionally stays narrow.

It does not currently provide:

- an implemented `agov --adapter typescript` host flow
- framework-specific Angular, React, or NestJS intelligence
- Bun workspace support
- Maven, Gradle, PHP, .NET, or Python adapters
- runtime dependency tracing
- bundler graph integration
- automatic package-manager discovery beyond the supported workspace files
- Nx project graph loading
- AI integrations

The adapter exists to produce deterministic canonical governance workspace data
for non-Nx TypeScript and JavaScript repositories while keeping Governance Core
platform-independent.
