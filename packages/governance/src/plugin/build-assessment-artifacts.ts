import type { GovernanceAssessment } from '../core/index.js';
import type { GovernanceExtensionDiagnostic } from '../extensions/diagnostics.js';
import type { GovernanceSignal } from '../signal-engine/index.js';
import type { GovernanceExceptionApplicationResult } from './apply-governance-exceptions.js';

export interface GovernanceAssessmentArtifacts {
  assessment: GovernanceAssessment;
  signals: GovernanceSignal[];
  exceptionApplication: GovernanceExceptionApplicationResult;
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
}
