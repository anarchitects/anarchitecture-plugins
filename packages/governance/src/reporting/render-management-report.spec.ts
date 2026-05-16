import type {
  DeliveryImpactAssessment,
  DeliveryImpactIndex,
  GovernanceInsight,
  GovernanceInsightDriver,
} from '../delivery-impact/index.js';

import { renderManagementReport } from './render-management-report.js';

describe('renderManagementReport', () => {
  it('renders all expected section headings', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered).toContain('# Governance Management Report');
    expect(rendered).toContain('## Management Summary');
    expect(rendered).toContain('## Cost of Change Index');
    expect(rendered).toContain('## Time-to-Market Risk Index');
    expect(rendered).toContain('## Delivery Predictability / Trend');
    expect(rendered).toContain('## Top Investment Drivers');
    expect(rendered).toContain('## Team / Domain Dependency Risks');
    expect(rendered).toContain('## Recommended Architecture Investments');
    expect(rendered).toContain('## Technical Appendix');
  });

  it('renders Cost of Change Index when present', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered).toContain('## Cost of Change Index');
    expect(rendered).toContain('Score: 68/100');
    expect(rendered).toContain('Risk: Medium');
    expect(rendered).toContain('Trend: Worsening');
  });

  it('renders Time-to-Market Risk Index when present', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered).toContain('## Time-to-Market Risk Index');
    expect(rendered).toContain('Score: 72/100');
    expect(rendered).toContain('Risk: High');
    expect(rendered).toContain('Trend: Stable');
  });

  it('renders deterministic fallback text for missing sections', () => {
    const rendered = renderManagementReport({
      generatedAt: '2026-05-16T12:00:00.000Z',
      profile: 'frontend-layered',
      indices: [],
      insights: [],
      drivers: [],
    });

    expect(rendered).toContain('Highest risk area: No data available.');
    expect(rendered).toContain('Cost of Change Index is not available.');
    expect(rendered).toContain('Time-to-Market Risk Index is not available.');
    expect(rendered).toContain('No trend data available.');
    expect(rendered).toContain(
      '## Team / Domain Dependency Risks\nNo data available.'
    );
    expect(rendered).toContain(
      '## Recommended Architecture Investments\nNo data available.'
    );
    expect(rendered).toContain('## Technical Appendix\nNo data available.');
  });

  it('includes top drivers in deterministic priority order', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered).toContain(
      'Top investment drivers: Change impact radius pressure, Cross-domain coordination friction, Delivery predictability pressure.'
    );
    expect(
      rendered.indexOf(
        '- Change impact radius pressure (score 88/100, value 12 count, trend worsening): Broad dependency fanout increases delivery friction.'
      )
    ).toBeLessThan(
      rendered.indexOf(
        '- Cross-domain coordination friction (score 83/100, value 4 count, trend worsening): Domain boundary issues are increasing coordination risk.'
      )
    );
  });

  it('includes technical appendix traceability', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered).toContain('### cost-of-change-risk');
    expect(rendered).toContain(
      '- related measurements: architectural-entropy, dependency-complexity'
    );
    expect(rendered).toContain(
      '- related signals: domain-boundary-violation, structural-dependency'
    );
    expect(rendered).toContain('- related violations: dep-1');
  });

  it('respects includeTechnicalAppendix: false', () => {
    const rendered = renderManagementReport(makeAssessment(), {
      includeTechnicalAppendix: false,
    });

    expect(rendered).not.toContain('## Technical Appendix');
    expect(rendered).not.toContain('### cost-of-change-risk');
  });

  it('produces deterministic output ordering', () => {
    const rendered = renderManagementReport(makeAssessment());

    expect(rendered.indexOf('## Cost of Change Index')).toBeLessThan(
      rendered.indexOf('## Time-to-Market Risk Index')
    );
    expect(rendered.indexOf('### cost-of-change-risk')).toBeLessThan(
      rendered.indexOf('### time-to-market-risk')
    );
    expect(rendered.indexOf('### time-to-market-risk')).toBeLessThan(
      rendered.indexOf('### architecture-investment-drivers')
    );
  });
});

