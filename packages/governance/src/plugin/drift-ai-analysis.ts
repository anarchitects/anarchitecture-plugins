import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  DriftSignal,
  DriftSummary,
} from '@anarchitects/governance-core';

export function summarizeDriftInterpretation(
  request: AiAnalysisRequest,
  signals: DriftSignal[],
  summary: DriftSummary
): AiAnalysisResult {
  const findings = signals.map((signal) => ({
    id: `drift-${signal.id}`,
    title: signal.label,
    detail: `Status is ${signal.status} with delta ${formatDriftDelta(
      signal.delta
    )} and magnitude ${signal.magnitude.toFixed(3)}.`,
    signals: ['drift-analysis', 'snapshot-comparison'],
    confidence: 1,
  }));

  const recommendations: AiAnalysisResult['recommendations'] = [
    {
      id: 'drift-review-regressing-signals',
      title: 'Review Regressing Signals First',
      priority: summary.worseningCount > 0 ? 'high' : 'low',
      reason:
        summary.worseningCount > 0
          ? `There are ${summary.worseningCount} worsening drift signals. Prioritize investigation of those signals before broader refactoring.`
          : 'No worsening drift signals were detected in this comparison window.',
    },
    {
      id: 'drift-validate-trend-window',
      title: 'Validate Trend Window Confidence',
      priority: 'medium',
      reason:
        request.inputs.metadata &&
        typeof request.inputs.metadata['trendWindowInsufficient'] ===
          'boolean' &&
        request.inputs.metadata['trendWindowInsufficient']
          ? 'Fewer than four snapshots were available. Treat conclusions as provisional and continue collecting trend data.'
          : 'Trend window is sufficient for directional interpretation. Continue monitoring for persistence across future snapshots.',
    },
  ];

  return {
    kind: 'drift',
    summary: `Deterministic drift interpretation indicates a ${summary.overallTrend} trend (${summary.worseningCount} worsening, ${summary.improvingCount} improving, ${summary.stableCount} stable).`,
    findings,
    recommendations,
    metadata: {
      trend: summary.overallTrend,
      worseningCount: summary.worseningCount,
      improvingCount: summary.improvingCount,
      stableCount: summary.stableCount,
      signalCount: signals.length,
      topWorsening: summary.topWorsening,
      topImproving: summary.topImproving,
      ...request.inputs.metadata,
    },
  };
}

function formatDriftDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
}
