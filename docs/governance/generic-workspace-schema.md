# Generic Workspace Schema

## Purpose

This document defines the schema for the standalone Governance CLI MVP manual
workspace input under epic #220 and issue #333.

The schema exists to prove that Governance Core can run outside Nx through an
explicit, platform-independent workspace file. It is intentionally small and
deterministic. It is not a source-code adapter, package-manager adapter, or Nx
graph replacement.

This schema is the manual input contract for the CLI host. Future adapters may
produce the same Governance Core workspace model without using this file format.

## Scope

The schema is designed to represent only:

- workspace identity
- projects
- governance tags
- explicit project-to-project dependencies

The schema does not attempt to discover or infer any of those facts.

## Non-goals

This schema does not include:

- source-code scanning
- TypeScript import graph analysis
- package-manager workspace discovery
- Nx graph loading
- framework-specific enrichment
- automatic dependency inference
- CLI implementation details
- redesign of Governance Core
- Maven, Gradle, PHP, .NET, or Python support

## YAML and JSON Compatibility

The schema is format-neutral. The same data model may be supplied as:

- `.yaml`
- `.yml`
- `.json`

Rules:

- YAML and JSON inputs must resolve to the same logical structure.
- YAML should stay within a JSON-compatible subset for deterministic behavior.
- Custom YAML tags, anchors, aliases, and merge keys are out of scope for the
  MVP.
- Object keys and string values are case-sensitive.

## Schema Versioning

`schemaVersion` is required and must be an integer.

Version rules:

- `1` is the only supported version for the MVP.
- A breaking schema change must use a new integer version.
- Unsupported versions are fatal validation errors.

## Normative Shape

```yaml
schemaVersion: 1
workspace:
  name: demo
  root: .
projects:
  - name: customer-domain
    root: src/customer/domain
    tags:
      - scope:customer
      - type:domain
    type: library
dependencies:
  - source: customer-domain
    target: order-domain
    type: static
```

## Top-level Fields

### Required top-level fields

