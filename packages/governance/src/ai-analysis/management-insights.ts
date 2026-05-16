import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  GovernanceAssessment,
  GovernanceTopIssue,
  Measurement,
  Recommendation,
  SignalBreakdown,
  SnapshotComparison,
  Violation,
} from '../core/index.js';
import type {
  DeliveryImpactAssessment,
  DeliveryImpactIndex,
  GovernanceInsight,
  GovernanceInsightDriver,
} from '../delivery-impact/index.js';

export interface BuildManagementInsightsAiRequestInput {
  deliveryImpact: DeliveryImpactAssessment;
  assessment?: GovernanceAssessment;
  comparison?: SnapshotComparison;
  generatedAt?: string;
  profile?: string;
  metadata?: Record<string, unknown>;
}

export interface BuildManagementInsightsPromptInput {
  request: AiAnalysisRequest;
}

interface ManagementInsightsAiMetadata {
  deliveryImpact: DeliveryImpactAssessment;
  governanceSummary?: {
    health: {
      score: number;
      status: GovernanceAssessment['health']['status'];
      grade: GovernanceAssessment['health']['grade'];
    };
    warningCount: number;
    totalViolationCount: number;
    weakestMeasurements: Array<{
      id: Measurement['id'];
      name: string;
      family: Measurement['family'];
      score: number;
      value: number;
      unit: Measurement['unit'];
    }>;
    topIssues: Array<{
      type: GovernanceTopIssue['type'];
      source: GovernanceTopIssue['source'];
      severity: GovernanceTopIssue['severity'];
      count: number;
      projects: string[];
      ruleId?: string;
      message: string;
    }>;
    topViolations: Array<{
      id: Violation['id'];
      ruleId: Violation['ruleId'];
      project: Violation['project'];
      severity: Violation['severity'];
      category: Violation['category'];
      message: Violation['message'];
    }>;
    signalBreakdown: SignalBreakdown;
  };
  comparisonSummary?: {
    healthDelta?: SnapshotComparison['healthDelta'];
    deliveryImpactIndexDeltas?: NonNullable<
      SnapshotComparison['deliveryImpactIndexDeltas']
    >;
    topIssueDeltas?: NonNullable<SnapshotComparison['topIssueDeltas']>;
    metricFamilyDeltas?: NonNullable<SnapshotComparison['metricFamilyDeltas']>;
  };
  traceability: {
    indexIds: string[];
    insightIds: string[];
    driverIds: string[];
    comparisonIncluded: boolean;
  };
}

const KNOWN_INDEX_ORDER: Record<string, number> = {
  'cost-of-change': 0,
  'time-to-market-risk': 1,
  'feature-impact': 2,
};

const AUDIENCE_ORDER: Record<GovernanceInsight['audience'], number> = {
  management: 0,
  'technical-lead': 1,
  developer: 2,
};

