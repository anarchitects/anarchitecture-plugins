import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  AiHandoffUseCase,
  GovernanceAiHandoffPayload,
} from '../core/index.js';

export interface AiHandoffArtifacts {
  payloadAbsolutePath: string;
  payloadRelativePath: string;
  promptAbsolutePath: string;
  promptRelativePath: string;
  instructions: string;
}

export interface ExportAiHandoffArtifactsParams {
  workspaceRoot: string;
  useCase: AiHandoffUseCase;
  payload: GovernanceAiHandoffPayload<unknown>;
  outputDir?: string;
  prompt?: string;
}

export function exportAiHandoffArtifacts(
  params: ExportAiHandoffArtifactsParams
): AiHandoffArtifacts {
  const outputDir = path.resolve(
    params.workspaceRoot,
    params.outputDir ?? '.governance-metrics/ai'
  );

  mkdirSync(outputDir, { recursive: true });

  const payloadFileName = `${params.useCase}.payload.json`;
  const promptFileName = `${params.useCase}.prompt.md`;

  const payloadAbsolutePath = path.join(outputDir, payloadFileName);
  const promptAbsolutePath = path.join(outputDir, promptFileName);

  writeFileSync(
    payloadAbsolutePath,
    `${JSON.stringify(params.payload, null, 2)}\n`,
    'utf8'
  );

  const prompt = params.prompt ?? buildPromptTemplate(params.useCase);
  writeFileSync(promptAbsolutePath, `${prompt}\n`, 'utf8');

  const payloadRelativePath = path.relative(
    params.workspaceRoot,
    payloadAbsolutePath
  );
  const promptRelativePath = path.relative(
    params.workspaceRoot,
    promptAbsolutePath
  );

  return {
    payloadAbsolutePath,
    payloadRelativePath,
    promptAbsolutePath,
    promptRelativePath,
    instructions: renderAiHandoffInstructions({
      payloadRelativePath,
      promptRelativePath,
    }),
  };
}

export function buildPromptTemplate(useCase: AiHandoffUseCase): string {
  const taskByUseCase: Record<AiHandoffUseCase, string> = {
    'root-cause':
      'Analyze likely architectural root causes of governance violations using only the supplied payload.',
    drift:
      'Interpret architecture trend direction and drift risk using only the supplied snapshot trend payload.',
    'pr-impact':
      'Interpret architectural impact risk for this change set using only the supplied diff and dependency payload.',
    scorecard:
      'Summarize current architectural health and trend direction in a concise, management-friendly way using only the supplied score payload.',
    'management-insights':
      'Interpret delivery-impact indices, management insights, and architecture investment priorities using only the supplied governance payload.',
  };

  return [
    '# Architecture Governance AI Prompt',
    '',
    '## Role',
    'You are an architecture governance assistant.',
    '',
    '## Task',
    taskByUseCase[useCase],
    '',
    '## Grounding Constraints',
    '- Use only the information provided in the payload JSON.',
    '- Do not invent violations, metrics, dependencies, projects, or historical context.',
    '- If data is missing, explicitly say what is missing instead of assuming.',
    '- Reference concrete metric ids, project names, and signal values from the payload.',
    '- Explain reasoning step-by-step and tie every conclusion to evidence in the payload.',
    '',
    '## Output Structure',
    '- Findings: concrete observations grounded in the payload.',
    '- Risk Interpretation: severity and why it matters architecturally.',
    '- Likely Causes: plausible causes with evidence and uncertainty notes.',
    '- Recommendations: actionable next steps grounded in provided facts.',
    '',
    '## Safety and Discipline Constraints',
    '- Do not modify code and do not output code patches.',
    '- Do not propose blind refactors without payload evidence.',
    '- Avoid vague advice; recommendations must cite payload evidence.',
    '- Mark heuristics explicitly as heuristics.',
  ].join('\n');
}

export function renderAiHandoffInstructions(paths: {
  payloadRelativePath: string;
  promptRelativePath: string;
}): string {
  return [
    'AI analysis payload generated:',
    paths.payloadRelativePath,
    '',
    'Prompt template generated:',
    paths.promptRelativePath,
    '',
    'Suggested next step:',
    'Open your AI coding assistant and paste:',
    '1. the contents of the prompt template',
    '2. the contents of the payload JSON',
    '',
    'The AI assistant should use only the supplied information.',
  ].join('\n');
}
