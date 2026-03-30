import type { GovernanceAssessment } from '../core/index.js';

import { renderCliReport } from './render-cli.js';
import { renderJsonReport } from './render-json.js';

describe('governance report rendering', () => {
  it('renders deterministic signal source rows in CLI output', () => {
    const rendered = renderCliReport(makeAssessment());

    expect(rendered).toContain('Signal Sources:');
    expect(rendered).toContain('- graph: 3');
    expect(rendered).toContain('- conformance: 1');
    expect(rendered).toContain('- policy: 2');
    expect(rendered.indexOf('Signal Sources:')).toBeLessThan(
      rendered.indexOf('Metrics:')
    );
  });

  it('includes signal breakdown in JSON output', () => {
    const rendered = renderJsonReport(makeAssessment());

    expect(JSON.parse(rendered)).toMatchObject({
      signalBreakdown: {
        total: 6,
        bySource: [
          { source: 'graph', count: 3 },
          { source: 'conformance', count: 1 },
          { source: 'policy', count: 2 },
        ],
      },
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
    ],
    signalBreakdown: {
      total: 6,
      bySource: [
        { source: 'graph', count: 3 },
        { source: 'conformance', count: 1 },
        { source: 'policy', count: 2 },
      ],
    },
    health: {
      score: 80,
      grade: 'B',
      hotspots: [],
    },
    recommendations: [],
  };
}