const INSIGHT_SEVERITY_ORDER: Record<GovernanceInsight['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const RISK_ORDER: Record<DeliveryImpactIndex['risk'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const SIGNAL_SEVERITY_ORDER: Record<GovernanceTopIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const VIOLATION_SEVERITY_ORDER: Record<Violation['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function buildManagementInsightsAiRequest(
  input: BuildManagementInsightsAiRequestInput
): AiAnalysisRequest {
  const deliveryImpact = sortDeliveryImpactAssessment(input.deliveryImpact);
  const metadata: ManagementInsightsAiMetadata = {
    deliveryImpact,
    governanceSummary: input.assessment
      ? buildGovernanceSummary(input.assessment)
      : undefined,
    comparisonSummary: input.comparison
      ? buildComparisonSummary(input.comparison)
      : undefined,
    traceability: {
      indexIds: deliveryImpact.indices.map((index) => index.id),
      insightIds: deliveryImpact.insights.map((insight) => insight.id),
      driverIds: deliveryImpact.drivers.map((driver) => driver.id),
      comparisonIncluded: Boolean(input.comparison),
    },
  };

  return {
    kind: 'management-insights',
    generatedAt:
      input.generatedAt ??
      deliveryImpact.generatedAt ??
      new Date().toISOString(),
    profile: input.profile ?? deliveryImpact.profile,
    inputs: {
      metadata: sortRecord({
        ...metadata,
        ...(input.metadata ? sortRecord(input.metadata) : {}),
      }),
    },
  };
}

export function buildManagementInsightsPrompt(
  input: BuildManagementInsightsPromptInput
): string {
  return [
    '# Governance Management Insights AI Prompt',
    '',
    '## Role',
    'You are a governance management insights assistant.',
    '',
    '## Request Context',
    `- Request kind: ${input.request.kind}`,
    `- Profile: ${input.request.profile}`,
    `- Generated at: ${input.request.generatedAt}`,
    '',
    '## Task',
    'Interpret the supplied governance delivery-impact payload for managers and technical leads.',
    '',
    '## Grounding Constraints',
    '- Use only the information provided in the payload JSON.',
    '- Treat Cost of Change and Time-to-Market values as relative 0..100 risk indicators, not financial estimates.',
    '- Treat Time-to-Market Risk as coordination and delivery-speed pressure, not a delivery-date forecast.',
    '- Do not invent business strategy, financial savings, roadmap commitments, or missing organizational context.',
    '- If evidence is missing, state that clearly instead of assuming.',
    '- Reference concrete index ids, driver ids, insight ids, measurements, signals, and violations from the payload.',
    '',
    '## Output Goals',
    '- Management Interpretation: concise explanation of the most important delivery frictions and coordination risks.',
    '- Technical Lead Actions: grounded architecture actions and investment priorities tied to payload evidence.',
    '- Traceability: cite the concrete indices, drivers, insights, measurements, signals, and violations that support each point.',
    '',
    '## Safety and Discipline Constraints',
    '- Do not claim exact financial cost, ROI, or budget impact.',
    '- Do not predict delivery dates or lead time from these indices.',
    '- Do not generalize beyond the supplied governance and delivery-impact evidence.',
    '- Mark heuristics explicitly as heuristics when evidence is indirect.',
  ].join('\n');
}

export function summarizeManagementInsights(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = readManagementInsightsMetadata(request);
  const deliveryImpact = metadata?.deliveryImpact;

  if (!deliveryImpact || deliveryImpact.indices.length === 0) {
    return {
      kind: 'management-insights',
      summary:
        'No delivery-impact indices were available for management-insights AI handoff.',
      findings: [
        {
          id: 'no-delivery-impact-indices',
          title: 'No delivery-impact indices',
          detail:
            'The payload did not include Cost of Change, Time-to-Market Risk, or other delivery-impact indices to interpret.',
          signals: ['delivery-impact'],
          confidence: 1,
        },
      ],
      recommendations: [],
      metadata: {
        indexCount: 0,
      },
    };
  }

  const indices = deliveryImpact.indices;
  const highestRiskIndex = [...indices].sort(compareIndicesForPriority)[0];
  const topDriver = deliveryImpact.drivers[0];
  const managementInsights = deliveryImpact.insights.filter(
    (insight) => insight.audience === 'management'
  );
  const technicalLeadInsights = deliveryImpact.insights.filter(
    (insight) => insight.audience === 'technical-lead'
  );
  const worseningIndices =
    metadata?.comparisonSummary?.deliveryImpactIndexDeltas?.filter(
      (delta) => delta.scoreDelta > 0
    ) ?? [];

  const findings = [
    {
      id: `index-${highestRiskIndex.id}`,
      title: `${highestRiskIndex.name} is the highest current delivery pressure`,
      detail: buildIndexFindingDetail(highestRiskIndex),
      signals: highestRiskIndex.drivers.map((driver) => driver.id),
      confidence: 1,
    },
    ...(topDriver
      ? [
          {
            id: `driver-${topDriver.id}`,
            title: `Primary investment driver: ${topDriver.label}`,
            detail: buildDriverFindingDetail(topDriver),
            signals: [topDriver.id],
            confidence: topDriver.score
              ? normalizeConfidence(topDriver.score)
              : undefined,
          },
        ]
      : []),
    ...(worseningIndices.length > 0
      ? [
          {
            id: 'worsening-delivery-trend',
            title: 'Recent trend pressure is worsening',
            detail: `Worsening index deltas were recorded for ${worseningIndices
              .map((delta) => delta.id)
              .sort((left, right) => left.localeCompare(right))
              .join(', ')}.`,
            signals: worseningIndices
              .map((delta) => delta.id)
              .sort((left, right) => left.localeCompare(right)),
            confidence: 1,
          },
        ]
      : []),
    ...[...managementInsights, ...technicalLeadInsights]
      .sort(compareInsightsForPriority)
      .slice(0, 2)
      .map((insight) => ({
        id: `insight-${insight.id}`,
        title: insight.title,
        detail: insight.summary,
        signals: [
          ...insight.relatedMeasurements,
          ...insight.relatedSignals,
          ...insight.relatedViolations,
        ].sort((left, right) => left.localeCompare(right)),
        confidence: 1,
      })),
  ];

  return {
    kind: 'management-insights',
    summary: `Prepared AI handoff input for ${indices.length} delivery-impact indices. Highest current pressure: ${highestRiskIndex.name} (${highestRiskIndex.risk}, score ${highestRiskIndex.score}).`,
    findings,
    recommendations: buildInsightRecommendations(deliveryImpact.insights),
    metadata: {
      highestRiskIndexId: highestRiskIndex.id,
      managementInsightCount: managementInsights.length,
      technicalLeadInsightCount: technicalLeadInsights.length,
      worseningIndexCount: worseningIndices.length,
    },
  };
}

function buildGovernanceSummary(
  assessment: GovernanceAssessment
): ManagementInsightsAiMetadata['governanceSummary'] {
  return {
    health: {
      score: assessment.health.score,
      status: assessment.health.status,
      grade: assessment.health.grade,
    },
    warningCount: assessment.warnings.length,
    totalViolationCount: assessment.violations.length,
    weakestMeasurements: [...assessment.measurements]
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.id.localeCompare(right.id) ||
          left.name.localeCompare(right.name)
      )
      .slice(0, 10)
      .map((measurement) => ({
        id: measurement.id,
        name: measurement.name,
        family: measurement.family,
        score: measurement.score,
        value: measurement.value,
        unit: measurement.unit,
      })),
    topIssues: [...assessment.topIssues]
      .sort(compareTopIssuesForPriority)
      .slice(0, 10)
      .map((issue) => ({
        type: issue.type,
        source: issue.source,
        severity: issue.severity,
        count: issue.count,
        projects: [...issue.projects].sort((left, right) =>
          left.localeCompare(right)
        ),
        ruleId: issue.ruleId,
        message: issue.message,
      })),
    topViolations: [...assessment.violations]
      .sort(compareViolationsForPriority)
      .slice(0, 10)
      .map((violation) => ({
        id: violation.id,
        ruleId: violation.ruleId,
        project: violation.project,
        severity: violation.severity,
        category: violation.category,
        message: violation.message,
      })),
    signalBreakdown: sortSignalBreakdown(assessment.signalBreakdown),
  };
}

