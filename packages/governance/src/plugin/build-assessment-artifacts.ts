import type {
  GovernanceAssessment,
  GovernanceExceptionApplicationResult,
  GovernanceSignal,
} from '@anarchitects/governance-core';
import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';

export interface GovernanceAssessmentArtifacts {
  assessment: GovernanceAssessment;
  signals: GovernanceSignal[];
  exceptionApplication: GovernanceExceptionApplicationResult;
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
}