| Field           | Type    | Rules                              |
| --------------- | ------- | ---------------------------------- |
| `schemaVersion` | integer | Must equal `1`.                    |
| `workspace`     | object  | See [workspace](#workspace).       |
| `projects`      | array   | Must contain at least one project. |
| `dependencies`  | array   | May be empty.                      |

### Optional top-level fields

There are no optional top-level fields in schema version `1`.

This is intentional. The top level stays closed to keep the MVP deterministic.
Unknown top-level fields are validation errors.

## `workspace`

The `workspace` object describes workspace identity only.

| Field  | Required | Type   | Rules                                      |
| ------ | -------- | ------ | ------------------------------------------ |
| `name` | yes      | string | Non-empty. Stable workspace name.          |
| `root` | no       | string | Normalized relative path. Defaults to `.`. |

Rules:

- `workspace.name` is the human-readable workspace identity for the manual
  schema.
- `workspace.root` is workspace-relative, not an absolute filesystem path.
- `workspace.root` must use `/` separators.
- `workspace.root` must not contain `..`, a leading `./`, a trailing `/`, or
  repeated `/`.

## `projects[]`

Each project is an explicit logical unit in the workspace.

| Field      | Required | Type             | Rules                                                                        |
| ---------- | -------- | ---------------- | ---------------------------------------------------------------------------- |
| `name`     | yes      | string           | Non-empty. Unique across all projects.                                       |
| `root`     | yes      | string           | Normalized relative path. Unique across all projects.                        |
| `tags`     | yes      | array of strings | May be empty. Tags must be unique within the project.                        |
| `type`     | no       | string           | One of `application`, `library`, `tool`, `unknown`. Defaults to `unknown`.   |
| `metadata` | no       | object           | Optional extension space. See [metadata conventions](#metadata-conventions). |

Rules:

- `projects[].name` is the only dependency reference key in schema version `1`.
- Project names are stable identifiers. Do not reference project roots in
  dependencies.
- `projects[].root` must follow the same path rules as `workspace.root`.
- The schema does not infer project type from tags or roots.
- No other first-class project fields are defined in version `1`.

## `dependencies[]`

Dependencies are explicit project-to-project edges.

| Field    | Required | Type   | Rules                                              |
| -------- | -------- | ------ | -------------------------------------------------- |
| `source` | yes      | string | Must match an existing `projects[].name`.          |
| `target` | yes      | string | Must match an existing `projects[].name`.          |
| `type`   | yes      | string | One of `static`, `dynamic`, `implicit`, `unknown`. |

Rules:

- Dependencies are manual declarations. No inference is performed.
- `source` and `target` must be different.
- Duplicate dependencies are invalid. A duplicate is the same
  `source` + `target` + `type` tuple appearing more than once.
- The schema does not define external dependencies in version `1`.

## Tag Conventions

Tags remain plain strings for MVP simplicity.

Schema rules:

- A tag must be a non-empty string.
- A tag must not have leading or trailing whitespace.
- Duplicate tags within a project are invalid.

Recommended convention:

- Use `prefix:value` strings.

Core-compatible conventions:

- `domain:<name>`: preferred domain classification tag.
- `scope:<name>`: fallback domain classification tag when no `domain:` tag is
  present.
- `layer:<name>`: layer classification tag.
- `type:<name>`: governance taxonomy tag only. It is not the same thing as the
  project `type` field.

Determinism rules for Core-oriented classification tags:

- At most one `domain:` tag per project.
- At most one `scope:` tag per project.
- At most one `layer:` tag per project.
- If both `domain:` and `scope:` are present, `domain:` wins for Core domain
  mapping. `scope:` remains preserved as a tag.

All other tag families are preserved as opaque strings.

## Metadata Conventions

Schema version `1` defines metadata only on `projects[]`.

Metadata rules:

- `metadata` must be an object when present.
- Metadata is optional extension space, not required MVP behavior.
- Metadata must not redefine or override first-class fields such as `name`,
  `root`, `tags`, or `type`.
- Unknown metadata is preserved but ignored by MVP schema validation beyond type
  checking.

Recommended convention:

- Use nested, namespaced objects owned by the producing team or tool.

Example:

```yaml
metadata:
  anarchitects:
    documentation: true
    ownerHint: platform
```

## Validation Rules

All validation failures are fatal for schema version `1`.

Supported validation codes:

| Code                                                     | Meaning                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `governance.workspace_schema.invalid_root`               | The document root is not an object.                                  |
| `governance.workspace_schema.missing_required_field`     | A required field is missing.                                         |
| `governance.workspace_schema.unknown_field`              | An unknown field is present.                                         |
| `governance.workspace_schema.invalid_field_type`         | A field has the wrong JSON/YAML type.                                |
| `governance.workspace_schema.invalid_value`              | A field value violates a non-enum schema constraint.                 |
| `governance.workspace_schema.unsupported_schema_version` | `schemaVersion` is not supported.                                    |
| `governance.workspace_schema.invalid_path`               | A path is empty, absolute, or not normalized.                        |
| `governance.workspace_schema.invalid_enum_value`         | A field value is outside the allowed enum.                           |
| `governance.workspace_schema.invalid_tag`                | A tag is empty, duplicated, or ambiguous for classification mapping. |
| `governance.workspace_schema.duplicate_project_name`     | Two projects use the same `name`.                                    |
| `governance.workspace_schema.duplicate_project_root`     | Two projects use the same `root`.                                    |
| `governance.workspace_schema.unknown_dependency_source`  | A dependency source does not match a project name.                   |
| `governance.workspace_schema.unknown_dependency_target`  | A dependency target does not match a project name.                   |
| `governance.workspace_schema.self_dependency`            | A dependency points to the same source and target.                   |
| `governance.workspace_schema.duplicate_dependency`       | The same dependency tuple appears more than once.                    |

Additional deterministic rules:

- Field validation order is:
  - top-level fields
  - `workspace`
  - `projects` in input order
  - `dependencies` in input order
- Cross-reference checks run only after project collection and uniqueness
  validation complete.
- Diagnostics should point to a JSON Pointer path such as `/projects/0/name`.

## Deterministic Ordering Expectations

The schema is semantically order-insensitive, but implementations should
normalize ordering before mapping to Governance Core or rendering output.

Canonical ordering:

- `projects`: sort by `name` ascending
- `projects[].tags`: sort lexicographically ascending
- `dependencies`: sort by `source`, then `target`, then `type`

Implementations should not:

- preserve arbitrary parser ordering as meaningful behavior
- inject filesystem-dependent ordering
- infer additional projects or dependencies during normalization

## Mapping to Governance Core Concepts

The manual schema maps to Governance Core as follows.

| Schema field                                           | Governance Core mapping                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `workspace.name`                                       | `GovernanceWorkspace.id` and `GovernanceWorkspace.name` |
| `workspace.root`                                       | `GovernanceWorkspace.root`                              |
| `projects[].name`                                      | `GovernanceProject.id` and `GovernanceProject.name`     |
| `projects[].root`                                      | `GovernanceProject.root`                                |
| `projects[].type`                                      | `GovernanceProject.type`                                |
| `projects[].tags`                                      | `GovernanceProject.tags`                                |
| `projects[].metadata`                                  | `GovernanceProject.metadata`                            |
| first `domain:<value>` tag                             | `GovernanceProject.domain`                              |
| first `scope:<value>` tag when no `domain:` tag exists | `GovernanceProject.domain` compatibility fallback       |
| first `layer:<value>` tag                              | `GovernanceProject.layer`                               |
| `dependencies[].source`                                | `GovernanceDependency.source`                           |
| `dependencies[].target`                                | `GovernanceDependency.target`                           |
| `dependencies[].type`                                  | `GovernanceDependency.type`                             |

Default mapping behavior:

- `workspace.root` defaults to `.`
- missing `projects[].type` maps to `unknown`
- missing `projects[].metadata` maps to `{}`
- ownership is not part of schema version `1`
- no CLI-only or Nx-specific concepts appear in the schema

## Valid YAML Example

```yaml
schemaVersion: 1
workspace:
  name: demo
  root: .
projects:
  - name: customer-domain
    root: src/customer/domain
    tags:
      - scope:customer
      - type:domain
    type: library
  - name: order-domain
    root: src/order/domain
    tags:
      - scope:order
      - type:domain
    type: library
dependencies:
  - source: customer-domain
    target: order-domain
    type: static
```

## Valid JSON Example

```json
{
  "schemaVersion": 1,
  "workspace": {
    "name": "demo",
    "root": "."
  },
  "projects": [
    {
      "name": "customer-domain",
      "root": "src/customer/domain",
      "tags": ["scope:customer", "type:domain"],
      "type": "library"
    },
    {
      "name": "order-domain",
      "root": "src/order/domain",
      "tags": ["scope:order", "type:domain"],
      "type": "library"
    }
  ],
  "dependencies": [
    {
      "source": "customer-domain",
      "target": "order-domain",
      "type": "static"
    }
  ]
}
```

## Invalid Examples

### Duplicate project name

```yaml
schemaVersion: 1
workspace:
  name: demo
projects:
  - name: customer-domain
    root: src/customer/domain
    tags:
      - scope:customer
  - name: customer-domain
    root: src/order/domain
    tags:
      - scope:order
dependencies: []
```

Expected validation error:

- `governance.workspace_schema.duplicate_project_name` at `/projects/1/name`

### Unknown dependency target

```yaml
schemaVersion: 1
workspace:
  name: demo
projects:
  - name: customer-domain
    root: src/customer/domain
    tags:
      - scope:customer
dependencies:
  - source: customer-domain
    target: order-domain
    type: static
```

Expected validation error:

- `governance.workspace_schema.unknown_dependency_target` at
  `/dependencies/0/target`

### Invalid path and dependency type

```yaml
schemaVersion: 1
workspace:
  name: demo
projects:
  - name: customer-domain
    root: /src/customer/domain
    tags:
      - ''
dependencies:
  - source: customer-domain
    target: customer-domain
    type: transitive
```

Expected validation errors:

- `governance.workspace_schema.invalid_path` at `/projects/0/root`
- `governance.workspace_schema.invalid_tag` at `/projects/0/tags/0`
- `governance.workspace_schema.self_dependency` at `/dependencies/0`
- `governance.workspace_schema.invalid_enum_value` at `/dependencies/0/type`

## Separation from Future Adapters

This schema is one manual input format for the standalone CLI MVP.

It should not be treated as:

- the future generic TypeScript adapter
- a package-manager workspace schema
- an Nx compatibility layer
- a generic source-code inventory protocol

Future adapters may discover richer data, but they should still map into the
same Governance Core workspace concepts instead of expanding this MVP schema by
default.