function buildComparisonSummary(
  comparison: SnapshotComparison
): NonNullable<ManagementInsightsAiMetadata['comparisonSummary']> {
  return {
    healthDelta: comparison.healthDelta,
    deliveryImpactIndexDeltas: comparison.deliveryImpactIndexDeltas
      ? [...comparison.deliveryImpactIndexDeltas].sort((left, right) =>
          left.id.localeCompare(right.id)
        )
      : undefined,
    topIssueDeltas: comparison.topIssueDeltas
      ? [...comparison.topIssueDeltas].sort(
          (left, right) =>
            Math.abs(right.delta) - Math.abs(left.delta) ||
            (left.ruleId ?? '').localeCompare(right.ruleId ?? '') ||
            left.message.localeCompare(right.message)
        )
      : undefined,
    metricFamilyDeltas: comparison.metricFamilyDeltas
      ? [...comparison.metricFamilyDeltas].sort(
          (left, right) =>
            Math.abs(right.delta) - Math.abs(left.delta) ||
            left.family.localeCompare(right.family)
        )
      : undefined,
  };
}

function sortDeliveryImpactAssessment(
  deliveryImpact: DeliveryImpactAssessment
): DeliveryImpactAssessment {
  return {
    ...deliveryImpact,
    indices: [...deliveryImpact.indices]
      .map((index) => ({
        ...index,
        drivers: sortDrivers(index.drivers),
      }))
      .sort(compareIndicesForOutput),
    insights: [...deliveryImpact.insights]
      .map((insight) => ({
        ...insight,
        drivers: sortDrivers(insight.drivers),
        relatedMeasurements: [...insight.relatedMeasurements].sort((a, b) =>
          a.localeCompare(b)
        ),
        relatedSignals: [...insight.relatedSignals].sort((a, b) =>
          a.localeCompare(b)
        ),
        relatedViolations: [...insight.relatedViolations].sort((a, b) =>
          a.localeCompare(b)
        ),
      }))
      .sort(compareInsightsForPriority),
    drivers: sortDrivers(deliveryImpact.drivers),
  };
}

function sortDrivers(
  drivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  return [...drivers].sort(compareDriversForPriority);
}

function sortSignalBreakdown(
  signalBreakdown: SignalBreakdown
): SignalBreakdown {
  return {
    total: signalBreakdown.total,
    bySource: [...signalBreakdown.bySource].sort(
      (left, right) =>
        right.count - left.count || left.source.localeCompare(right.source)
    ),
    byType: [...signalBreakdown.byType].sort(
      (left, right) =>
        right.count - left.count || left.type.localeCompare(right.type)
    ),
    bySeverity: [...signalBreakdown.bySeverity].sort(
      (left, right) =>
        right.count - left.count || left.severity.localeCompare(right.severity)
    ),
  };
}

