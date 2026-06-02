import type {
  GovernanceDependencyInput,
  GovernanceNodeInput,
  GovernanceProjectInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { createNxCapability } from './capability.js';
import type { AdapterWorkspaceSnapshot } from './types.js';

export function toGovernanceWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  const projects = snapshot.projects.map((project) =>
    projectInputFromSnapshot(project, snapshot)
  );
  const dependencies = snapshot.dependencies.map((dependency) =>
    dependencyInputFromSnapshot(dependency)
  );

  return {
    workspaceRoot: snapshot.root,
    projects,
    dependencies,
    nodes: projects.map((project, index) =>
      nodeInputFromProjectInput(project, snapshot.projects[index])
    ),
    relations: dependencies.map((dependency, index) =>
      relationInputFromDependencyInput(dependency, index)
    ),
    ...(snapshot.diagnostics ? { diagnostics: snapshot.diagnostics } : {}),
    capabilities: [
      createNxCapability({
        workspaceRoot: snapshot.root,
        snapshot,
      }),
    ],
  };
}

function projectInputFromSnapshot(
  project: AdapterWorkspaceSnapshot['projects'][number],
  snapshot: AdapterWorkspaceSnapshot
): GovernanceProjectInput {
  return {
    id: project.name,
    name: project.name,
    root: project.root,
    type: project.type,
    tags: project.tags ?? [],
    metadata: project.metadata,
    ownership: projectOwnershipFromSnapshot(project, snapshot),
  };
}

function dependencyInputFromSnapshot(
  dependency: AdapterWorkspaceSnapshot['dependencies'][number]
): GovernanceDependencyInput {
  return {
    sourceProjectId: dependency.source,
    targetProjectId: dependency.target,
    type: dependency.type,
    sourceFile: dependency.sourceFile,
    ...(dependency.metadata ? { metadata: dependency.metadata } : {}),
  };
}

function nodeInputFromProjectInput(
  project: GovernanceProjectInput,
  snapshotProject: AdapterWorkspaceSnapshot['projects'][number]
): GovernanceNodeInput {
  const classification = projectClassificationFromInput(project);
  const metadata = {
    ...(project.metadata ?? {}),
    nx: {
      projectType: snapshotProject.type,
      targets: [...(snapshotProject.targets ?? [])],
    },
  };
  const node: GovernanceNodeInput = {
    id: project.id,
    name: project.name,
    kind: 'project',
    sourceSystem: 'nx',
    root: project.root,
    path: project.root,
    tags: project.tags ?? [],
    metadata,
  };

  if (classification) {
    node.classification = classification;
  }

  if (project.ownership) {
    node.ownership = project.ownership;
  }

  return node;
}

function relationInputFromDependencyInput(
  dependency: GovernanceDependencyInput,
  index: number
): GovernanceRelationInput {
  const metadata = {
    ...(dependency.metadata ?? {}),
    ...(dependency.type !== undefined
      ? { dependencyType: dependency.type }
      : {}),
    ...(dependency.sourceFile !== undefined
      ? { sourceFile: dependency.sourceFile }
      : {}),
  };

  return {
    id: `nx:${dependency.sourceProjectId}->${dependency.targetProjectId}:${
      dependency.type ?? 'dependency'
    }:${index}`,
    sourceNodeId: dependency.sourceProjectId,
    targetNodeId: dependency.targetProjectId,
    kind: 'dependency',
    metadata,
  };
}

function projectClassificationFromInput(
  project: GovernanceProjectInput
): GovernanceNodeInput['classification'] | undefined {
  const tags = project.tags ?? [];
  const domain = project.domain ?? readTagValue(tags, 'domain');
  const layer = project.layer ?? readTagValue(tags, 'layer');
  const scope = project.scope ?? readTagValue(tags, 'scope');

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

function projectOwnershipFromSnapshot(
  project: AdapterWorkspaceSnapshot['projects'][number],
  snapshot: AdapterWorkspaceSnapshot
): GovernanceProjectInput['ownership'] {
  const contacts = snapshot.codeownersByProject[project.name] ?? [];

  if (contacts.length === 0) {
    return undefined;
  }

  return {
    contacts,
    source: 'codeowners',
  };
}

function readTagValue(tags: string[], prefix: string): string | undefined {
  const matchingTag = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!matchingTag) {
    return undefined;
  }

  const value = matchingTag.slice(prefix.length + 1);
  return value ? value : undefined;
}
