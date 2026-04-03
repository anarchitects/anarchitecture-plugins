import type { GovernanceAssessment } from '../core/index.js';

import { renderCliReport } from './render-cli.js';
import { renderJsonReport } from './render-json.js';

describe('governance report rendering', () => {
  it('renders deterministic signal source rows in CLI output', () => {
    const rendered = renderCliReport(makeAssessment());

    expect(rendered).toContain('Health Score: 80 (Warning, B)');
    expect(rendered).toContain('Metric Hotspots:');
    expect(rendered).toContain('Project Hotspots:');
    expect(rendered).toContain('Explainability:');
    expect(rendered).toContain('- Documentation Completeness: 33/100');
    expect(rendered).toContain(
      '- payments-feature: 3 :: types=domain-boundary-violation,ownership-gap'
    );
    expect(rendered).toContain(
      '- summary: Overall health is Warning at 80/100. Weakest metrics: Documentation Completeness (33), Architectural Entropy (80). Dominant issues: domain-boundary-violation x2, ownership-gap x1.'
    );
    expect(rendered).toContain('Signal Sources:');
    expect(rendered).toContain('Signal Types:');
    expect(rendered).toContain('Signal Severity:');
    expect(rendered).toContain('Metric Families:');
    expect(rendered).toContain('Top Issues:');
    expect(rendered).toContain('- graph: 3');
    expect(rendered).toContain('- conformance: 1');
    expect(rendered).toContain('- policy: 2');
    expect(rendered).toContain('- structural-dependency: 2');
    expect(rendered).toContain('- conformance-violation: 1');
    expect(rendered).toContain('- info: 2');
    expect(rendered).toContain('- warning: 3');
    expect(rendered).toContain('- error: 1');
    expect(rendered).toContain('- architecture: 80/100');
    expect(rendered).toContain('- documentation: 33/100');
    expect(rendered).toContain(
      '- [error] domain-boundary-violation (policy) x2 :: domain-boundary :: projects=orders-app,payments-feature :: Domain boundary violation'
    );
    expect(rendered.indexOf('Signal Sources:')).toBeLessThan(
      rendered.indexOf('Signal Types:')
    );
    expect(rendered.indexOf('Signal Types:')).toBeLessThan(
      rendered.indexOf('Signal Severity:')
    );
    expect(rendered.indexOf('Signal Severity:')).toBeLessThan(
      rendered.indexOf('Metrics:')
    );
    expect(rendered.indexOf('Metrics:')).toBeLessThan(
      rendered.indexOf('Metric Families:')
    );
    expect(rendered.indexOf('Metric Families:')).toBeLessThan(
      rendered.indexOf('Metric Hotspots:')
    );
    expect(rendered.indexOf('Metric Hotspots:')).toBeLessThan(
      rendered.indexOf('Project Hotspots:')
    );
    expect(rendered.indexOf('Project Hotspots:')).toBeLessThan(
      rendered.indexOf('Explainability:')
    );
    expect(rendered.indexOf('Explainability:')).toBeLessThan(
      rendered.indexOf('Top Issues:')
    );
    expect(rendered.indexOf('Metric Families:')).toBeLessThan(
      rendered.indexOf('Top Issues:')
    );
  });

  it('includes signal breakdown in JSON output', () => {
    const rendered = renderJsonReport(makeAssessment());

    expect(JSON.parse(rendered)).toMatchObject({
      health: {
        score: 80,
        status: 'warning',
        grade: 'B',
        hotspots: [],
        metricHotspots: [
          {
            id: 'documentation-completeness',
            name: 'Documentation Completeness',
            score: 33,
          },
        ],
        projectHotspots: [
          {
            project: 'payments-feature',
            count: 3,
            dominantIssueTypes: ['domain-boundary-violation', 'ownership-gap'],
          },
        ],
        explainability: {
          summary:
            'Overall health is Warning at 80/100. Weakest metrics: Documentation Completeness (33), Architectural Entropy (80). Dominant issues: domain-boundary-violation x2, ownership-gap x1.',
          statusReason:
            'Score 80 is below the Good threshold (85) but meets the Warning threshold (70).',
          weakestMetrics: [
            {
              id: 'documentation-completeness',
              name: 'Documentation Completeness',
              score: 33,
            },
            {
              id: 'architectural-entropy',
              name: 'Architectural Entropy',
              score: 80,
            },
          ],
          dominantIssues: [
            {
              type: 'domain-boundary-violation',
              source: 'policy',
              severity: 'error',
              count: 2,
              projects: ['orders-app', 'payments-feature'],
              ruleId: 'domain-boundary',
              message: 'Domain boundary violation',
            },
            {
              type: 'ownership-gap',
              source: 'policy',
              severity: 'warning',
              count: 1,
              projects: ['payments-feature'],
              ruleId: 'ownership-presence',
              message: 'Ownership gap',
            },
          ],
        },
      },
      signalBreakdown: {
        total: 6,
        bySource: [
          { source: 'graph', count: 3 },
          { source: 'conformance', count: 1 },
          { source: 'policy', count: 2 },
        ],
        byType: [
          { type: 'structural-dependency', count: 2 },
          { type: 'conformance-violation', count: 1 },
          { type: 'domain-boundary-violation', count: 2 },
          { type: 'ownership-gap', count: 1 },
        ],
        bySeverity: [
          { severity: 'info', count: 2 },
          { severity: 'warning', count: 3 },
          { severity: 'error', count: 1 },
        ],
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 80,
            measurements: [
              {
                id: 'architectural-entropy',
                name: 'Architectural Entropy',
                score: 80,
              },
            ],
          },
          {
            family: 'documentation',
            score: 33,
            measurements: [
              {
                id: 'documentation-completeness',
                name: 'Documentation Completeness',
                score: 33,
              },
            ],
          },
        ],
      },
      topIssues: [
        {
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 2,
          projects: ['orders-app', 'payments-feature'],
          ruleId: 'domain-boundary',
          message: 'Domain boundary violation',
        },
      ],
    });
  });
});

