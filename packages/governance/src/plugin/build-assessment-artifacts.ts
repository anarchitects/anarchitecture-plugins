import type {
  GovernanceAssessment,
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExceptionApplicationResult,
  GovernanceSignal,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';
import type { GovernanceProfileComposition } from '../profile/runtime-profile.js';

export interface GovernanceAssessmentArtifacts {
  assessment: GovernanceAssessment;
  signals: GovernanceSignal[];
  exceptionApplication: GovernanceExceptionApplicationResult;
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
  adapterResult?: GovernanceWorkspaceAdapterResult;
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  profileComposition?: GovernanceProfileComposition;
}