function makeAssessment(): DeliveryImpactAssessment {
  const changeImpactRadiusPressure = driver({
    id: 'change-impact-radius-pressure',
    label: 'Change impact radius pressure',
    score: 88,
    value: 12,
    unit: 'count',
    trend: 'worsening',
    explanation: 'Broad dependency fanout increases delivery friction.',
  });
  const crossDomainCoordinationFriction = driver({
    id: 'cross-domain-coordination-friction',
    label: 'Cross-domain coordination friction',
    score: 83,
    value: 4,
    unit: 'count',
    trend: 'worsening',
    explanation: 'Domain boundary issues are increasing coordination risk.',
  });
  const deliveryPredictabilityPressure = driver({
    id: 'delivery-predictability-pressure',
    label: 'Delivery predictability pressure',
    score: 74,
    trend: 'stable',
    explanation: 'Health degradation is creating release uncertainty.',
  });
  const architectureInvestmentPriority = driver({
    id: 'architecture-investment-priority',
    label: 'Architecture investment priority',
    score: 63,
    explanation:
      'Top issues continue to cluster around the same architecture hotspots.',
  });
  const ownershipAmbiguity = driver({
    id: 'ownership-ambiguity',
    label: 'Ownership ambiguity',
    score: 54,
    value: 2,
    unit: 'count',
    explanation: 'Several impacted areas do not have clear ownership coverage.',
  });

  const costOfChangeIndex: DeliveryImpactIndex = {
    id: 'cost-of-change',
    name: 'Cost of Change Index',
    score: 68,
    risk: 'medium',
    trend: 'worsening',
    drivers: [
      crossDomainCoordinationFriction,
      architectureInvestmentPriority,
      changeImpactRadiusPressure,
    ],
  };
  const timeToMarketIndex: DeliveryImpactIndex = {
    id: 'time-to-market-risk',
    name: 'Time-to-Market Risk Index',
    score: 72,
    risk: 'high',
    trend: 'stable',
    drivers: [
      deliveryPredictabilityPressure,
      ownershipAmbiguity,
      changeImpactRadiusPressure,
    ],
  };

  return {
    generatedAt: '2026-05-16T12:00:00.000Z',
    profile: 'frontend-layered',
    indices: [timeToMarketIndex, costOfChangeIndex],
    drivers: [
      architectureInvestmentPriority,
      ownershipAmbiguity,
      crossDomainCoordinationFriction,
      changeImpactRadiusPressure,
      deliveryPredictabilityPressure,
    ],
    insights: [
      insight({
        id: 'delivery-impact-technical-findings',
        audience: 'developer',
        category: 'delivery-risk',
        severity: 'high',
        title: 'Delivery Impact Technical Findings',
        summary:
          '1 related violation and 2 top issues remain relevant to delivery impact.',
        drivers: [
          changeImpactRadiusPressure,
          crossDomainCoordinationFriction,
          ownershipAmbiguity,
        ],
        relatedMeasurements: ['dependency-complexity', 'domain-integrity'],
        relatedSignals: ['structural-dependency', 'domain-boundary-violation'],
        relatedViolations: ['dep-1'],
      }),
      insight({
        id: 'architecture-investment-drivers',
        audience: 'technical-lead',
        category: 'delivery-risk',
        severity: 'high',
        title: 'Architecture Investment Drivers',
        summary:
          'Top delivery-impact drivers are Change impact radius pressure, Cross-domain coordination friction, Delivery predictability pressure.',
        drivers: [
          changeImpactRadiusPressure,
          crossDomainCoordinationFriction,
          deliveryPredictabilityPressure,
        ],
        relatedMeasurements: ['dependency-complexity', 'domain-integrity'],
        relatedSignals: ['structural-dependency', 'domain-boundary-violation'],
        relatedViolations: ['dep-1'],
      }),
      insight({
        id: 'time-to-market-risk',
        audience: 'management',
        category: 'time-to-market',
        severity: 'high',
        title: 'Time-to-Market Risk',
        summary: 'Time-to-Market Risk Index is 72/100 with high risk.',
        drivers: [
          deliveryPredictabilityPressure,
          ownershipAmbiguity,
          changeImpactRadiusPressure,
        ],
        relatedMeasurements: ['dependency-complexity', 'ownership-coverage'],
        relatedSignals: ['ownership-gap', 'structural-dependency'],
        relatedViolations: ['dep-1'],
      }),
      insight({
        id: 'cost-of-change-risk',
        audience: 'management',
        category: 'cost-of-change',
        severity: 'medium',
        title: 'Cost of Change Risk',
        summary: 'Cost of Change Index is 68/100 with medium risk.',
        drivers: [
          changeImpactRadiusPressure,
          crossDomainCoordinationFriction,
          architectureInvestmentPriority,
        ],
        relatedMeasurements: ['architectural-entropy', 'dependency-complexity'],
        relatedSignals: ['structural-dependency', 'domain-boundary-violation'],
        relatedViolations: ['dep-1'],
      }),
    ],
  };
}

function driver(
  overrides: Partial<GovernanceInsightDriver> &
    Pick<GovernanceInsightDriver, 'id' | 'label'>
): GovernanceInsightDriver {
  return {
    ...overrides,
  };
}

function insight(value: GovernanceInsight): GovernanceInsight {
  return value;
}
