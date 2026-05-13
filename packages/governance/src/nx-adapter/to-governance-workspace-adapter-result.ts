import type {
  GovernanceProjectInput,
  GovernanceWorkspaceAdapterResult,
} from '../core/index.js';

import type { AdapterWorkspaceSnapshot } from './types.js';

export function toGovernanceWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  return {
    workspaceRoot: snapshot.root,
    projects: snapshot.projects.map((project) => ({
      id: project.name,
      name: project.name,
      root: project.root,
      type: project.type,
      tags: project.tags,
      metadata: project.metadata,
      ownership: projectOwnershipFromSnapshot(project, snapshot),
    })),
    dependencies: snapshot.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
      sourceFile: dependency.sourceFile,
    })),
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
