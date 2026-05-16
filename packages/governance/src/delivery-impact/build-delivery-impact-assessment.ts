import type {
  GovernanceAssessment,
  GovernanceTopIssue,
  Measurement,
  SnapshotComparison,
  Violation,
} from '../core/index.js';
import { calculateCostOfChangeIndex } from './cost-of-change-index.js';
import type { FeatureImpactAssessment } from './feature-impact-assessment.js';
import { mapGovernanceDrivers } from './map-governance-drivers.js';
import { calculateTimeToMarketRiskIndex } from './time-to-market-risk-index.js';
import type {
  DeliveryImpactAssessment,
  DeliveryImpactIndex,
  GovernanceInsight,
  GovernanceInsightDriver,
} from './models.js';

export interface BuildDeliveryImpactAssessmentInput {
  assessment: GovernanceAssessment;
  comparison?: SnapshotComparison;
  featureImpact?: FeatureImpactAssessment;
}

const DELIVERY_IMPACT_INDEX_ORDER = [
  'cost-of-change',
  'time-to-market-risk',
] as const;

const DELIVERY_IMPACT_INSIGHT_ORDER = [
  'cost-of-change-risk',
  'time-to-market-risk',
  'architecture-investment-drivers',
  'delivery-impact-technical-findings',
] as const;

const DELIVERY_IMPACT_DRIVER_ORDER = [
  'cross-domain-coordination-friction',
  'architectural-erosion-risk',
  'ownership-ambiguity',
  'change-impact-radius-pressure',
  'cost-of-change-pressure',
  'onboarding-friction',
  'delivery-predictability-pressure',
  'architecture-investment-priority',
  'feature-impact-radius',
  'feature-cross-domain-impact',
  'feature-ownership-ambiguity',
  'feature-review-stakeholder-spread',
  'feature-rule-impact',
] as const;

const DRIVER_MEASUREMENT_IDS: Record<string, string[]> = {
  'cross-domain-coordination-friction': ['domain-integrity'],
  'architectural-erosion-risk': ['layer-integrity'],
  'ownership-ambiguity': ['ownership-coverage'],
  'change-impact-radius-pressure': ['dependency-complexity'],
  'cost-of-change-pressure': ['architectural-entropy'],
  'onboarding-friction': ['documentation-completeness'],
};

export function buildDeliveryImpactAssessment(
  input: BuildDeliveryImpactAssessmentInput
): DeliveryImpactAssessment {
  const { assessment, comparison, featureImpact } = input;
  const mappedDrivers = mapGovernanceDrivers({
    assessment,
    comparison,
  });
  const costOfChangeIndex = calculateCostOfChangeIndex({
    assessment,
    comparison,
    drivers: mappedDrivers,
  });
  const timeToMarketRiskIndex = calculateTimeToMarketRiskIndex({
    assessment,
    comparison,
    drivers: mappedDrivers,
  });
  const indices = sortIndices([costOfChangeIndex, timeToMarketRiskIndex]);
  const drivers = mergeDrivers(mappedDrivers, featureImpact?.drivers ?? []);
  const insights = buildInsights({
    assessment,
    indices,
    drivers,
    featureImpact,
  });

  return {
    generatedAt: new Date().toISOString(),
    profile: assessment.profile,
    indices,
    insights,
    drivers,
  };
}

function buildInsights(input: {
  assessment: GovernanceAssessment;
  indices: DeliveryImpactIndex[];
  drivers: GovernanceInsightDriver[];
  featureImpact?: FeatureImpactAssessment;
}): GovernanceInsight[] {
  const { assessment, indices, drivers, featureImpact } = input;
  const costIndex = indices.find((index) => index.id === 'cost-of-change');
  const timeIndex = indices.find((index) => index.id === 'time-to-market-risk');
  const nonLowIndexSeverity = highestRisk(indices.map((index) => index.risk));

  const insights = [
    buildManagementInsight({
      id: 'cost-of-change-risk',
      audience: 'management',
      category: 'cost-of-change',
      title: 'Cost of Change Risk',
      index: costIndex,
      assessment,
    }),
    buildManagementInsight({
      id: 'time-to-market-risk',
      audience: 'management',
      category: 'time-to-market',
      title: 'Time-to-Market Risk',
      index: timeIndex,
      assessment,
    }),
    buildArchitectureInvestmentInsight({
      assessment,
      drivers,
      featureImpact,
      severity: featureImpact
        ? highestRisk([nonLowIndexSeverity, featureImpact.deliveryRisk])
        : nonLowIndexSeverity,
    }),
    buildTechnicalFindingsInsight({
      assessment,
      drivers,
      featureImpact,
      severity: featureImpact
        ? highestRisk([nonLowIndexSeverity, featureImpact.deliveryRisk])
        : nonLowIndexSeverity,
    }),
  ].filter((insight): insight is GovernanceInsight => insight !== undefined);

  return dedupeInsights(insights).sort(compareInsights);
}

