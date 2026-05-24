import type {
  AiAnalysisResult,
  DriftSignal,
  DriftSummary,
  SnapshotComparison,
} from '@anarchitects/governance-core';

export function renderDriftCliReport(
  comparison: SnapshotComparison,
  signals: DriftSignal[],
  summary: DriftSummary
): string {
  const lines: string[] = [];
  lines.push('Nx Governance Drift Analysis');
  lines.push('');
  lines.push(`Baseline: ${comparison.baseline.timestamp}`);
  lines.push(`Current: ${comparison.current.timestamp}`);
  lines.push(
    `Violation delta: +${comparison.newViolations.length} / -${comparison.resolvedViolations.length}`
  );
  lines.push(`Overall trend: ${formatDriftStatus(summary.overallTrend)}`);

  if (
    comparison.healthDelta &&
    (comparison.healthDelta.baselineStatus !==
      comparison.healthDelta.currentStatus ||
      comparison.healthDelta.baselineGrade !==
        comparison.healthDelta.currentGrade)
  ) {
    lines.push(
      `Health transition: ${formatDriftStatus(
        comparison.healthDelta.baselineStatus
      )} (${comparison.healthDelta.baselineGrade}) -> ${formatDriftStatus(
        comparison.healthDelta.currentStatus
      )} (${comparison.healthDelta.currentGrade})`
    );
  }

  if (summary.topWorsening.length > 0) {
    lines.push('');
    lines.push('Top Worsening:');
    for (const signal of summary.topWorsening) {
      lines.push(
        `- ${signal.label}: ${formatDriftDelta(signal.delta)} (${
          signal.baseline
        } -> ${signal.current})`
      );
    }
  }

  if (summary.topImproving.length > 0) {
    lines.push('');
    lines.push('Top Improving:');
    for (const signal of summary.topImproving) {
      lines.push(
        `- ${signal.label}: ${formatDriftDelta(signal.delta)} (${
          signal.baseline
        } -> ${signal.current})`
      );
    }
  }

  if (signals.length > 0) {
    lines.push('');
    lines.push('Signals:');

    for (const signal of signals) {
      lines.push(
        `- ${signal.label}: ${signal.status} (${formatDriftDelta(
          signal.delta
        )}, magnitude ${signal.magnitude.toFixed(3)})`
      );
    }
  }

  return lines.join('\n');
}

export function renderAiRootCauseCliReport(
  analysis: AiAnalysisResult,
  snapshotPath: string,
  selectedViolations: number
): string {
  return renderAiAnalysisReport('Nx Governance AI Root Cause', analysis, [
    `Snapshot: ${snapshotPath}`,
    `Prioritized violations: ${selectedViolations}`,
  ]);
}

export function renderAiDriftCliReport(analysis: AiAnalysisResult): string {
  return renderAiAnalysisReport(
    'Nx Governance AI Drift Interpretation',
    analysis
  );
}

export function renderAiPrImpactCliReport(analysis: AiAnalysisResult): string {
  return renderAiAnalysisReport('Nx Governance AI PR Impact', analysis);
}

export function renderAiCognitiveLoadCliReport(
  analysis: AiAnalysisResult
): string {
  return renderAiAnalysisReport(
    'Nx Governance AI Cognitive Load',
    analysis,
    [],
    'Signals'
  );
}

export function renderAiRecommendationsCliReport(
  analysis: AiAnalysisResult
): string {
  return renderAiAnalysisReport('Nx Governance AI Recommendations', analysis);
}

export function renderAiSmellClustersCliReport(
  analysis: AiAnalysisResult
): string {
  return renderAiAnalysisReport('Nx Governance AI Smell Clusters', analysis);
}

export function renderAiRefactoringSuggestionsCliReport(
  analysis: AiAnalysisResult
): string {
  return renderAiAnalysisReport(
    'Nx Governance AI Refactoring Suggestions',
    analysis
  );
}

export function renderAiScorecardCliReport(analysis: AiAnalysisResult): string {
  return renderAiAnalysisReport('Nx Governance AI Scorecard', analysis);
}

export function renderAiOnboardingCliReport(
  analysis: AiAnalysisResult
): string {
  return renderAiAnalysisReport('Nx Governance AI Onboarding', analysis);
}

function renderAiAnalysisReport(
  title: string,
  analysis: AiAnalysisResult,
  preamble: string[] = [],
  findingsLabel = 'Findings'
): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push('');

  for (const line of preamble) {
    lines.push(line);
  }

  if (preamble.length > 0) {
    lines.push('');
  }

  lines.push(`Summary: ${analysis.summary}`);

  if (analysis.findings.length > 0) {
    lines.push('');
    lines.push(`${findingsLabel}:`);
    for (const finding of analysis.findings) {
      lines.push(`- ${finding.title}: ${finding.detail}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const recommendation of analysis.recommendations) {
      lines.push(
        `- (${recommendation.priority}) ${recommendation.title} - ${recommendation.reason}`
      );
    }
  }

  return lines.join('\n');
}

function formatDriftStatus(status: string): string {
  return status[0]?.toUpperCase() + status.slice(1);
}

function formatDriftDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
}
