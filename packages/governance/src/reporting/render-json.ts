import { GovernanceAssessment } from '../core/index.js';

export function renderJsonReport(assessment: GovernanceAssessment): string {
  return JSON.stringify(assessment, null, 2);
}