function buildManagementInsight(input: {
  id: string;
  audience: GovernanceInsight['audience'];
  category: GovernanceInsight['category'];
  title: string;
  index: DeliveryImpactIndex | undefined;
  assessment: GovernanceAssessment;
}): GovernanceInsight | undefined {
  const { index, assessment } = input;
  if (!index || index.risk === 'low') {
    return undefined;
  }

  return {
    id: input.id,
    audience: input.audience,
    category: input.category,
    severity: index.risk,
    title: input.title,
    summary: `${index.name} is ${index.score}/100 with ${index.risk} risk.`,
    drivers: selectTopDrivers(index.drivers, 3),
    relatedMeasurements: relatedMeasurementIdsForDrivers(
      index.drivers,
      assessment.measurements
    ),
    relatedSignals: relatedSignalTypesForDrivers(
      index.drivers,
      assessment.topIssues
    ),
    relatedViolations: relatedViolationIdsForDrivers(
      index.drivers,
      assessment.violations
    ),
  };
}

function buildArchitectureInvestmentInsight(input: {
  assessment: GovernanceAssessment;
  drivers: GovernanceInsightDriver[];
  featureImpact?: FeatureImpactAssessment;
  severity: GovernanceInsight['severity'];
}): GovernanceInsight | undefined {
  const technicalDrivers = selectTopDrivers(
    input.drivers.filter(
      (driver) => driver.id !== 'feature-review-stakeholder-spread'
    ),
    3
  );

  if (
    technicalDrivers.length === 0 ||
    (input.severity === 'low' &&
      input.assessment.topIssues.length === 0 &&
      !input.featureImpact)
  ) {
    return undefined;
  }

  const summary =
    input.featureImpact !== undefined
      ? `Top delivery-impact drivers are ${technicalDrivers
          .map((driver) => driver.label)
          .join(', ')}. Feature impact radius is ${
          input.featureImpact.impactRadius
        }.`
      : `Top delivery-impact drivers are ${technicalDrivers
          .map((driver) => driver.label)
          .join(', ')}.`;

  return {
    id: 'architecture-investment-drivers',
    audience: 'technical-lead',
    category: 'delivery-risk',
    severity: input.severity,
    title: 'Architecture Investment Drivers',
    summary,
    drivers: technicalDrivers,
    relatedMeasurements: relatedMeasurementIdsForDrivers(
      technicalDrivers,
      input.assessment.measurements
    ),
    relatedSignals: relatedSignalTypesForDrivers(
      technicalDrivers,
      input.assessment.topIssues
    ),
    relatedViolations: relatedViolationIdsForDrivers(
      technicalDrivers,
      input.assessment.violations
    ),
  };
}

