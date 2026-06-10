import type {
  GovernanceNodeInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { createNxCapabilities } from './capability.js';
import { readTagValue } from './tag-parsing.js';
import type { AdapterWorkspaceSnapshot } from './types.js';

export function toGovernanceWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  const nodes = snapshot.projects
    .map((project) => toNxGovernanceNode(project, snapshot))
    .sort((left, right) => left.id.localeCompare(right.id));
  const relations = snapshot.dependencies
    .map((dependency) => toNxGovernanceRelation(dependency))
    .sort((left, right) =>
      relationSortKey(left).localeCompare(relationSortKey(right))
    );

  return {
    workspaceRoot: snapshot.root,
    metadata: {
      sourceSystem: 'nx',
    },
    nodes,
    relations,
    ...(snapshot.diagnostics ? { diagnostics: snapshot.diagnostics } : {}),
    capabilities: createNxCapabilities({
      workspaceRoot: snapshot.root,
      snapshot,
    }),
  };
}

export function buildNxGovernanceNodeId(
  project: AdapterWorkspaceSnapshot['projects'][number]
): string {
  return project.name;
}

export function buildNxGovernanceRelationId(
  dependency: AdapterWorkspaceSnapshot['dependencies'][number]
): string {
  return `nx:${dependency.source}->${dependency.target}:${dependency.type}:${
    dependency.sourceFile ?? ''
  }`;
}

function toNxGovernanceNode(
  project: AdapterWorkspaceSnapshot['projects'][number],
  snapshot: AdapterWorkspaceSnapshot
): GovernanceNodeInput {
  const classification = projectClassificationFromProject(project);
  const node: GovernanceNodeInput = {
    id: buildNxGovernanceNodeId(project),
    name: project.name,
    kind: 'project',
    sourceSystem: 'nx',
    root: project.root,
    path: project.root,
    tags: project.tags ?? [],
    metadata: nxNodeMetadata(project),
  };

  if (classification) {
    node.classification = classification;
  }

  const ownership = projectOwnershipFromSnapshot(project, snapshot);
  if (ownership) {
    node.ownership = ownership;
  }

  return node;
}

function toNxGovernanceRelation(
  dependency: AdapterWorkspaceSnapshot['dependencies'][number]
): GovernanceRelationInput {
  return {
    id: buildNxGovernanceRelationId(dependency),
    sourceNodeId: dependency.source,
    targetNodeId: dependency.target,
    kind: 'dependency',
    metadata: nxRelationMetadata(dependency),
  };
}

function projectClassificationFromProject(
  project: AdapterWorkspaceSnapshot['projects'][number]
): GovernanceNodeInput['classification'] | undefined {
  const tags = project.tags ?? [];
  const domain = readTagValue(tags, 'domain');
  const layer = readTagValue(tags, 'layer');
  const scope = readTagValue(tags, 'scope');

  if (!domain && !layer && !scope && tags.length === 0) {
    return undefined;
  }

  return {
    ...(domain ? { domain } : {}),
    ...(layer ? { layer } : {}),
    ...(scope ? { scope } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

export function nxNodeMetadata(
  project: AdapterWorkspaceSnapshot['projects'][number]
): GovernanceNodeInput['metadata'] {
  return {
    nx: {
      projectType: project.type,
      root: project.root,
      ...(project.sourceRoot ? { sourceRoot: project.sourceRoot } : {}),
      tags: [...(project.tags ?? [])],
      targets: [...(project.targets ?? [])],
      ...(project.implicitDependencies &&
      project.implicitDependencies.length > 0
        ? {
            implicitDependencies: [...project.implicitDependencies],
          }
        : {}),
      ...(Object.keys(project.metadata).length > 0
        ? { projectMetadata: project.metadata }
        : {}),
    },
  };
}

export function nxRelationMetadata(
  dependency: AdapterWorkspaceSnapshot['dependencies'][number]
): GovernanceRelationInput['metadata'] {
  return {
    nx: {
      dependencyType: dependency.type,
      ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
      ...(dependency.metadata ?? {}),
    },
  };
}

function projectOwnershipFromSnapshot(
  project: AdapterWorkspaceSnapshot['projects'][number],
  snapshot: AdapterWorkspaceSnapshot
): GovernanceNodeInput['ownership'] {
  const metadataOwnership = asRecord(project.metadata.ownership);
  const contacts = uniqueStrings([
    ...(snapshot.codeownersByProject[project.name] ?? []),
    ...toStringArray(metadataOwnership?.contacts),
  ]);
  const team = asString(metadataOwnership?.team);

  if (contacts.length === 0 && !team) {
    return undefined;
  }

  return {
    ...(team ? { team } : {}),
    ...(contacts.length > 0 ? { contacts } : {}),
    source:
      (snapshot.codeownersByProject[project.name] ?? []).length > 0
        ? 'codeowners'
        : asString(metadataOwnership?.source) ?? 'project-metadata',
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function relationSortKey(relation: GovernanceRelationInput): string {
  return (
    relation.id ??
    `${relation.sourceNodeId}->${relation.targetNodeId}:${relation.kind ?? ''}`
  );
}
