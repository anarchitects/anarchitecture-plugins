import type { GovernanceAssessment } from '@anarchitects/governance-core';

import {
  buildGovernanceRenderingModel,
  type GovernanceRendererInput,
} from './canonical-rendering-model.js';

export function renderJsonReport(input: GovernanceRendererInput): string {
  const model = buildGovernanceRenderingModel(input);

  if (isAssessmentOnly(input)) {
    return JSON.stringify(model.assessment, null, 2);
  }

  return JSON.stringify(
    {
      ...model.assessment,
      nodes: model.nodes,
      relations: model.relations,
      signals: model.signals,
      capabilities: model.capabilities,
      diagnostics: model.diagnostics,
      extensionDiagnostics: model.extensionDiagnostics,
    },
    null,
    2
  );
}

function isAssessmentOnly(
  input: GovernanceRendererInput
): input is GovernanceAssessment {
  return !('assessment' in input);
}
