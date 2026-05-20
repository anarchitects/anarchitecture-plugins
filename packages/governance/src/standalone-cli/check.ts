import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceProfile,
  GovernanceWorkspace,
} from '../core/index.js';
import { buildGovernanceAssessment } from '../core/index.js';
import {
  calculateHealthScore,
  buildRecommendations,
} from '../health-engine/calculate-health.js';
import { calculateMetrics } from '../metric-engine/calculate-metrics.js';
import { loadGenericWorkspace } from '../manual-workspace/index.js';
import { evaluatePolicies } from '../policy-engine/evaluate-policies.js';
import { loadStandaloneGovernanceProfile } from '../profile/load-standalone-profile.js';
import { buildPolicySignals } from '../signal-engine/index.js';

export interface AgovCheckOptions {
  workspacePath: string;
  profilePath: string;
}

export interface AgovCheckResult {
  command: 'check';
  success: boolean;
  assessment: GovernanceAssessment;
}

const EMPTY_EXCEPTION_REPORT: GovernanceExceptionReport = {
  summary: {
    declaredCount: 0,
    matchedCount: 0,
    suppressedPolicyViolationCount: 0,
    suppressedConformanceFindingCount: 0,
    unusedExceptionCount: 0,
    activeExceptionCount: 0,
    staleExceptionCount: 0,
    expiredExceptionCount: 0,
    reactivatedPolicyViolationCount: 0,
    reactivatedConformanceFindingCount: 0,
  },
  used: [],
  unused: [],
  suppressedFindings: [],
  reactivatedFindings: [],
};

export function runAgovCheck(options: AgovCheckOptions): AgovCheckResult {
  const workspace = loadGenericWorkspace(options.workspacePath).workspace;
  const profile = loadStandaloneGovernanceProfile(options.profilePath).profile;
  const assessment = buildStandaloneGovernanceAssessment({
    workspace,
    profile,
  });

  return {
    command: 'check',
    success: !assessment.violations.some(
      (violation) => violation.severity === 'error'
    ),
    assessment,
  };
}

function buildStandaloneGovernanceAssessment(input: {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
}): GovernanceAssessment {
  const violations = evaluatePolicies(input.workspace, input.profile);
  const signals = buildPolicySignals(violations, {
    createdAt: '1970-01-01T00:00:00.000Z',
  });
  const measurements = calculateMetrics({
    workspace: input.workspace,
    signals,
  });
  const assessmentPreview = buildGovernanceAssessment({
    workspace: input.workspace,
    profile: input.profile.name,
    exceptions: EMPTY_EXCEPTION_REPORT,
    violations,
    signals,
    measurements,
    health: calculateHealthScore(measurements, input.profile.metrics),
    recommendations: buildRecommendations(violations, measurements),
  });
  const health = calculateHealthScore(
    measurements,
    input.profile.metrics,
    input.profile.health.statusThresholds,
    {
      topIssues: assessmentPreview.topIssues,
    }
  );

  return buildGovernanceAssessment({
    workspace: input.workspace,
    profile: input.profile.name,
    warnings: [],
    exceptions: EMPTY_EXCEPTION_REPORT,
    violations,
    signals,
    measurements,
    health,
    recommendations: buildRecommendations(violations, measurements),
  });
}