function compareIndicesForOutput(
  left: DeliveryImpactIndex,
  right: DeliveryImpactIndex
): number {
  return (
    (KNOWN_INDEX_ORDER[left.id] ?? Number.MAX_SAFE_INTEGER) -
      (KNOWN_INDEX_ORDER[right.id] ?? Number.MAX_SAFE_INTEGER) ||
    left.id.localeCompare(right.id)
  );
}

function compareIndicesForPriority(
  left: DeliveryImpactIndex,
  right: DeliveryImpactIndex
): number {
  return (
    RISK_ORDER[left.risk] - RISK_ORDER[right.risk] ||
    right.score - left.score ||
    compareIndicesForOutput(left, right)
  );
}

function compareDriversForPriority(
  left: GovernanceInsightDriver,
  right: GovernanceInsightDriver
): number {
  const leftScore = typeof left.score === 'number' ? left.score : -1;
  const rightScore = typeof right.score === 'number' ? right.score : -1;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftValue = typeof left.value === 'number' ? left.value : -1;
  const rightValue = typeof right.value === 'number' ? right.value : -1;

  if (rightValue !== leftValue) {
    return rightValue - leftValue;
  }

  const leftLabel = `${left.label}|${left.id}`;
  const rightLabel = `${right.label}|${right.id}`;

  return leftLabel.localeCompare(rightLabel);
}

function compareInsightsForPriority(
  left: GovernanceInsight,
  right: GovernanceInsight
): number {
  return (
    AUDIENCE_ORDER[left.audience] - AUDIENCE_ORDER[right.audience] ||
    INSIGHT_SEVERITY_ORDER[left.severity] -
      INSIGHT_SEVERITY_ORDER[right.severity] ||
    left.id.localeCompare(right.id)
  );
}

function compareTopIssuesForPriority(
  left: GovernanceTopIssue,
  right: GovernanceTopIssue
): number {
  return (
    SIGNAL_SEVERITY_ORDER[left.severity] -
      SIGNAL_SEVERITY_ORDER[right.severity] ||
    right.count - left.count ||
    (left.ruleId ?? '').localeCompare(right.ruleId ?? '') ||
    left.message.localeCompare(right.message)
  );
}

function compareViolationsForPriority(
  left: Violation,
  right: Violation
): number {
  return (
    VIOLATION_SEVERITY_ORDER[left.severity] -
      VIOLATION_SEVERITY_ORDER[right.severity] ||
    left.project.localeCompare(right.project) ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.message.localeCompare(right.message)
  );
}

function buildInsightRecommendations(
  insights: GovernanceInsight[]
): Recommendation[] {
  return insights
    .filter(
      (insight) =>
        insight.audience === 'management' ||
        insight.audience === 'technical-lead'
    )
    .sort(compareInsightsForPriority)
    .slice(0, 5)
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      priority: toRecommendationPriority(insight.severity),
      reason: insight.summary,
    }));
}

function toRecommendationPriority(
  severity: GovernanceInsight['severity']
): Recommendation['priority'] {
  return severity === 'high'
    ? 'high'
    : severity === 'medium'
    ? 'medium'
    : 'low';
}

function buildIndexFindingDetail(index: DeliveryImpactIndex): string {
  const leadDrivers = index.drivers
    .slice(0, 3)
    .map((driver) => driver.label)
    .join(', ');

  return `${index.name} is ${index.risk} at score ${index.score}${
    index.trend ? ` with a ${index.trend} trend` : ''
  }${leadDrivers ? `. Lead drivers: ${leadDrivers}.` : '.'}`;
}

function buildDriverFindingDetail(driver: GovernanceInsightDriver): string {
  const valueText =
    driver.value !== undefined
      ? ` value ${String(driver.value)}${driver.unit ? ` ${driver.unit}` : ''}`
      : '';
  const scoreText =
    typeof driver.score === 'number' ? ` with score ${driver.score}` : '';
  const trendText = driver.trend ? ` and ${driver.trend} trend` : '';

  return `${driver.label}${valueText}${scoreText}${trendText}.${
    driver.explanation ? ` ${driver.explanation}` : ''
  }`;
}

function normalizeConfidence(score: number): number {
  return Number(Math.max(0, Math.min(1, score / 100)).toFixed(2));
}

function readManagementInsightsMetadata(
  request: AiAnalysisRequest
): ManagementInsightsAiMetadata | undefined {
  const metadata = request.inputs.metadata;

  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  return metadata as unknown as ManagementInsightsAiMetadata;
}

function sortRecord(record: Record<string, unknown>): Record<string, unknown> {
  const sortedEntries = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, sortUnknown(value)] as const);

  return Object.fromEntries(sortedEntries);
}

function sortUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortUnknown(entry));
  }

  if (value && typeof value === 'object') {
    return sortRecord(value as Record<string, unknown>);
  }

  return value;
}
