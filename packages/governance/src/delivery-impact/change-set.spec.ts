import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { GovernanceProject, GovernanceWorkspace } from '../core/index.js';

import {
  buildFeatureImpactAssessmentFromChangeSet,
  resolveChangeSetProjectMapping,
  type ChangeSetInput,
} from './change-set.js';

describe('delivery-impact change-set contracts', () => {
  it('builds feature impact assessment from generic change-set input when changed projects are provided', () => {
    const assessment = buildFeatureImpactAssessmentFromChangeSet({
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['alice'],
        }),
      ]),
      changeSet: {
        id: 'feature-billing-ui',
        source: 'git',
        baseRef: 'main',
        headRef: 'feature/billing-ui',
        changedFiles: ['libs/billing-ui/src/a.ts', 'libs/billing-ui/src/b.ts'],
        changedProjects: ['billing-ui'],
      },
    });

    expect(assessment).toEqual({
      id: 'feature-billing-ui',
      baseRef: 'main',
      headRef: 'feature/billing-ui',
      changedFiles: ['libs/billing-ui/src/a.ts', 'libs/billing-ui/src/b.ts'],
      changedProjects: ['billing-ui'],
      affectedProjects: ['billing-ui'],
      affectedDomains: ['billing'],
      affectedTeams: ['@org/billing'],
      affectedRules: [],
      impactRadius: 1,
      deliveryRisk: 'low',
      recommendedReviewStakeholders: ['@org/billing', 'alice'],
      drivers: [
        {
          id: 'feature-impact-radius',
          label: 'Feature impact radius',
          value: 1,
          unit: 'count',
          explanation: '1 affected project across 1 domain.',
        },
        {
          id: 'feature-review-stakeholder-spread',
          label: 'Feature review stakeholder spread',
          value: 2,
          unit: 'count',
          explanation: '2 review stakeholders should be involved.',
        },
      ],
    });
  });

  it('de-duplicates changed projects deterministically and preserves sorted changed files', () => {
    const assessment = buildFeatureImpactAssessmentFromChangeSet({
      workspace: createWorkspace([
        project('billing-ui', { domain: 'billing', team: '@org/billing' }),
        project('payments-api', { domain: 'payments', team: '@org/payments' }),
      ]),
      changeSet: {
        changedFiles: ['b.ts', 'a.ts', 'b.ts'],
        changedProjects: ['payments-api', 'billing-ui', 'billing-ui'],
      },
      affectedProjects: ['payments-api', 'billing-ui'],
    });

    expect(assessment.changedProjects).toEqual(['billing-ui', 'payments-api']);
    expect(assessment.changedFiles).toEqual(['a.ts', 'b.ts']);
  });

  it('treats file-only change sets as unresolved adapter mapping work without throwing', () => {
    const changeSet: ChangeSetInput = {
      source: 'github',
      baseRef: 'main',
      headRef: 'pull/123/head',
      changedFiles: ['libs/unknown/src/a.ts', 'apps/demo/src/main.ts'],
    };

    expect(() =>
      buildFeatureImpactAssessmentFromChangeSet({
        workspace: createWorkspace([]),
        changeSet,
      })
    ).not.toThrow();

    expect(resolveChangeSetProjectMapping(changeSet)).toEqual({
      changedProjects: [],
      unresolvedFiles: ['apps/demo/src/main.ts', 'libs/unknown/src/a.ts'],
    });
  });

  it('keeps the generic change-set contract platform-independent and free of GitHub or Nx imports', () => {
    const source = readFileSync(path.join(__dirname, 'change-set.ts'), 'utf8');

    expect(source).not.toMatch(/from ['"]nx['"]/);
    expect(source).not.toMatch(/from ['"]@nx\//);
    expect(source).not.toMatch(/from ['"]@octokit\//);
    expect(source).not.toMatch(/from ['"]github['"]/);
    expect(source).not.toMatch(/from ['"]\.\.\/plugin(?:\/|['"])/);
    expect(source).not.toMatch(/from ['"]\.\.\/executors(?:\/|['"])/);
    expect(source).not.toMatch(/from ['"]\.\.\/generators(?:\/|['"])/);
  });
});

function createWorkspace(projects: GovernanceProject[]): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects,
    dependencies: [],
  };
}

function project(
  id: string,
  options: {
    domain?: string;
    team?: string;
    contacts?: string[];
  } = {}
): GovernanceProject {
  return {
    id,
    name: id,
    root: `libs/${id}`,
    type: 'library',
    tags: [],
    domain: options.domain,
    ownership:
      options.team || options.contacts
        ? {
            source: 'project-metadata',
            team: options.team,
            contacts: options.contacts,
          }
        : undefined,
    metadata: {},
  };
}
