import {
  GovernanceDependency,
  GovernanceProject,
  GovernanceWorkspace,
  Ownership,
  ProfileOverrides,
} from '../core/index.js';
import { AdapterWorkspaceSnapshot } from '../nx-adapter/types.js';

export function buildInventory(
  snapshot: AdapterWorkspaceSnapshot,
  overrides: ProfileOverrides = { projectOverrides: {} }
): GovernanceWorkspace {
  const projects: GovernanceProject[] = snapshot.projects.map((project) => {
    const override = overrides.projectOverrides[project.name] ?? {};
    const domain =
      override.domain ?? tagValue(project.tags, 'domain') ?? tagValue(project.tags, 'scope');
    const layer = override.layer ?? tagValue(project.tags, 'layer');

    const ownershipFromMeta = readOwnershipFromMetadata(project.metadata);
    const codeowners = snapshot.codeownersByProject[project.name] ?? [];

    const ownership: Ownership = resolveOwnership(
      ownershipFromMeta,
      override.ownershipTeam,
      codeowners
    );

    return {
      id: project.name,
      name: project.name,
      root: project.root,
      type: normalizeProjectType(project.type),
      tags: project.tags,
      domain,
      layer,
      ownership,
      metadata: {
        ...project.metadata,
        ...(override.documentation !== undefined
          ? { documentation: override.documentation }
          : {}),
      },
    };
  });

  const dependencies: GovernanceDependency[] = snapshot.dependencies.map((dep) => ({
    source: dep.source,
    target: dep.target,
    type: normalizeDependencyType(dep.type),
    sourceFile: dep.sourceFile,
  }));

  return {
    id: 'workspace',
    name: 'workspace',
    root: snapshot.root,
    projects,
    dependencies,
  };
}

function tagValue(tags: string[], prefix: string): string | undefined {
  const found = tags.find((tag) => tag.startsWith(`${prefix}:`));
  return found?.split(':').slice(1).join(':');
}

function normalizeProjectType(
  type: string
): 'application' | 'library' | 'tool' | 'unknown' {
  if (type === 'application' || type === 'app') return 'application';
  if (type === 'library' || type === 'lib') return 'library';
  if (type === 'tool') return 'tool';
  return 'unknown';
}

function normalizeDependencyType(
  type: string
): 'static' | 'dynamic' | 'implicit' | 'unknown' {
  if (type === 'static' || type === 'dynamic' || type === 'implicit') {
    return type;
  }
  return 'unknown';
}

function readOwnershipFromMetadata(
  metadata: Record<string, unknown>
): string | undefined {
  const direct = metadata.ownership;
  if (typeof direct === 'string' && direct) {
    return direct;
  }

  if (direct && typeof direct === 'object') {
    const team = (direct as Record<string, unknown>).team;
    if (typeof team === 'string' && team) {
      return team;
    }
  }

  return undefined;
}

function resolveOwnership(
  metadataTeam: string | undefined,
  overrideTeam: string | undefined,
  codeowners: string[]
): Ownership {
  const team = overrideTeam ?? metadataTeam;

  if (team && codeowners.length) {
    return {
      team,
      contacts: codeowners,
      source: 'merged',
    };
  }

  if (team) {
    return {
      team,
      contacts: [],
      source: 'project-metadata',
    };
  }

  if (codeowners.length) {
    return {
      contacts: codeowners,
      source: 'codeowners',
    };
  }

  return {
    source: 'none',
  };
}
