import type {
  DeliveryImpactAssessment,
  DeliveryImpactIndex,
  GovernanceInsight,
  GovernanceInsightDriver,
} from '../delivery-impact/index.js';

export interface RenderManagementReportOptions {
  includeTechnicalAppendix?: boolean;
}

const DELIVERY_IMPACT_INDEX_ORDER = [
  'cost-of-change',
  'time-to-market-risk',
] as const;

const MANAGEMENT_INSIGHT_ORDER = [
  'cost-of-change-risk',
  'time-to-market-risk',
  'architecture-investment-drivers',
  'delivery-impact-technical-findings',
] as const;

const TEAM_DOMAIN_DRIVER_IDS = new Set([
  'cross-domain-coordination-friction',
  'architectural-erosion-risk',
  'ownership-ambiguity',
  'change-impact-radius-pressure',
  'feature-cross-domain-impact',
  'feature-ownership-ambiguity',
  'feature-review-stakeholder-spread',
  'feature-rule-impact',
]);

export function renderManagementReport(
  assessment: DeliveryImpactAssessment,
  options: RenderManagementReportOptions = {}
): string {
  const includeTechnicalAppendix = options.includeTechnicalAppendix ?? true;
  const indices = sortIndices(assessment.indices);
  const insights = sortInsights(assessment.insights);
  const assessmentDrivers = sortDrivers(assessment.drivers);
  const topDrivers = collectTopDrivers(assessmentDrivers, insights).slice(0, 5);
  const lines: string[] = [];

  lines.push('# Governance Management Report');
  lines.push('');

  lines.push('## Management Summary');
  lines.push(`Assessment profile: ${assessment.profile}`);
  lines.push(`Generated at: ${assessment.generatedAt}`);
  lines.push(`Delivery-impact indices: ${indices.length}`);
  lines.push(renderHighestRiskSummary(indices));
  lines.push(
    topDrivers.length > 0
      ? `Top investment drivers: ${topDrivers
          .slice(0, 3)
          .map((driver) => driver.label)
          .join(', ')}.`
      : 'Top investment drivers: No data available.'
  );
  lines.push('');

  renderIndexSection(lines, indices, 'cost-of-change', 'Cost of Change Index');
  lines.push('');
  renderIndexSection(
    lines,
    indices,
    'time-to-market-risk',
    'Time-to-Market Risk Index'
  );
  lines.push('');

  lines.push('## Delivery Predictability / Trend');
  lines.push(renderPredictabilitySummary(indices, insights));
  lines.push('');

  lines.push('## Top Investment Drivers');
  if (topDrivers.length === 0) {
    lines.push('No data available.');
  } else {
    for (const driver of topDrivers) {
      lines.push(`- ${formatDriver(driver)}`);
    }
  }
  lines.push('');

  lines.push('## Team / Domain Dependency Risks');
  const dependencyRiskDrivers = topDriversForTeamAndDomainRisks(
    assessmentDrivers,
    insights
  );
  if (dependencyRiskDrivers.length === 0) {
    lines.push('No data available.');
  } else {
    for (const driver of dependencyRiskDrivers) {
      lines.push(`- ${formatDriver(driver)}`);
    }
  }
  lines.push('');

  lines.push('## Recommended Architecture Investments');
  const recommendationInsights = insights.filter(
    (insight) =>
      insight.audience === 'management' || insight.audience === 'technical-lead'
  );
  if (recommendationInsights.length === 0) {
    lines.push('No data available.');
  } else {
    for (const insight of recommendationInsights) {
      lines.push(`- ${formatRecommendation(insight)}`);
    }
  }

  if (includeTechnicalAppendix) {
    lines.push('');
    lines.push('## Technical Appendix');

    if (insights.length === 0) {
      lines.push('No data available.');
    } else {
      for (const insight of insights) {
        lines.push(`### ${insight.id}`);
        lines.push(`- audience: ${insight.audience}`);
        lines.push(`- category: ${insight.category}`);
        lines.push(`- severity: ${insight.severity}`);
        lines.push(
          `- drivers: ${renderListOrNone(
            sortDrivers(insight.drivers).map((driver) => driver.id)
          )}`
        );
        lines.push(
          `- related measurements: ${renderListOrNone(
            toSortedUniqueList(insight.relatedMeasurements)
          )}`
        );
        lines.push(
          `- related signals: ${renderListOrNone(
            toSortedUniqueList(insight.relatedSignals)
          )}`
        );
        lines.push(
          `- related violations: ${renderListOrNone(
            toSortedUniqueList(insight.relatedViolations)
          )}`
        );
      }
    }
  }

  return lines.join('\n');
}

