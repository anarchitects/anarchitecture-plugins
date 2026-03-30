import { logger, workspaceRoot } from '@nx/devkit';

import { calculateHealthScore } from '../health-engine/calculate-health.js';
import {
  angularCleanupProfile,
  loadProfileOverrides,
} from '../presets/angular-cleanup/profile.js';
import { runGovernance } from './run-governance.js';

describe('runGovernance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps report measurement ids stable across report types after signal-based metric wiring', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const profileName = 'angular-cleanup';
    const overrides = await loadProfileOverrides(workspaceRoot, profileName);
    const resolvedWeights = {
      'architectural-entropy':
        overrides.metrics?.architecturalEntropyWeight ??
        angularCleanupProfile.metrics.architecturalEntropyWeight,
      'dependency-complexity':
        overrides.metrics?.dependencyComplexityWeight ??
        angularCleanupProfile.metrics.dependencyComplexityWeight,
      'domain-integrity':
        overrides.metrics?.domainIntegrityWeight ??
        angularCleanupProfile.metrics.domainIntegrityWeight,
      'ownership-coverage':
        overrides.metrics?.ownershipCoverageWeight ??
        angularCleanupProfile.metrics.ownershipCoverageWeight,
      'documentation-completeness':
        overrides.metrics?.documentationCompletenessWeight ??
        angularCleanupProfile.metrics.documentationCompletenessWeight,
    };

    const health = await runGovernance({ reportType: 'health' });
    const boundaries = await runGovernance({ reportType: 'boundaries' });
    const ownership = await runGovernance({ reportType: 'ownership' });
    const architecture = await runGovernance({ reportType: 'architecture' });

    expect(health.assessment.measurements.map((metric) => metric.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
    expect(
      boundaries.assessment.measurements.map((metric) => metric.id)
    ).toEqual(['architectural-entropy', 'domain-integrity', 'layer-integrity']);
    expect(
      ownership.assessment.measurements.map((metric) => metric.id)
    ).toEqual(['ownership-coverage']);
    expect(
      architecture.assessment.measurements.map((metric) => metric.id)
    ).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
    ]);

    expect(health.assessment.health).toEqual(
      calculateHealthScore(health.assessment.measurements, resolvedWeights)
    );
  });
});
