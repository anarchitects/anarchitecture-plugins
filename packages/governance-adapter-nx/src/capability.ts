import type { GovernanceCapability } from '@anarchitects/governance-core';

import {
  hasCanonicalOwnershipData,
  readCanonicalOwnershipFromProjectMetadata,
} from './ownership.js';
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

export const NX_CANONICAL_CAPABILITY_IDS = [
  'nx.project-graph',
  'nx.dependency-graph',
  'nx.project-metadata',
  'nx.project-tags',
  'nx.targets',
  'nx.inferred-targets',
  'nx.governance-profiles',
  'nx.ownership-evidence',
] as const;

export type NxCanonicalCapabilityId =
  (typeof NX_CANONICAL_CAPABILITY_IDS)[number];

export function createNxCapability(input: {
  workspaceRoot: string;
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability<GovernanceNxCapabilityData> {
  const projects = input.snapshot.projects
    .map((project) => ({
      name: project.name,
      root: project.root,
      ...(project.type ? { type: project.type } : {}),
      tags: [...readNxProjectTags(project)],
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

export function createNxCapabilities(input: {
  workspaceRoot: string;
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability[] {
  return [createNxCapability(input), ...createNxCanonicalCapabilities(input)];
}

export function createNxCanonicalCapabilities(input: {
  workspaceRoot: string;
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability[] {
  const capabilities: GovernanceCapability[] = [
    createProjectGraphCapability(input),
    createDependencyGraphCapability(input),
    createInferredTargetsCapability(input),
  ];

  const projectMetadataCapability = createProjectMetadataCapability(input);
  if (projectMetadataCapability) {
    capabilities.push(projectMetadataCapability);
  }

  const projectTagsCapability = createProjectTagsCapability(input);
  if (projectTagsCapability) {
    capabilities.push(projectTagsCapability);
  }

  const targetsCapability = createTargetsCapability(input);
  if (targetsCapability) {
    capabilities.push(targetsCapability);
  }

  const governanceProfilesCapability =
    createGovernanceProfilesCapability(input);
  if (governanceProfilesCapability) {
    capabilities.push(governanceProfilesCapability);
  }

  const ownershipCapability = createOwnershipCapability(input);
  if (ownershipCapability) {
    capabilities.push(ownershipCapability);
  }

  const ownershipEvidenceCapability = createOwnershipEvidenceCapability(input);
  if (ownershipEvidenceCapability) {
    capabilities.push(ownershipEvidenceCapability);
  }

  return capabilities.sort((left, right) => left.id.localeCompare(right.id));
}

function createProjectGraphCapability(input: {
  workspaceRoot: string;
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability {
  return {
    id: 'nx.project-graph',
    source: 'governance-adapter-nx',
    data: {
      workspaceRoot: input.workspaceRoot,
      projectCount: input.snapshot.projects.length,
      projects: input.snapshot.projects
        .map((project) => ({
          id: project.name,
          name: project.name,
          root: project.root,
          ...(project.type ? { type: project.type } : {}),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createDependencyGraphCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability {
  return {
    id: 'nx.dependency-graph',
    source: 'governance-adapter-nx',
    data: {
      dependencyCount: input.snapshot.dependencies.length,
      dependencies: input.snapshot.dependencies
        .map((dependency) => ({
          sourceProjectId: dependency.source,
          targetProjectId: dependency.target,
          type: dependency.type,
          ...(dependency.sourceFile
            ? { sourceFile: dependency.sourceFile }
            : {}),
        }))
        .sort(
          (left, right) =>
            left.sourceProjectId.localeCompare(right.sourceProjectId) ||
            left.targetProjectId.localeCompare(right.targetProjectId) ||
            left.type.localeCompare(right.type)
        ),
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createProjectMetadataCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const projects = input.snapshot.projects
    .map((project) => ({
      id: project.name,
      metadataKeys: Object.keys(project.metadata ?? {}).sort((left, right) =>
        left.localeCompare(right)
      ),
    }))
    .filter((project) => project.metadataKeys.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (projects.length === 0) {
    return null;
  }

  return {
    id: 'nx.project-metadata',
    source: 'governance-adapter-nx',
    data: {
      projectCount: projects.length,
      projects,
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createProjectTagsCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const projects = input.snapshot.projects
    .map((project) => ({
      id: project.name,
      tags: [...readNxProjectTags(project)],
    }))
    .filter((project) => project.tags.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (projects.length === 0) {
    return null;
  }

  return {
    id: 'nx.project-tags',
    source: 'governance-adapter-nx',
    data: {
      projectCount: projects.length,
      projects,
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createTargetsCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const projects = input.snapshot.projects
    .map((project) => ({
      id: project.name,
      targets: [...(project.targets ?? [])].sort((left, right) =>
        left.localeCompare(right)
      ),
    }))
    .filter((project) => project.targets.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (projects.length === 0) {
    return null;
  }

  return {
    id: 'nx.targets',
    source: 'governance-adapter-nx',
    data: {
      projectCount: projects.length,
      targetCount: projects.reduce(
        (total, project) => total + project.targets.length,
        0
      ),
      projects,
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createInferredTargetsCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability {
  const profileFiles = input.snapshot.governanceProfileFiles ?? [];

  return {
    id: 'nx.inferred-targets',
    source: 'governance-adapter-nx',
    data: {
      available: profileFiles.length > 0,
      profileGlob: 'tools/governance/profiles/*.json',
      profileCount: profileFiles.length,
    },
    metadata: {
      sourceSystem: 'nx',
      limitation:
        'The adapter reports Project Crystal inference inputs; target inference remains owned by the Nx host plugin.',
    },
  };
}

function createGovernanceProfilesCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const profiles = [...(input.snapshot.governanceProfileFiles ?? [])].sort(
    (left, right) => left.localeCompare(right)
  );

  if (profiles.length === 0) {
    return null;
  }

  return {
    id: 'nx.governance-profiles',
    source: 'governance-adapter-nx',
    data: {
      profileCount: profiles.length,
      profiles,
    },
    metadata: {
      sourceSystem: 'nx',
      profileGlob: 'tools/governance/profiles/*.json',
    },
  };
}

function createOwnershipCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const sources = new Set<string>();

  if (
    input.snapshot.projects.some((project) =>
      hasCanonicalOwnershipData(
        readCanonicalOwnershipFromProjectMetadata(project.metadata)
      )
    )
  ) {
    sources.add('project-metadata');
  }

  if (
    Object.values(input.snapshot.codeownersByProject).some(
      (contacts) => contacts.length > 0
    )
  ) {
    sources.add('codeowners');
  }

  const normalizedSources = [...sources].sort((left, right) =>
    left.localeCompare(right)
  );

  if (normalizedSources.length === 0) {
    return null;
  }

  return {
    id: 'capability:ownership',
    source: 'governance-adapter-nx',
    data: {
      source: normalizedSources[0],
      ...(normalizedSources.length > 1 ? { sources: normalizedSources } : {}),
    },
    metadata: {
      sourceSystem: 'nx',
    },
  };
}

function createOwnershipEvidenceCapability(input: {
  snapshot: AdapterWorkspaceSnapshot;
}): GovernanceCapability | null {
  const projects = Object.entries(input.snapshot.codeownersByProject)
    .filter(([, contacts]) => contacts.length > 0)
    .map(([projectId, contacts]) => ({
      id: projectId,
      contacts: [...contacts],
      source: 'codeowners',
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (projects.length === 0) {
    return null;
  }

  return {
    id: 'nx.ownership-evidence',
    source: 'governance-adapter-nx',
    data: {
      projectCount: projects.length,
      projects,
    },
    metadata: {
      sourceSystem: 'nx',
      evidenceSource: 'codeowners',
    },
  };
}

function readNxProjectTags(
  project: AdapterWorkspaceSnapshot['projects'][number]
): string[] {
  return [...(project.nxTags ?? project.tags ?? [])];
}