function renderIndexSection(
  lines: string[],
  indices: DeliveryImpactIndex[],
  id: string,
  heading: string
): void {
  lines.push(`## ${heading}`);

  const index = indices.find((entry) => entry.id === id);
  if (!index) {
    lines.push(`${heading} is not available.`);
    return;
  }

  lines.push(`Score: ${index.score}/100`);
  lines.push(`Risk: ${formatCapitalized(index.risk)}`);
  lines.push(
    `Trend: ${
      index.trend ? formatCapitalized(index.trend) : 'No trend data available.'
    }`
  );

  const drivers = sortDrivers(index.drivers).slice(0, 5);
  if (drivers.length === 0) {
    lines.push('No data available.');
    return;
  }

  lines.push('Primary drivers:');
  for (const driver of drivers) {
    lines.push(`- ${formatDriver(driver)}`);
  }
}

function renderHighestRiskSummary(indices: DeliveryImpactIndex[]): string {
  const highestRiskIndex = [...indices].sort(compareIndicesByRisk)[0];
  if (!highestRiskIndex) {
    return 'Highest risk area: No data available.';
  }

  return `Highest risk area: ${highestRiskIndex.name} at ${highestRiskIndex.score}/100 (${highestRiskIndex.risk} risk).`;
}

function renderPredictabilitySummary(
  indices: DeliveryImpactIndex[],
  insights: GovernanceInsight[]
): string {
  const trendIndices = indices.filter(
    (
      index
    ): index is DeliveryImpactIndex & {
      trend: NonNullable<DeliveryImpactIndex['trend']>;
    } => index.trend !== undefined
  );

  if (trendIndices.length === 0) {
    return 'No trend data available.';
  }

  const trend = deriveOverallTrend(trendIndices);
  const trendSources = trendIndices
    .map((index) => `${index.name} (${index.trend})`)
    .join(', ');
  const supportingInsights = insights
    .filter(
      (insight) =>
        insight.audience !== 'developer' &&
        (insight.category === 'predictability' ||
          insight.category === 'delivery-risk' ||
          insight.category === 'time-to-market' ||
          insight.category === 'cost-of-change')
    )
    .map((insight) => insight.title);

  const prefix =
    trend === 'worsening'
      ? 'Delivery predictability is worsening'
      : trend === 'improving'
      ? 'Delivery predictability is improving'
      : 'Delivery predictability is stable';
  const insightSuffix =
    supportingInsights.length > 0
      ? ` Supporting insights: ${toSortedUniqueList(supportingInsights).join(
          ', '
        )}.`
      : '';

  return `${prefix} based on ${trendSources}.${insightSuffix}`;
}

function topDriversForTeamAndDomainRisks(
  drivers: GovernanceInsightDriver[],
  insights: GovernanceInsight[]
): GovernanceInsightDriver[] {
  const riskDrivers = drivers.filter((driver) =>
    TEAM_DOMAIN_DRIVER_IDS.has(driver.id)
  );
  const insightDrivers = insights
    .filter(
      (insight) =>
        insight.audience !== 'developer' &&
        insight.drivers.some((driver) => TEAM_DOMAIN_DRIVER_IDS.has(driver.id))
    )
    .flatMap((insight) => insight.drivers)
    .filter((driver) => TEAM_DOMAIN_DRIVER_IDS.has(driver.id));

  return collectUniqueDrivers([...riskDrivers, ...insightDrivers]).slice(0, 5);
}

function collectTopDrivers(
  drivers: GovernanceInsightDriver[],
  insights: GovernanceInsight[]
): GovernanceInsightDriver[] {
  const combinedDrivers = [
    ...drivers,
    ...insights
      .filter((insight) => insight.audience !== 'developer')
      .flatMap((insight) => insight.drivers),
  ];

  return collectUniqueDrivers(combinedDrivers);
}

