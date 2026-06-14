# Canonical Governance Graph Model

This document describes the plugin-side consumption view of the canonical
Governance graph model.

Community Governance owns the canonical model itself. Nx plugin packages in
this repository consume that model and compose Nx facts into it through public
Community contracts.

The canonical workspace shape comes from `@anarchitects/governance-core@0.4.1`:

```ts
interface GovernanceWorkspace {
  id: string;
  name: string;
  root: string;
  nodes: GovernanceNode[];
  relations: GovernanceRelation[];
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  metadata?: Record<string, unknown>;
}
```

## Core Model

- `nodes` are the governed items in the workspace graph.
- `relations` are the canonical relationships between those nodes.
- Governance Core is platform-independent. It does not expose Nx-specific
  `projects` or `dependencies` workspace fields.
- Canonical profile policy, ownership semantics, and applicability semantics
  remain Community-owned.

## Nx Mapping

- Nx project -> governance node
- Nx dependency graph edge -> governance relation
- Nx project node kind -> `kind: 'project'`
- Nx project node source system -> `sourceSystem: 'nx'`
- Nx dependency relation kind -> `kind: 'dependency'`
- Nx project metadata -> `node.metadata.nx`
- Nx dependency metadata -> `relation.metadata.nx`
- Nx ownership evidence may contribute to canonical `node.ownership` through
  Community-owned ownership contracts
- Nx graph availability and adapter-specific facts -> `capability:nx`

Not every Nx-tagged subject is automatically project-like. Infrastructure,
runtime, config, or asset-like subjects may remain non-project nodes, and
Community-owned applicability decides whether generic domain/layer findings are
in scope for them.

## Example

```ts
const workspace = {
  id: 'repo',
  name: 'repo',
  root: '/repo',
  nodes: [
    {
      id: 'apps/store',
      name: 'apps/store',
      kind: 'project',
      sourceSystem: 'nx',
      tags: ['domain:commerce', 'layer:app'],
      metadata: {
        nx: {
          projectType: 'application',
          root: 'apps/store',
          sourceRoot: 'apps/store/src',
          targets: ['build', 'test'],
        },
      },
      ownership: {
        team: '@anarchitects/commerce',
        contacts: ['commerce-team@anarchitects.dev'],
        source: 'project-metadata',
      },
    },
  ],
  relations: [
    {
      id: 'nx:apps/store->libs/shared-ui:static:apps/store/src/app.ts',
      sourceNodeId: 'apps/store',
      targetNodeId: 'libs/shared-ui',
      kind: 'dependency',
      metadata: {
        nx: {
          dependencyType: 'static',
          sourceFile: 'apps/store/src/app.ts',
        },
      },
    },
  ],
};
```

## Runtime References

Canonical findings, signals, recommendations, and summaries should use:

- `nodeId`
- `relationId`
- `relatedNodeIds`
- `relatedRelationIds`
- `subjectId`

They should not use project/dependency compatibility fields such as
`projectId`, `sourceProjectId`, `targetProjectId`, `relatedProjectIds`, or
`affectedProjects`.

## Cooperative Enrichment

Nx graph facts may enrich other Community facts, but only through:

- canonical nodes and relations
- declared capabilities
- extension-owned contracts
- host-level composition

The Nx host must not duplicate Community adapter discovery or Community
extension interpretation to achieve that enrichment.

## Root Package Compatibility

`@anarchitects/nx-governance` may remain a root package entrypoint
compatibility shell for published imports.

That package-entrypoint compatibility does not preserve or imply legacy
governance model compatibility.
