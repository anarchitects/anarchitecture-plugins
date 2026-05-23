import type { GovernanceCapability } from '@anarchitects/governance-core';

import type { AdapterWorkspaceSnapshot } from './types.js';

export interface GovernanceNxCapabilityProject {
  name: string;
  root: string;
  type?: string;
  tags: string[];
  targets: string[];
}

export interface GovernanceNxCapabilityData {
  workspaceRoot: string;
  projects: GovernanceNxCapabilityProject[];
}

export function createNxCapability(input: {
  workspaceRoot: string;
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability<GovernanceNxCapabilityData> {
  const projects = input.snapshot.projects
    .map((project) => ({
      name: project.name,
      root: project.root,
      ...(project.type ? { type: project.type } : {}),
      tags: [...(project.tags ?? [])],
      targets: [...(project.targets ?? [])].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: 'capability:nx',
    data: {
      workspaceRoot: input.workspaceRoot,
      projects,
    },
  };
}
