import {
  evaluateCoreBuiltInPolicyViolations,
  GovernanceProfile,
  GovernanceWorkspace,
  Violation,
} from '../core/index.js';

export function evaluatePolicies(
  workspace: GovernanceWorkspace,
  profile: GovernanceProfile
): Violation[] {
  return evaluateCoreBuiltInPolicyViolations({
    workspace,
    profile,
  });
}