function collectUniqueDrivers(
  drivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  const byId = new Map<string, GovernanceInsightDriver>();

  for (const driver of drivers) {
    if (!byId.has(driver.id)) {
      byId.set(driver.id, driver);
    }
  }

  return [...byId.values()].sort(compareDrivers);
}

function sortIndices(indices: DeliveryImpactIndex[]): DeliveryImpactIndex[] {
  return [...indices].sort((left, right) => {
    const leftIndex = DELIVERY_IMPACT_INDEX_ORDER.indexOf(
      left.id as (typeof DELIVERY_IMPACT_INDEX_ORDER)[number]
    );
    const rightIndex = DELIVERY_IMPACT_INDEX_ORDER.indexOf(
      right.id as (typeof DELIVERY_IMPACT_INDEX_ORDER)[number]
    );

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortInsights(insights: GovernanceInsight[]): GovernanceInsight[] {
  return [...insights].sort((left, right) => {
    const leftIndex = MANAGEMENT_INSIGHT_ORDER.indexOf(
      left.id as (typeof MANAGEMENT_INSIGHT_ORDER)[number]
    );
    const rightIndex = MANAGEMENT_INSIGHT_ORDER.indexOf(
      right.id as (typeof MANAGEMENT_INSIGHT_ORDER)[number]
    );

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortDrivers(
  drivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  return [...drivers].sort(compareDrivers);
}

function compareDrivers(
  left: GovernanceInsightDriver,
  right: GovernanceInsightDriver
): number {
  const scoreDifference =
    (right.score ?? Number.NEGATIVE_INFINITY) -
    (left.score ?? Number.NEGATIVE_INFINITY);
  if (Number.isFinite(scoreDifference) && scoreDifference !== 0) {
    return scoreDifference;
  }

  const leftNumericValue =
    typeof left.value === 'number' ? left.value : Number.NEGATIVE_INFINITY;
  const rightNumericValue =
    typeof right.value === 'number' ? right.value : Number.NEGATIVE_INFINITY;
  const valueDifference = rightNumericValue - leftNumericValue;
  if (Number.isFinite(valueDifference) && valueDifference !== 0) {
    return valueDifference;
  }

  const labelComparison = left.label.localeCompare(right.label);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareIndicesByRisk(
  left: DeliveryImpactIndex,
  right: DeliveryImpactIndex
): number {
  const riskDifference = riskRank(right.risk) - riskRank(left.risk);
  if (riskDifference !== 0) {
    return riskDifference;
  }

  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.name.localeCompare(right.name);
}

function riskRank(risk: DeliveryImpactIndex['risk']): number {
  switch (risk) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function deriveOverallTrend(
  indices: Array<
    DeliveryImpactIndex & { trend: NonNullable<DeliveryImpactIndex['trend']> }
  >
): NonNullable<DeliveryImpactIndex['trend']> {
  if (indices.some((index) => index.trend === 'worsening')) {
    return 'worsening';
  }

  if (indices.some((index) => index.trend === 'improving')) {
    return 'improving';
  }

  return 'stable';
}

function formatRecommendation(insight: GovernanceInsight): string {
  const driverLabels = sortDrivers(insight.drivers)
    .slice(0, 3)
    .map((driver) => driver.label);
  const driverSuffix =
    driverLabels.length > 0
      ? ` Priority drivers: ${driverLabels.join(', ')}.`
      : '';

  return `${insight.title}: ${insight.summary}${driverSuffix}`;
}

function formatDriver(driver: GovernanceInsightDriver): string {
  const details: string[] = [];

  if (driver.score !== undefined) {
    details.push(`score ${driver.score}/100`);
  }

  if (driver.value !== undefined) {
    if (typeof driver.value === 'number') {
      details.push(
        driver.unit
          ? `value ${driver.value} ${driver.unit}`
          : `value ${driver.value}`
      );
    } else {
      details.push(`value ${driver.value}`);
    }
  }

  if (driver.trend !== undefined) {
    details.push(`trend ${driver.trend}`);
  }

  const detailSuffix = details.length > 0 ? ` (${details.join(', ')})` : '';
  const explanationSuffix = driver.explanation ? `: ${driver.explanation}` : '';

  return `${driver.label}${detailSuffix}${explanationSuffix}`;
}

function renderListOrNone(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function toSortedUniqueList(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatCapitalized(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