function makeAssessment(): GovernanceAssessment {
  return {
    workspace: {
      id: 'workspace',
      name: 'workspace',
      root: '/workspace',
      projects: [],
      dependencies: [],
    },
    profile: 'angular-cleanup',
    warnings: [],
    violations: [],
    measurements: [
      {
        id: 'architectural-entropy',
        name: 'Architectural Entropy',
        value: 0.2,
        score: 80,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        value: 0.33,
        score: 33,
        maxScore: 100,
        unit: 'ratio',
      },
    ],
    signalBreakdown: {
      total: 6,
      bySource: [
        { source: 'graph', count: 3 },
        { source: 'conformance', count: 1 },
        { source: 'policy', count: 2 },
      ],
      byType: [
        { type: 'structural-dependency', count: 2 },
        { type: 'conformance-violation', count: 1 },
        { type: 'domain-boundary-violation', count: 2 },
        { type: 'ownership-gap', count: 1 },
      ],
      bySeverity: [
        { severity: 'info', count: 2 },
        { severity: 'warning', count: 3 },
        { severity: 'error', count: 1 },
      ],
    },
    metricBreakdown: {
      families: [
        {
          family: 'architecture',
          score: 80,
          measurements: [
            {
              id: 'architectural-entropy',
              name: 'Architectural Entropy',
              score: 80,
            },
          ],
        },
        {
          family: 'documentation',
          score: 33,
          measurements: [
            {
              id: 'documentation-completeness',
              name: 'Documentation Completeness',
              score: 33,
            },
          ],
        },
      ],
    },
    topIssues: [
      {
        type: 'domain-boundary-violation',
        source: 'policy',
        severity: 'error',
        count: 2,
        projects: ['orders-app', 'payments-feature'],
        ruleId: 'domain-boundary',
        message: 'Domain boundary violation',
      },
    ],
    health: {
      score: 80,
      status: 'warning',
      grade: 'B',
      hotspots: [],
      metricHotspots: [
        {
          id: 'documentation-completeness',
          name: 'Documentation Completeness',
          score: 33,
        },
      ],
      projectHotspots: [
        {
          project: 'payments-feature',
          count: 3,
          dominantIssueTypes: ['domain-boundary-violation', 'ownership-gap'],
        },
      ],
      explainability: {
        summary:
          'Overall health is Warning at 80/100. Weakest metrics: Documentation Completeness (33), Architectural Entropy (80). Dominant issues: domain-boundary-violation x2, ownership-gap x1.',
        statusReason:
          'Score 80 is below the Good threshold (85) but meets the Warning threshold (70).',
        weakestMetrics: [
          {
            id: 'documentation-completeness',
            name: 'Documentation Completeness',
            score: 33,
          },
          {
            id: 'architectural-entropy',
            name: 'Architectural Entropy',
            score: 80,
          },
        ],
        dominantIssues: [
          {
            type: 'domain-boundary-violation',
            source: 'policy',
            severity: 'error',
            count: 2,
            projects: ['orders-app', 'payments-feature'],
            ruleId: 'domain-boundary',
            message: 'Domain boundary violation',
          },
          {
            type: 'ownership-gap',
            source: 'policy',
            severity: 'warning',
            count: 1,
            projects: ['payments-feature'],
            ruleId: 'ownership-presence',
            message: 'Ownership gap',
          },
        ],
      },
    },
    recommendations: [],
  };
}
