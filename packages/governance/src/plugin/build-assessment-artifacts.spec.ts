import { logger } from '@nx/devkit';

import { renderJsonReport } from '../reporting/render-json.js';
import { runGovernance } from './run-governance.js';
import { buildGovernanceAssessmentArtifacts } from './build-assessment-artifacts.js';

describe('buildGovernanceAssessmentArtifacts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the public assessment output while exposing raw filtered signals', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    const result = await runGovernance({ reportType: 'boundaries' });
    const artifacts = await buildGovernanceAssessmentArtifacts({
      reportType: 'boundaries',
    });

    expect(artifacts.assessment).toEqual(result.assessment);
    expect(artifacts.signals).toHaveLength(
      artifacts.assessment.signalBreakdown.total
    );

    const parsed = JSON.parse(renderJsonReport(artifacts.assessment));
    expect(parsed).not.toHaveProperty('signals');
  });
});
