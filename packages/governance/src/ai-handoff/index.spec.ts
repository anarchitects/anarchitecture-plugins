import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildPromptTemplate, exportAiHandoffArtifacts } from './index.js';

describe('ai-handoff', () => {
  const workspaceRoot = path.join(
    tmpdir(),
    `nx-governance-ai-handoff-${Date.now()}`
  );

  afterAll(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('exports payload and prompt files for root-cause handoff', () => {
    const payload = {
      useCase: 'root-cause' as const,
      request: {
        kind: 'root-cause',
      },
    };
    const artifacts = exportAiHandoffArtifacts({
      workspaceRoot,
      useCase: 'root-cause',
      payload,
    });

    expect(artifacts.payloadRelativePath).toBe(
      '.governance-metrics/ai/root-cause.payload.json'
    );
    expect(artifacts.promptRelativePath).toBe(
      '.governance-metrics/ai/root-cause.prompt.md'
    );
    expect(
      existsSync(path.join(workspaceRoot, artifacts.payloadRelativePath))
    ).toBe(true);
    expect(
      existsSync(path.join(workspaceRoot, artifacts.promptRelativePath))
    ).toBe(true);

    const promptContent = readFileSync(
      path.join(workspaceRoot, artifacts.promptRelativePath),
      'utf8'
    );
    expect(promptContent).toContain('## Role');
    expect(promptContent).toContain('## Task');
    expect(promptContent).toContain('## Grounding Constraints');
    expect(promptContent).toContain('## Output Structure');
    expect(promptContent).toContain('## Safety and Discipline Constraints');
    expect(
      JSON.parse(
        readFileSync(
          path.join(workspaceRoot, artifacts.payloadRelativePath),
          'utf8'
        )
      )
    ).toEqual(payload);
  });

  it('renders root-cause prompt with discipline constraints', () => {
    const prompt = buildPromptTemplate('root-cause');

    expect(prompt).toContain(
      'Use only the information provided in the payload JSON.'
    );
    expect(prompt).toContain(
      'Do not modify code and do not output code patches.'
    );
    expect(prompt).toContain('Mark heuristics explicitly as heuristics.');
  });

  it('renders drift, pr-impact, and scorecard prompts with required sections', () => {
    const useCases = [
      'drift',
      'pr-impact',
      'scorecard',
      'management-insights',
    ] as const;

    for (const useCase of useCases) {
      const prompt = buildPromptTemplate(useCase);
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('## Task');
      expect(prompt).toContain('## Grounding Constraints');
      expect(prompt).toContain('## Output Structure');
      expect(prompt).toContain('## Safety and Discipline Constraints');
    }
  });

  it('writes a caller-supplied prompt without changing existing artifact paths', () => {
    const payload = {
      useCase: 'management-insights' as const,
      request: {
        kind: 'management-insights',
      },
    };
    const artifacts = exportAiHandoffArtifacts({
      workspaceRoot,
      useCase: 'management-insights',
      payload,
      prompt: '# Custom Prompt\n',
    });

    expect(artifacts.payloadRelativePath).toBe(
      '.governance-metrics/ai/management-insights.payload.json'
    );
    expect(artifacts.promptRelativePath).toBe(
      '.governance-metrics/ai/management-insights.prompt.md'
    );
    expect(
      readFileSync(
        path.join(workspaceRoot, artifacts.promptRelativePath),
        'utf8'
      )
    ).toContain('# Custom Prompt');
  });
});
