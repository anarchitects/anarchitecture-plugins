import type { Measurement } from '../core/index.js';

import { buildMetricBreakdown } from './metric-breakdown.js';

describe('metric breakdown helpers', () => {
  it('builds deterministic family groupings from filtered measurements', () => {
    const breakdown = buildMetricBreakdown([
      measurement('dependency-complexity', 'Dependency Complexity', 89),
      measurement('architectural-entropy', 'Architectural Entropy', 66),
      measurement('domain-integrity', 'Domain Integrity', 100),
      measurement('layer-integrity', 'Layer Integrity', 78),
      measurement('ownership-coverage', 'Ownership Coverage', 67),
      measurement(
        'documentation-completeness',
        'Documentation Completeness',
        33
      ),
    ]);

    expect(breakdown.families).toEqual([
      {
        family: 'architecture',
        score: 78,
        measurements: [
          measurementSummary(
            'architectural-entropy',
            'Architectural Entropy',
            66
          ),
          measurementSummary(
            'dependency-complexity',
            'Dependency Complexity',
            89
          ),
        ],
      },
      {
        family: 'boundaries',
        score: 89,
        measurements: [
          measurementSummary('domain-integrity', 'Domain Integrity', 100),
          measurementSummary('layer-integrity', 'Layer Integrity', 78),
        ],
      },
      {
        family: 'ownership',
        score: 67,
        measurements: [
          measurementSummary('ownership-coverage', 'Ownership Coverage', 67),
        ],
      },
      {
        family: 'documentation',
        score: 33,
        measurements: [
          measurementSummary(
            'documentation-completeness',
            'Documentation Completeness',
            33
          ),
        ],
      },
    ]);
  });

  it('omits empty families after report filtering', () => {
    expect(
      buildMetricBreakdown([
        measurement('ownership-coverage', 'Ownership Coverage', 67),
      ])
    ).toEqual({
      families: [
        {
          family: 'ownership',
          score: 67,
          measurements: [
            measurementSummary('ownership-coverage', 'Ownership Coverage', 67),
          ],
        },
      ],
    });
  });
});

function measurement(
  id: Measurement['id'],
  name: string,
  score: number
): Measurement {
  return {
    id,
    name,
    family: familyForMeasurement(id),
    value: score / 100,
    score,
    maxScore: 100,
    unit: 'ratio',
  };
}

function familyForMeasurement(id: Measurement['id']): Measurement['family'] {
  if (id === 'ownership-coverage') {
    return 'ownership';
  }

  if (id === 'documentation-completeness') {
    return 'documentation';
  }

  if (id === 'domain-integrity' || id === 'layer-integrity') {
    return 'boundaries';
  }

  return 'architecture';
}

function measurementSummary(
  id: Measurement['id'],
  name: string,
  score: number
) {
  return { id, name, score };
}
