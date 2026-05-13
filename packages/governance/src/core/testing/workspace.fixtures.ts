import type {
  GovernanceDependency,
  GovernanceProject,
  GovernanceWorkspace,
  Ownership,
} from '../index.js';

export const bookingTeamOwnership = {
  team: 'booking-team',
  contacts: ['@booking-team'],
  source: 'project-metadata',
} satisfies Ownership;

export const platformTeamOwnership = {
  team: 'platform-team',
  contacts: ['@platform-team'],
  source: 'project-metadata',
} satisfies Ownership;

export const coreTestProjects = [
  {
    id: 'booking-ui',
    name: 'booking-ui',
    root: 'libs/booking/ui',
    type: 'library',
    domain: 'booking',
    layer: 'ui',
    tags: ['scope:booking', 'type:ui'],
    ownership: bookingTeamOwnership,
    metadata: {
      documentation: true,
    },
  },
  {
    id: 'booking-domain',
    name: 'booking-domain',
    root: 'libs/booking/domain',
    type: 'library',
    domain: 'booking',
    layer: 'domain',
    tags: ['scope:booking', 'type:domain'],
    ownership: bookingTeamOwnership,
    metadata: {},
  },
  {
    id: 'platform-shell',
    name: 'platform-shell',
    root: 'apps/platform-shell',
    type: 'application',
    domain: 'platform',
    layer: 'app',
    tags: ['scope:platform', 'type:app'],
    ownership: platformTeamOwnership,
    metadata: {},
  },
] satisfies GovernanceProject[];

export const coreTestDependencies = [
  {
    source: 'booking-ui',
    target: 'booking-domain',
    type: 'static',
  },
  {
    source: 'platform-shell',
    target: 'booking-ui',
    type: 'static',
    sourceFile: 'apps/platform-shell/src/main.ts',
  },
] satisfies GovernanceDependency[];

export const coreTestWorkspace = {
  id: 'test-workspace',
  name: 'Test Workspace',
  root: '/virtual/workspace',
  projects: coreTestProjects,
  dependencies: coreTestDependencies,
} satisfies GovernanceWorkspace;

export const coreTestWorkspaceWithDanglingDependency = {
  id: 'edge-workspace',
  name: 'Edge Workspace',
  root: '/virtual/workspace',
  projects: coreTestProjects,
  dependencies: [
    ...coreTestDependencies,
    {
      source: 'booking-ui',
      target: 'missing-project',
      type: 'static',
    },
  ],
} satisfies GovernanceWorkspace;

export function findDanglingDependencies(
  workspace: GovernanceWorkspace
): GovernanceDependency[] {
  const projectIds = new Set(workspace.projects.map((project) => project.id));

  return workspace.dependencies.filter(
    (dependency) =>
      !projectIds.has(dependency.source) || !projectIds.has(dependency.target)
  );
}
