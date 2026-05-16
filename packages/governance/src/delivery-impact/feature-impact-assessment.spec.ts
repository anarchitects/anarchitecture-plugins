import type { GovernanceProject, GovernanceWorkspace } from '../core/index.js';
import { buildFeatureImpactAssessment } from './feature-impact-assessment.js';

describe('buildFeatureImpactAssessment', () => {
  it('builds a low-risk assessment for one changed project in one domain with ownership', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['alice'],
        }),
      ]),
      changedProjects: ['billing-ui'],
    });

    expect(assessment).toEqual({
      id: 'feature-impact-assessment',
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

  it('derives affected domains from affected projects', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', { domain: 'billing', team: '@org/billing' }),
        project('payments-api', { domain: 'payments', team: '@org/payments' }),
      ]),
      changedProjects: ['billing-ui'],
      affectedProjects: ['payments-api', 'billing-ui'],
    });

    expect(assessment.affectedDomains).toEqual(['billing', 'payments']);
  });

  it('derives affected teams and review stakeholders from ownership metadata', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['alice', 'bob'],
        }),
        project('payments-api', {
          domain: 'payments',
          team: '@org/payments',
          contacts: ['carol'],
        }),
      ]),
      changedProjects: ['billing-ui'],
      affectedProjects: ['billing-ui', 'payments-api'],
    });

    expect(assessment.affectedTeams).toEqual(['@org/billing', '@org/payments']);
    expect(assessment.recommendedReviewStakeholders).toEqual([
      '@org/billing',
      '@org/payments',
      'alice',
      'bob',
      'carol',
    ]);
  });

  it('handles missing ownership without throwing', () => {
    expect(() =>
      buildFeatureImpactAssessment({
        workspace: createWorkspace([
          project('billing-ui', { domain: 'billing' }),
        ]),
        changedProjects: ['billing-ui'],
      })
    ).not.toThrow();

    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', { domain: 'billing' }),
      ]),
      changedProjects: ['billing-ui'],
    });

    expect(assessment.deliveryRisk).toBe('high');
    expect(assessment.affectedTeams).toEqual([]);
  });

  it('increases risk when multiple domains are affected', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', { domain: 'billing', team: '@org/billing' }),
        project('payments-api', { domain: 'payments', team: '@org/payments' }),
      ]),
      changedProjects: ['billing-ui'],
      affectedProjects: ['billing-ui', 'payments-api'],
    });

    expect(assessment.deliveryRisk).toBe('high');
  });

  it('increases risk when affected rules are present', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
        }),
      ]),
      changedProjects: ['billing-ui'],
      affectedRules: ['domain-boundary', 'ownership-presence'],
    });

    expect(assessment.deliveryRisk).toBe('high');
    expect(assessment.drivers.map((driver) => driver.id)).toContain(
      'feature-rule-impact'
    );
  });

  it('de-duplicates and sorts changed projects, affected projects, domains, teams and stakeholders', () => {
    const assessment = buildFeatureImpactAssessment({
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['zoe', 'alice'],
        }),
        project('billing-api', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['alice'],
        }),
        project('analytics-ui', {
          domain: 'analytics',
          team: '@org/analytics',
          contacts: ['bob'],
        }),
      ]),
      changedProjects: ['billing-ui', 'analytics-ui', 'billing-ui'],
      affectedProjects: ['billing-api', 'analytics-ui', 'billing-api'],
    });

    expect(assessment.changedProjects).toEqual(['analytics-ui', 'billing-ui']);
    expect(assessment.affectedProjects).toEqual([
      'analytics-ui',
      'billing-api',
    ]);
    expect(assessment.affectedDomains).toEqual(['analytics', 'billing']);
    expect(assessment.affectedTeams).toEqual([
      '@org/analytics',
      '@org/billing',
    ]);
    expect(assessment.recommendedReviewStakeholders).toEqual([
      '@org/analytics',
      '@org/billing',
      'alice',
      'bob',
    ]);
  });

  it('produces deterministic output', () => {
    const input = {
      workspace: createWorkspace([
        project('billing-ui', {
          domain: 'billing',
          team: '@org/billing',
          contacts: ['alice'],
        }),
        project('payments-api', {
          domain: 'payments',
          team: '@org/payments',
          contacts: ['carol'],
        }),
      ]),
      changedProjects: ['payments-api', 'billing-ui'],
      affectedProjects: ['payments-api', 'billing-ui'],
      affectedRules: ['domain-boundary'],
      affectedTargets: ['build', 'test'],
      changedFiles: ['b.ts', 'a.ts'],
      baseRef: 'main',
      headRef: 'feature',
    } satisfies Parameters<typeof buildFeatureImpactAssessment>[0];

    expect(buildFeatureImpactAssessment(input)).toEqual(
      buildFeatureImpactAssessment(input)
    );
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