function buildTechnicalFindingsInsight(input: {
  assessment: GovernanceAssessment;
  drivers: GovernanceInsightDriver[];
  featureImpact?: FeatureImpactAssessment;
  severity: GovernanceInsight['severity'];
}): GovernanceInsight | undefined {
  const hasFeatureImpactScope =
    input.featureImpact !== undefined &&
    (input.featureImpact.drivers.length > 0 ||
      input.featureImpact.affectedProjects.length > 0 ||
      input.featureImpact.affectedRules.length > 0);
  const hasConcreteFindings =
    input.assessment.violations.length > 0 ||
    input.assessment.topIssues.length > 0 ||
    hasFeatureImpactScope;

  if (!hasConcreteFindings) {
    return undefined;
  }

  const featureDrivers = input.featureImpact?.drivers ?? [];
  const combinedDrivers = mergeDrivers(
    input.drivers.filter((driver) =>
      [
        'cross-domain-coordination-friction',
        'architectural-erosion-risk',
        'ownership-ambiguity',
        'change-impact-radius-pressure',
        'delivery-predictability-pressure',
      ].includes(driver.id)
    ),
    featureDrivers
  );

  const summary =
    input.featureImpact !== undefined
      ? `${input.assessment.violations.length} related violations, ${input.assessment.topIssues.length} top issues, and ${input.featureImpact.affectedProjects.length} affected projects are in scope.`
      : `${input.assessment.violations.length} related violations and ${input.assessment.topIssues.length} top issues remain relevant to delivery impact.`;

  return {
    id: 'delivery-impact-technical-findings',
    audience: 'developer',
    category: 'delivery-risk',
    severity: deriveDeveloperSeverity(
      input.assessment.violations,
      input.severity,
      input.featureImpact?.deliveryRisk
    ),
    title: 'Delivery Impact Technical Findings',
    summary,
    drivers: selectTopDrivers(combinedDrivers, 4),
    relatedMeasurements: relatedMeasurementIdsForDrivers(
      combinedDrivers,
      input.assessment.measurements
    ),
    relatedSignals: toSortedUniqueList(
      input.assessment.topIssues.map((issue) => issue.type)
    ),
    relatedViolations: toSortedUniqueList(
      input.assessment.violations.map((violation) => violation.id)
    ),
  };
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

function mergeDrivers(
  primaryDrivers: GovernanceInsightDriver[],
  secondaryDrivers: GovernanceInsightDriver[]
): GovernanceInsightDriver[] {
  const byId = new Map<string, GovernanceInsightDriver>();

  for (const driver of [...primaryDrivers, ...secondaryDrivers]) {
    if (!byId.has(driver.id)) {
      byId.set(driver.id, driver);
    }
  }

  return [...byId.values()].sort(compareDrivers);
}

function compareDrivers(
  left: GovernanceInsightDriver,
  right: GovernanceInsightDriver
): number {
  const leftIndex = DELIVERY_IMPACT_DRIVER_ORDER.indexOf(
    left.id as (typeof DELIVERY_IMPACT_DRIVER_ORDER)[number]
  );
  const rightIndex = DELIVERY_IMPACT_DRIVER_ORDER.indexOf(
    right.id as (typeof DELIVERY_IMPACT_DRIVER_ORDER)[number]
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
}

function compareInsights(
  left: GovernanceInsight,
  right: GovernanceInsight
): number {
  const leftIndex = DELIVERY_IMPACT_INSIGHT_ORDER.indexOf(
    left.id as (typeof DELIVERY_IMPACT_INSIGHT_ORDER)[number]
  );
  const rightIndex = DELIVERY_IMPACT_INSIGHT_ORDER.indexOf(
    right.id as (typeof DELIVERY_IMPACT_INSIGHT_ORDER)[number]
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
}

function dedupeInsights(insights: GovernanceInsight[]): GovernanceInsight[] {
  const byId = new Map<string, GovernanceInsight>();

  for (const insight of insights) {
    if (!byId.has(insight.id)) {
      byId.set(insight.id, insight);
    }
  }

  return [...byId.values()];
}

function selectTopDrivers(
  drivers: GovernanceInsightDriver[],
  count: number
): GovernanceInsightDriver[] {
  return drivers.slice(0, count);
}

function relatedMeasurementIdsForDrivers(
  drivers: GovernanceInsightDriver[],
  measurements: Measurement[]
): string[] {
  const availableIds = new Set(
    measurements.map((measurement) => measurement.id)
  );
  const ids = drivers.flatMap(
    (driver) => DRIVER_MEASUREMENT_IDS[driver.id] ?? []
  );

  return toSortedUniqueList(ids.filter((id) => availableIds.has(id)));
}

function relatedSignalTypesForDrivers(
  drivers: GovernanceInsightDriver[],
  topIssues: GovernanceTopIssue[]
): string[] {
  const matchedIssueTypes = topIssues
    .filter((issue) =>
      drivers.some((driver) => issueMatchesDriver(issue, driver.id))
    )
    .map((issue) => issue.type);

  return toSortedUniqueList(matchedIssueTypes);
}

function relatedViolationIdsForDrivers(
  drivers: GovernanceInsightDriver[],
  violations: Violation[]
): string[] {
  const matchedViolationIds = violations
    .filter((violation) =>
      drivers.some((driver) => violationMatchesDriver(violation, driver.id))
    )
    .map((violation) => violation.id);

  return toSortedUniqueList(matchedViolationIds);
}

function issueMatchesDriver(
  issue: GovernanceTopIssue,
  driverId: string
): boolean {
  const text = `${issue.type} ${issue.ruleId ?? ''} ${
    issue.message
  }`.toLowerCase();

  switch (driverId) {
    case 'cross-domain-coordination-friction':
      return (
        issue.type === 'domain-boundary-violation' ||
        issue.type === 'cross-domain-dependency' ||
        text.includes('cross-domain') ||
        text.includes('domain boundary')
      );
    case 'architectural-erosion-risk':
      return (
        issue.type === 'layer-boundary-violation' ||
        text.includes('layer boundary')
      );
    case 'ownership-ambiguity':
      return issue.type === 'ownership-gap' || text.includes('ownership');
    case 'change-impact-radius-pressure':
      return (
        issue.type === 'structural-dependency' ||
        issue.type === 'circular-dependency' ||
        text.includes('dependency') ||
        text.includes('fanout') ||
        text.includes('coupling')
      );
    case 'cost-of-change-pressure':
      return (
        text.includes('entropy') ||
        text.includes('erosion') ||
        text.includes('drift')
      );
    case 'onboarding-friction':
      return text.includes('documentation') || text.includes('docs');
    case 'delivery-predictability-pressure':
    case 'architecture-investment-priority':
      return true;
    default:
      return false;
  }
}

function violationMatchesDriver(
  violation: Violation,
  driverId: string
): boolean {
  const text =
    `${violation.category} ${violation.ruleId} ${violation.message}`.toLowerCase();

  switch (driverId) {
    case 'cross-domain-coordination-friction':
      return (
        violation.category === 'boundary' &&
        (text.includes('cross-domain') || text.includes('domain-boundary'))
      );
    case 'architectural-erosion-risk':
      return violation.category === 'boundary' && text.includes('layer');
    case 'ownership-ambiguity':
      return violation.category === 'ownership' || text.includes('ownership');
    case 'change-impact-radius-pressure':
      return (
        violation.category === 'dependency' ||
        text.includes('dependency') ||
        text.includes('fanout') ||
        text.includes('coupling')
      );
    case 'cost-of-change-pressure':
      return (
        text.includes('entropy') ||
        text.includes('erosion') ||
        text.includes('drift')
      );
    case 'onboarding-friction':
      return violation.category === 'documentation' || text.includes('docs');
    case 'delivery-predictability-pressure':
    case 'architecture-investment-priority':
      return true;
    default:
      return false;
  }
}

function highestRisk(
  risks: Array<
    | DeliveryImpactIndex['risk']
    | FeatureImpactAssessment['deliveryRisk']
    | undefined
  >
): GovernanceInsight['severity'] {
  if (risks.includes('high')) {
    return 'high';
  }

  if (risks.includes('medium')) {
    return 'medium';
  }

  return 'low';
}

function deriveDeveloperSeverity(
  violations: Violation[],
  defaultSeverity: GovernanceInsight['severity'],
  featureRisk?: FeatureImpactAssessment['deliveryRisk']
): GovernanceInsight['severity'] {
  if (violations.some((violation) => violation.severity === 'error')) {
    return 'high';
  }

  if (
    featureRisk === 'high' ||
    violations.some((violation) => violation.severity === 'warning')
  ) {
    return defaultSeverity === 'low' ? 'medium' : defaultSeverity;
  }

  return defaultSeverity;
}

function toSortedUniqueList(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
