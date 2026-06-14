# Canonical Governance Graph Model

This is the active plugin-side governance model for the Nx Governance packages.

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

## Nx Mapping

- Nx project -> governance node
- Nx dependency graph edge -> governance relation
- Nx project node kind -> `kind: 'project'`
- Nx project node source system -> `sourceSystem: 'nx'`
- Nx dependency relation kind -> `kind: 'dependency'`
- Nx project metadata -> `node.metadata.nx`
- Nx dependency metadata -> `relation.metadata.nx`
- Nx ownership facts -> canonical `node.ownership`
- Nx graph availability and adapter-specific facts -> `capability:nx`

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
        source: 'codeowners',
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

## Root Package Compatibility

`@anarchitects/nx-governance` may remain a root package entrypoint
compatibility shell for published imports.

That package-entrypoint compatibility does not preserve or imply legacy
governance model compatibility.
