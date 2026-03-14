import {
  AiAnalysisResult,
  AiAnalysisRequest,
  GovernanceDependency,
  MetricSnapshot,
  Recommendation,
  SnapshotComparison,
  SnapshotViolation,
} from '../core/index.js';

export function buildRootCauseRequest(params: {
  profile: string;
  snapshot: MetricSnapshot;
  dependencies: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'root-cause',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      snapshot: params.snapshot,
      dependencies: params.dependencies,
      topViolations: params.topViolations,
      metadata: params.metadata,
    },
  };
}

export function buildPrImpactRequest(params: {
  profile: string;
  affectedProjects: string[];
  dependencies: GovernanceDependency[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'pr-impact',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      affectedProjects: params.affectedProjects,
      dependencies: params.dependencies,
      metadata: params.metadata,
    },
  };
}

export function buildScorecardRequest(params: {
  profile: string;
  snapshot: MetricSnapshot;
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'scorecard',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      snapshot: params.snapshot,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildOnboardingRequest(params: {
  profile: string;
  dependencies: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'onboarding',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      dependencies: params.dependencies,
      topViolations: params.topViolations,
      metadata: params.metadata,
    },
  };
}

export function buildCognitiveLoadRequest(params: {
  profile: string;
  affectedProjects: string[];
  dependencies: GovernanceDependency[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'cognitive-load',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      affectedProjects: params.affectedProjects,
      dependencies: params.dependencies,
      metadata: params.metadata,
    },
  };
}

export function buildArchitectureRecommendationsRequest(params: {
  profile: string;
  dependencies: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'recommendations',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      dependencies: params.dependencies,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildSmellClustersRequest(params: {
  profile: string;
  dependencies: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'smell-clusters',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      dependencies: params.dependencies,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildRefactoringSuggestionsRequest(params: {
  profile: string;
  dependencies: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'refactoring-suggestions',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      dependencies: params.dependencies,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function rankTopViolations(
  violations: SnapshotViolation[],
  limit = 10
): SnapshotViolation[] {
  const severityWeight: Record<string, number> = {
    error: 3,
    warning: 2,
    info: 1,
  };

  return [...violations]
    .sort((a, b) => {
      const severityDelta =
        (severityWeight[b.severity ?? 'info'] ?? 0) -
        (severityWeight[a.severity ?? 'info'] ?? 0);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return toViolationKey(a).localeCompare(toViolationKey(b));
    })
    .slice(0, Math.max(0, limit));
}

export function summarizeRootCause(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const violations = request.inputs.topViolations ?? [];
  const sourceCounts = countBy(violations, (violation) => violation.source);
  const typeCounts = countBy(violations, (violation) => violation.type);

  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);

  const findings = topSources.map(([source, count], index) => ({
    id: `hotspot-${index + 1}`,
    title: `Hotspot: ${source}`,
    detail: `${source} appears in ${count} of ${violations.length} prioritized violations.`,
    signals: ['top-violations', 'frequency'],
    confidence: violations.length > 0 ? count / violations.length : 0,
  }));

  if (findings.length === 0) {
    findings.push({
      id: 'no-prioritized-violations',
      title: 'No prioritized violations',
      detail:
        'No prioritized violations were available for root-cause interpretation in the selected snapshot.',
      signals: ['top-violations'],
      confidence: 1,
    });
  }

  return {
    kind: 'root-cause',
    summary:
      violations.length === 0
        ? 'No prioritized governance violations found for root-cause analysis.'
        : `Analyzed ${violations.length} prioritized violations across ${topSources.length} hotspot projects.`,
    findings,
    recommendations: buildRootCauseRecommendations(typeCounts),
    metadata: {
      violationTypes: typeCounts,
      analyzedViolationCount: violations.length,
    },
  };
}

export function summarizePrImpact(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const changedFilesCount = numberFromMetadata(metadata, 'changedFilesCount');
  const affectedProjectsCount =
    request.inputs.affectedProjects?.length ??
    numberFromMetadata(metadata, 'affectedProjectsCount');
  const affectedDomainCount = numberFromMetadata(
    metadata,
    'affectedDomainCount'
  );
  const crossDomainDependencyEdges = numberFromMetadata(
    metadata,
    'crossDomainDependencyEdges'
  );

  const risk = classifyPrImpactRisk({
    changedFilesCount,
    affectedProjectsCount,
    affectedDomainCount,
    crossDomainDependencyEdges,
  });

  const findings = buildPrImpactFindings({
    changedFilesCount,
    affectedProjectsCount,
    affectedDomainCount,
    crossDomainDependencyEdges,
  });

  return {
    kind: 'pr-impact',
    summary: `Deterministic PR impact risk: ${risk.toUpperCase()} based on changed files, affected projects/domains, and dependency edge signals.`,
    findings,
    recommendations: buildPrImpactRecommendations(risk, {
      affectedDomainCount,
      crossDomainDependencyEdges,
    }),
    metadata: {
      risk,
      changedFilesCount,
      affectedProjectsCount,
      affectedDomainCount,
      crossDomainDependencyEdges,
    },
  };
}

export function summarizeCognitiveLoad(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const selectedProjects = request.inputs.affectedProjects ?? [];
  const crossDomainDependencyEdges = numberFromMetadata(
    metadata,
    'crossDomainDependencyEdges'
  );
  const averageFanout = numberFromMetadata(metadata, 'averageFanout');
  const maxFanout = numberFromMetadata(metadata, 'maxFanout');
  const selectedProjectsCount =
    selectedProjects.length ||
    numberFromMetadata(metadata, 'selectedProjectsCount');
  const affectedDomainCount = numberFromMetadata(
    metadata,
    'affectedDomainCount'
  );

  const risk = classifyCognitiveLoadRisk({
    crossDomainDependencyEdges,
    averageFanout,
    maxFanout,
    selectedProjectsCount,
    affectedDomainCount,
  });

  const findings = [
    {
      id: 'cognitive-load-fanout',
      title: 'Dependency Fanout Pressure',
      detail: `Average fanout is ${averageFanout.toFixed(
        2
      )} with a maximum of ${maxFanout.toFixed(0)}.`,
      signals: ['dependency-fanout'],
      confidence: 1,
    },
    {
      id: 'cognitive-load-scope',
      title: 'Change Scope Breadth',
      detail: `Selected scope includes ${selectedProjectsCount} projects across ${affectedDomainCount} domains.`,
      signals: ['project-scope', 'domain-mapping'],
      confidence: 1,
    },
    {
      id: 'cognitive-load-cross-domain',
      title: 'Cross-Domain Coupling',
      detail: `${crossDomainDependencyEdges} cross-domain dependency edges were observed in scope.`,
      signals: ['dependency-graph', 'domain-mapping'],
      confidence: 1,
    },
  ];

  return {
    kind: 'cognitive-load',
    summary: `Deterministic cognitive load risk: ${risk.toUpperCase()} based on fanout, scope breadth, and cross-domain coupling signals.`,
    findings,
    recommendations: buildCognitiveLoadRecommendations(risk, {
      maxFanout,
      selectedProjectsCount,
      crossDomainDependencyEdges,
    }),
    metadata: {
      risk,
      selectedProjectsCount,
      affectedDomainCount,
      averageFanout,
      maxFanout,
      crossDomainDependencyEdges,
      scope: metadata.scope ?? 'workspace',
      project: metadata.project,
      domain: metadata.domain,
      topFanoutProjects: metadata.topFanoutProjects,
    },
  };
}

export function summarizeScorecard(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const snapshot = request.inputs.snapshot;
  const comparison = request.inputs.comparison;

  const workspaceHealthScore =
    snapshot?.scores.workspaceHealth ??
    numberFromMetadata(metadata, 'workspaceHealthScore');
  const healthGrade =
    asGrade(metadata['workspaceHealthGrade']) ??
    gradeForScore(workspaceHealthScore);
  const violationCount =
    snapshot?.violations.length ??
    numberFromMetadata(metadata, 'totalViolations');

  const topViolationTypes = Object.entries(
    countBy(snapshot?.violations ?? [], (violation) => violation.type)
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));

  const scoreDelta =
    comparison?.scoreDeltas.find((delta) => delta.id === 'workspaceHealth')
      ?.delta ?? 0;
  const trend: 'improving' | 'stable' | 'worsening' =
    scoreDelta > 0 ? 'improving' : scoreDelta < 0 ? 'worsening' : 'stable';

  const findings = [
    {
      id: 'scorecard-overall-health',
      title: 'Overall Governance Health',
      detail: `Workspace health score is ${workspaceHealthScore.toFixed(
        0
      )} (grade ${healthGrade}).`,
      signals: ['workspace-health', 'metric-scores'],
      confidence: 1,
    },
    {
      id: 'scorecard-violation-footprint',
      title: 'Violation Footprint',
      detail:
        topViolationTypes.length > 0
          ? `${violationCount} violations recorded. Dominant types: ${topViolationTypes
              .map((entry) => `${entry.type} (${entry.count})`)
              .join(', ')}.`
          : `${violationCount} violations recorded with no dominant type cluster.`,
      signals: ['violations', 'rule-distribution'],
      confidence: 1,
    },
    {
      id: 'scorecard-trend',
      title: 'Score Trend',
      detail: `Score trend is ${trend}${
        comparison
          ? ` (delta ${scoreDelta.toFixed(2)})`
          : ' (insufficient historical snapshots for delta).'
      }`,
      signals: ['snapshots', 'drift-analysis'],
      confidence: 1,
    },
  ];

  const recommendations: Recommendation[] = [];

  if (workspaceHealthScore < 60) {
    recommendations.push({
      id: 'scorecard-recovery-plan',
      title: 'Initiate Governance Recovery Plan',
      priority: 'high',
      reason:
        'Health score is in critical range. Prioritize remediation of highest-impact boundary and ownership violations before adding new architectural scope.',
    });
  } else if (workspaceHealthScore < 80) {
    recommendations.push({
      id: 'scorecard-targeted-hardening',
      title: 'Run Targeted Architectural Hardening',
      priority: 'medium',
      reason:
        'Health score is moderate. Focus on dominant violation categories and highest-fanout hotspots to raise baseline stability.',
    });
  } else {
    recommendations.push({
      id: 'scorecard-maintain-momentum',
      title: 'Maintain Current Governance Momentum',
      priority: 'low',
      reason:
        'Health score is strong. Continue trend monitoring and prevent regressions with regular governance checks.',
    });
  }

  if (trend === 'worsening') {
    recommendations.push({
      id: 'scorecard-stop-regression',
      title: 'Stop Trend Regression',
      priority: 'high',
      reason:
        'Latest score trend is worsening. Halt further architectural drift by assigning concrete ownership and burn-down targets for regressing metrics.',
    });
  }

  if (violationCount > 0 && topViolationTypes.length > 0) {
    recommendations.push({
      id: 'scorecard-address-dominant-violation',
      title: 'Address Dominant Violation Categories',
      priority: workspaceHealthScore < 70 ? 'high' : 'medium',
      reason: `Prioritize remediation of ${topViolationTypes[0]?.type} first to reduce the largest share of structural risk.`,
    });
  }

  return {
    kind: 'scorecard',
    summary: `Deterministic governance scorecard: ${workspaceHealthScore.toFixed(
      0
    )} (${healthGrade}), trend ${trend}, ${violationCount} violations.`,
    findings,
    recommendations,
    metadata: {
      workspaceHealthScore,
      workspaceHealthGrade: healthGrade,
      trend,
      scoreDelta,
      violationCount,
      topViolationTypes,
      baselineTimestamp: comparison?.baseline.timestamp,
      currentTimestamp: comparison?.current.timestamp,
    },
  };
}

export function summarizeOnboarding(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const violations = request.inputs.topViolations ?? [];

  const projectCount = numberFromMetadata(metadata, 'projectCount');
  const dependencyCount = numberFromMetadata(metadata, 'dependencyCount');
  const ownershipCoverage = numberFromMetadata(metadata, 'ownershipCoverage');

  const domainSummary = parseDomainCountEntries(metadata, 'domainSummary').sort(
    (a, b) => b.count - a.count || a.domain.localeCompare(b.domain)
  );
  const layerSummary = parseLayerCountEntries(metadata, 'layerSummary').sort(
    (a, b) => b.count - a.count || a.layer.localeCompare(b.layer)
  );
  const topFanoutProjects = parseProjectCountEntries(
    metadata,
    'topFanoutProjects'
  ).sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));

  const topViolationProjects = Object.entries(
    countBy(violations, (violation) => violation.source)
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([project, count]) => ({ project, count }));

  const findings = [
    {
      id: 'onboarding-repo-shape',
      title: 'Repository Shape',
      detail: `Workspace contains ${projectCount} projects and ${dependencyCount} internal dependencies.`,
      signals: ['workspace-inventory', 'dependency-graph'],
      confidence: 1,
    },
    {
      id: 'onboarding-domain-map',
      title: 'Domain Map',
      detail:
        domainSummary.length > 0
          ? `Top domains: ${domainSummary
              .slice(0, 4)
              .map((entry) => `${entry.domain} (${entry.count})`)
              .join(', ')}.`
          : 'No explicit domain tags found in the current project inventory.',
      signals: ['domain-tagging'],
      confidence: 1,
    },
    {
      id: 'onboarding-layer-map',
      title: 'Layer Map',
      detail:
        layerSummary.length > 0
          ? `Top layers: ${layerSummary
              .slice(0, 4)
              .map((entry) => `${entry.layer} (${entry.count})`)
              .join(', ')}.`
          : 'No explicit layer tags found in the current project inventory.',
      signals: ['layer-tagging'],
      confidence: 1,
    },
  ];

  if (topViolationProjects.length > 0) {
    findings.push({
      id: 'onboarding-risk-hotspots',
      title: 'Initial Risk Hotspots',
      detail: `Most frequent prioritized violation sources: ${topViolationProjects
        .map((entry) => `${entry.project} (${entry.count})`)
        .join(', ')}.`,
      signals: ['violations', 'project-hotspots'],
      confidence: 1,
    });
  }

  if (topFanoutProjects.length > 0) {
    findings.push({
      id: 'onboarding-fanout-hotspots',
      title: 'Navigation Hotspots',
      detail: `Highest fanout projects: ${topFanoutProjects
        .slice(0, 5)
        .map((entry) => `${entry.project} (${entry.count})`)
        .join(', ')}.`,
      signals: ['dependency-graph', 'fanout'],
      confidence: 1,
    });
  }

  const recommendations: Recommendation[] = [];

  recommendations.push({
    id: 'onboarding-start-with-domain-and-layer-map',
    title: 'Start With Domain And Layer Map',
    priority: 'medium',
    reason:
      'Review domain and layer distributions first to establish the architectural mental model before making changes.',
  });

  if (topFanoutProjects.length > 0) {
    recommendations.push({
      id: 'onboarding-trace-fanout-hotspots',
      title: 'Trace High-Fanout Hotspots Early',
      priority: 'medium',
      reason:
        'Highly connected projects tend to define architectural boundaries and change blast radius. Prioritize understanding these nodes.',
    });
  }

  if (topViolationProjects.length > 0) {
    recommendations.push({
      id: 'onboarding-review-governance-hotspots',
      title: 'Review Governance Hotspots With Owners',
      priority: 'high',
      reason:
        'Prioritized violations identify the fastest path to architectural context and active constraints. Pair review with project owners.',
    });
  }

  if (ownershipCoverage < 1) {
    recommendations.push({
      id: 'onboarding-close-ownership-gaps',
      title: 'Close Ownership Gaps',
      priority: 'high',
      reason:
        'Incomplete ownership coverage slows onboarding and escalation. Fill gaps to improve handoffs and decision clarity.',
    });
  }

  return {
    kind: 'onboarding',
    summary: `Deterministic onboarding brief prepared for ${projectCount} projects across ${domainSummary.length} domains and ${layerSummary.length} layers.`,
    findings,
    recommendations,
    metadata: {
      projectCount,
      dependencyCount,
      ownershipCoverage,
      domainSummary,
      layerSummary,
      topFanoutProjects,
      topViolationProjects,
    },
  };
}

export function summarizeArchitectureRecommendations(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const violations = request.inputs.topViolations ?? [];

  const domainBoundaryViolations = violations.filter(
    (violation) => violation.type === 'domain-boundary'
  );
  const layerBoundaryViolations = violations.filter(
    (violation) => violation.type === 'layer-boundary'
  );
  const ownershipViolations = violations.filter(
    (violation) => violation.type === 'ownership-presence'
  );
  const sourceCounts = countBy(violations, (violation) => violation.source);
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([source]) => source);

  const worseningSignalCount = numberFromMetadata(
    metadata,
    'worseningSignalCount'
  );

  const findings = [
    {
      id: 'recommendation-violation-footprint',
      title: 'Violation Footprint',
      detail: `${violations.length} prioritized violations analyzed across ${topSources.length} hotspot projects.`,
      signals: ['violations', 'frequency'],
      confidence: 1,
    },
  ];

  if (topSources.length > 0) {
    findings.push({
      id: 'recommendation-hotspots',
      title: 'Structural Hotspots',
      detail: `Most recurrent projects: ${topSources.join(', ')}.`,
      signals: ['violations', 'project-hotspots'],
      confidence: 1,
    });
  }

  if (worseningSignalCount > 0) {
    findings.push({
      id: 'recommendation-trend-regression',
      title: 'Drift Regression Signals',
      detail: `${worseningSignalCount} worsening drift signals detected from recent snapshots.`,
      signals: ['drift-analysis', 'snapshots'],
      confidence: 1,
    });
  }

  const recommendations: Recommendation[] = [];

  if (domainBoundaryViolations.length > 0) {
    recommendations.push({
      id: 'recommend-domain-contract-extraction',
      title: 'Extract Domain Contracts',
      priority: 'high',
      reason: `Cross-domain boundaries are repeatedly violated (${
        domainBoundaryViolations.length
      } times). Prioritize explicit contracts around ${
        topSources.slice(0, 2).join(', ') || 'hotspot projects'
      }.`,
    });
  }

  if (layerBoundaryViolations.length > 0) {
    recommendations.push({
      id: 'recommend-layer-api-hardening',
      title: 'Harden Layer APIs',
      priority: domainBoundaryViolations.length > 0 ? 'high' : 'medium',
      reason: `Layer-boundary issues (${layerBoundaryViolations.length}) indicate leakage between architectural layers. Introduce stricter layer-facing APIs and dependency checks.`,
    });
  }

  if (ownershipViolations.length > 0) {
    recommendations.push({
      id: 'recommend-ownership-completion',
      title: 'Complete Ownership Mapping',
      priority: 'medium',
      reason: `Ownership gaps remain in ${ownershipViolations.length} prioritized violations. Complete ownership assignments before structural changes.`,
    });
  }

  if (worseningSignalCount > 0) {
    recommendations.push({
      id: 'recommend-regression-burn-down',
      title: 'Burn Down Regressing Signals',
      priority: 'high',
      reason: `Recent trend analysis shows ${worseningSignalCount} worsening signals. Stabilize regressing metrics before adding new architectural surface area.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'recommend-maintain-current-architecture',
      title: 'Maintain Current Architecture Direction',
      priority: 'low',
      reason:
        'No dominant structural issue was detected in prioritized signals. Continue periodic governance checks and trend monitoring.',
    });
  }

  return {
    kind: 'recommendations',
    summary: `Generated ${recommendations.length} deterministic architecture recommendations from prioritized violations, dependency relationships, and trend signals.`,
    findings,
    recommendations,
    metadata: {
      analyzedViolationCount: violations.length,
      domainBoundaryViolations: domainBoundaryViolations.length,
      layerBoundaryViolations: layerBoundaryViolations.length,
      ownershipViolations: ownershipViolations.length,
      worseningSignalCount,
      hotspotProjects: topSources,
    },
  };
}

export function summarizeSmellClusters(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const violations = request.inputs.topViolations ?? [];
  const typeCounts = countBy(violations, (violation) => violation.type);
  const sourceCounts = countBy(violations, (violation) => violation.source);

  const dominantTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));

  const hotspotProjects = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([project, count]) => ({ project, count }));

  const persistentSmellSignals = parsePersistentSmellSignals(metadata).sort(
    (a, b) => b.count - a.count || a.type.localeCompare(b.type)
  );

  const findings = [
    {
      id: 'smell-cluster-type-density',
      title: 'Type Density Clusters',
      detail: `${violations.length} prioritized violations map to ${dominantTypes.length} dominant smell categories.`,
      signals: ['violations', 'smell-type-frequency'],
      confidence: 1,
    },
    {
      id: 'smell-cluster-project-hotspots',
      title: 'Project Smell Hotspots',
      detail:
        hotspotProjects.length > 0
          ? `Top hotspots: ${hotspotProjects
              .map((entry) => `${entry.project} (${entry.count})`)
              .join(', ')}.`
          : 'No project hotspots detected from prioritized violations.',
      signals: ['violations', 'project-hotspots'],
      confidence: 1,
    },
  ];

  if (persistentSmellSignals.length > 0) {
    findings.push({
      id: 'smell-cluster-persistence',
      title: 'Persistent Smell Signals',
      detail: `${persistentSmellSignals.length} smell signatures persisted across recent snapshots.`,
      signals: ['snapshot-history', 'persistence'],
      confidence: 1,
    });
  }

  const recommendations: Recommendation[] = [];

  if ((typeCounts['domain-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'smell-cluster-domain-remediation-sprint',
      title: 'Run Domain Boundary Remediation Sprint',
      priority: 'high',
      reason:
        'Domain-boundary smells dominate prioritized violations. Group fixes by boundary contract and ownership pair to reduce repeated coupling regressions.',
    });
  }

  if ((typeCounts['layer-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'smell-cluster-layer-hardening',
      title: 'Harden Layer Contracts In Hotspots',
      priority: (typeCounts['domain-boundary'] ?? 0) > 0 ? 'high' : 'medium',
      reason:
        'Layer-boundary smells indicate architectural leakage. Focus first on hotspot projects with repeated layer violations.',
    });
  }

  if (persistentSmellSignals.length > 0) {
    recommendations.push({
      id: 'smell-cluster-persistent-backlog',
      title: 'Create Persistent Smell Burn-Down Backlog',
      priority: 'high',
      reason:
        'Persistent smell signatures were detected across recent snapshots. Track them as explicit backlog items with weekly burn-down targets.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'smell-cluster-monitoring-only',
      title: 'Continue Smell Cluster Monitoring',
      priority: 'low',
      reason:
        'No dominant or persistent smell cluster was detected in prioritized signals. Continue snapshot-driven monitoring.',
    });
  }

  return {
    kind: 'smell-clusters',
    summary: `Detected ${dominantTypes.length} dominant smell clusters with ${persistentSmellSignals.length} persistent signatures across recent snapshots.`,
    findings,
    recommendations,
    metadata: {
      analyzedViolationCount: violations.length,
      dominantTypes,
      hotspotProjects,
      persistentSmellSignals,
    },
  };
}

export function summarizeRefactoringSuggestions(
  request: AiAnalysisRequest
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const violations = request.inputs.topViolations ?? [];
  const typeCounts = countBy(violations, (violation) => violation.type);

  const hotspotProjects = parseProjectCountEntries(
    metadata,
    'hotspotProjects'
  ).sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));
  const highFanoutProjects = parseProjectCountEntries(
    metadata,
    'highFanoutProjects'
  ).sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));
  const persistentSmellSignals = parsePersistentSmellSignals(metadata).sort(
    (a, b) => b.count - a.count || a.type.localeCompare(b.type)
  );

  const findings = [
    {
      id: 'refactor-hotspot-footprint',
      title: 'Refactoring Hotspot Footprint',
      detail:
        hotspotProjects.length > 0
          ? `Top hotspots: ${hotspotProjects
              .slice(0, 5)
              .map((entry) => `${entry.project} (${entry.count})`)
              .join(', ')}.`
          : 'No hotspot projects were derived from prioritized violations.',
      signals: ['violations', 'project-hotspots'],
      confidence: 1,
    },
    {
      id: 'refactor-fanout-pressure',
      title: 'Fanout Pressure',
      detail:
        highFanoutProjects.length > 0
          ? `High-fanout projects: ${highFanoutProjects
              .slice(0, 5)
              .map((entry) => `${entry.project} (${entry.count})`)
              .join(', ')}.`
          : 'No high-fanout projects detected in the current workspace graph.',
      signals: ['dependency-graph', 'fanout'],
      confidence: 1,
    },
  ];

  if (persistentSmellSignals.length > 0) {
    findings.push({
      id: 'refactor-persistent-smells',
      title: 'Persistent Refactoring Debt',
      detail: `${persistentSmellSignals.length} smell signatures persisted across recent snapshots.`,
      signals: ['snapshot-history', 'persistence'],
      confidence: 1,
    });
  }

  const recommendations: Recommendation[] = [];

  if (hotspotProjects.length > 0) {
    recommendations.push({
      id: 'refactor-hotspot-seams',
      title: 'Extract Hotspot Seams',
      priority: 'high',
      reason:
        'Repeated violations concentrate in hotspot projects. Introduce explicit seams and isolate volatile modules before further feature work.',
    });
  }

  if ((typeCounts['domain-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'refactor-domain-anti-corruption-layer',
      title: 'Introduce Domain Anti-Corruption Layer',
      priority: 'high',
      reason:
        'Domain-boundary violations are present in prioritized issues. Use anti-corruption layers to decouple direct cross-domain dependencies.',
    });
  }

  if ((typeCounts['layer-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'refactor-layer-api-separation',
      title: 'Separate Layer APIs From Implementations',
      priority: 'medium',
      reason:
        'Layer-boundary violations indicate leakage between architectural layers. Extract stable APIs and reduce direct implementation coupling.',
    });
  }

  if (highFanoutProjects.length > 0) {
    recommendations.push({
      id: 'refactor-reduce-fanout',
      title: 'Reduce Outgoing Fanout In Core Hotspots',
      priority: 'medium',
      reason:
        'Highly connected projects amplify change impact. Reduce outward dependencies by splitting responsibilities and narrowing public surface area.',
    });
  }

  if (persistentSmellSignals.length > 0) {
    recommendations.push({
      id: 'refactor-persistent-debt-program',
      title: 'Create Persistent Debt Refactoring Program',
      priority: 'high',
      reason:
        'Persistent smell signatures were observed across snapshots. Plan explicit refactoring slices with measurable burn-down goals.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'refactor-no-op-monitor',
      title: 'No Immediate Structural Refactoring Required',
      priority: 'low',
      reason:
        'No strong structural hotspots were detected in deterministic signals. Continue monitoring while keeping boundaries enforced.',
    });
  }

  return {
    kind: 'refactoring-suggestions',
    summary: `Generated ${recommendations.length} deterministic refactoring suggestions from hotspots, fanout pressure, and persistence signals.`,
    findings,
    recommendations,
    metadata: {
      analyzedViolationCount: violations.length,
      hotspotProjects,
      highFanoutProjects,
      persistentSmellSignals,
      violationTypes: typeCounts,
    },
  };
}

function toViolationKey(violation: SnapshotViolation): string {
  return [
    violation.type,
    violation.source,
    violation.target ?? '',
    violation.message ?? '',
  ].join('|');
}

function countBy<T>(
  items: T[],
  selector: (item: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function buildRootCauseRecommendations(
  typeCounts: Record<string, number>
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if ((typeCounts['domain-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'review-cross-domain-contracts',
      title: 'Review Cross-Domain Contracts',
      priority: 'high',
      reason:
        'Frequent domain-boundary violations indicate coupling between domains that should be mediated through explicit contracts.',
    });
  }

  if ((typeCounts['layer-boundary'] ?? 0) > 0) {
    recommendations.push({
      id: 'stabilize-layer-dependencies',
      title: 'Stabilize Layer Dependencies',
      priority: 'medium',
      reason:
        'Layer-boundary violations suggest implementation details leaking upward. Consider stricter interfaces between layers.',
    });
  }

  if ((typeCounts['ownership-presence'] ?? 0) > 0) {
    recommendations.push({
      id: 'fill-ownership-gaps',
      title: 'Fill Ownership Gaps',
      priority: 'medium',
      reason:
        'Missing ownership signals reduce accountability for structural issues and slow governance remediation.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'continue-monitoring-governance',
      title: 'Continue Monitoring Governance Signals',
      priority: 'low',
      reason:
        'No dominant rule category was detected in prioritized violations. Continue tracking trends over time.',
    });
  }

  return recommendations;
}

function classifyPrImpactRisk(signals: {
  changedFilesCount: number;
  affectedProjectsCount: number;
  affectedDomainCount: number;
  crossDomainDependencyEdges: number;
}): 'low' | 'medium' | 'high' {
  if (
    (signals.affectedDomainCount > 1 &&
      signals.crossDomainDependencyEdges > 0) ||
    signals.affectedProjectsCount >= 8 ||
    signals.changedFilesCount >= 40
  ) {
    return 'high';
  }

  if (
    signals.affectedDomainCount > 1 ||
    signals.affectedProjectsCount >= 4 ||
    signals.changedFilesCount >= 15
  ) {
    return 'medium';
  }

  return 'low';
}

function buildPrImpactFindings(signals: {
  changedFilesCount: number;
  affectedProjectsCount: number;
  affectedDomainCount: number;
  crossDomainDependencyEdges: number;
}) {
  const findings = [
    {
      id: 'pr-changed-files',
      title: 'Change Footprint',
      detail: `PR touches ${signals.changedFilesCount} files across ${signals.affectedProjectsCount} projects.`,
      signals: ['git-diff', 'project-mapping'],
      confidence: 1,
    },
  ];

  if (signals.affectedDomainCount > 1) {
    findings.push({
      id: 'pr-multi-domain',
      title: 'Multi-Domain Scope',
      detail: `PR affects ${signals.affectedDomainCount} domains.`,
      signals: ['domain-mapping'],
      confidence: 1,
    });
  }

  if (signals.crossDomainDependencyEdges > 0) {
    findings.push({
      id: 'pr-cross-domain-edges',
      title: 'Cross-Domain Dependency Exposure',
      detail: `${signals.crossDomainDependencyEdges} cross-domain dependency edges are involved in affected projects.`,
      signals: ['dependency-graph', 'domain-mapping'],
      confidence: 1,
    });
  }

  return findings;
}

function buildPrImpactRecommendations(
  risk: 'low' | 'medium' | 'high',
  signals: { affectedDomainCount: number; crossDomainDependencyEdges: number }
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (risk === 'high') {
    recommendations.push({
      id: 'split-pr-by-domain',
      title: 'Split Changes By Domain',
      priority: 'high',
      reason:
        'High architectural impact detected. Smaller domain-focused changes reduce coordination and regression risk.',
    });
  }

  if (signals.affectedDomainCount > 1) {
    recommendations.push({
      id: 'request-cross-domain-review',
      title: 'Request Cross-Domain Review',
      priority: risk === 'low' ? 'low' : 'medium',
      reason:
        'Multiple domains are affected. Include domain owners early to validate boundary assumptions.',
    });
  }

  if (signals.crossDomainDependencyEdges > 0) {
    recommendations.push({
      id: 'verify-boundary-contracts',
      title: 'Verify Boundary Contracts',
      priority: risk === 'high' ? 'high' : 'medium',
      reason:
        'Cross-domain dependency exposure detected in affected projects. Validate contracts and dependency direction before merge.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'proceed-with-standard-review',
      title: 'Proceed With Standard Review',
      priority: 'low',
      reason:
        'Low architectural impact signals were detected. Continue with normal verification and governance checks.',
    });
  }

  return recommendations;
}

function classifyCognitiveLoadRisk(signals: {
  crossDomainDependencyEdges: number;
  averageFanout: number;
  maxFanout: number;
  selectedProjectsCount: number;
  affectedDomainCount: number;
}): 'low' | 'medium' | 'high' {
  if (
    signals.crossDomainDependencyEdges >= 8 ||
    signals.maxFanout >= 12 ||
    signals.averageFanout >= 6 ||
    signals.selectedProjectsCount >= 15 ||
    signals.affectedDomainCount >= 4
  ) {
    return 'high';
  }

  if (
    signals.crossDomainDependencyEdges >= 3 ||
    signals.maxFanout >= 7 ||
    signals.averageFanout >= 3 ||
    signals.selectedProjectsCount >= 7 ||
    signals.affectedDomainCount >= 2
  ) {
    return 'medium';
  }

  return 'low';
}

function buildCognitiveLoadRecommendations(
  risk: 'low' | 'medium' | 'high',
  signals: {
    maxFanout: number;
    selectedProjectsCount: number;
    crossDomainDependencyEdges: number;
  }
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (risk === 'high') {
    recommendations.push({
      id: 'split-change-scope',
      title: 'Split Scope Into Smaller Changes',
      priority: 'high',
      reason:
        'High cognitive load detected. Smaller and more isolated changes reduce coordination overhead and review complexity.',
    });
  }

  if (signals.maxFanout >= 7) {
    recommendations.push({
      id: 'reduce-high-fanout-hotspots',
      title: 'Reduce High-Fanout Hotspots',
      priority: risk === 'high' ? 'high' : 'medium',
      reason:
        'Highly connected projects amplify the mental model required for safe changes. Consider reducing outward dependency fanout.',
    });
  }

  if (signals.crossDomainDependencyEdges >= 3) {
    recommendations.push({
      id: 'stabilize-cross-domain-contracts',
      title: 'Stabilize Cross-Domain Contracts',
      priority: 'medium',
      reason:
        'Cross-domain dependencies increase context switching. Introduce clearer contracts and ownership handoffs across domains.',
    });
  }

  if (signals.selectedProjectsCount >= 7 && recommendations.length < 3) {
    recommendations.push({
      id: 'narrow-active-project-set',
      title: 'Narrow Active Project Set',
      priority: 'medium',
      reason:
        'Many simultaneously affected projects increase navigation and regression burden. Sequence work in smaller project groups.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'maintain-current-scope-discipline',
      title: 'Maintain Current Scope Discipline',
      priority: 'low',
      reason:
        'Current cognitive-load signals are low. Keep scope boundaries explicit and continue monitoring trend changes.',
    });
  }

  return recommendations;
}

function numberFromMetadata(
  metadata: Record<string, unknown>,
  key: string
): number {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parsePersistentSmellSignals(metadata: Record<string, unknown>): Array<{
  type: string;
  source: string;
  count: number;
}> {
  const value = metadata['persistentSmellSignals'];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const signal = entry as Record<string, unknown>;
      const type =
        typeof signal.type === 'string' && signal.type.length > 0
          ? signal.type
          : null;
      const source =
        typeof signal.source === 'string' && signal.source.length > 0
          ? signal.source
          : null;
      const count =
        typeof signal.count === 'number' && Number.isFinite(signal.count)
          ? signal.count
          : null;

      if (!type || !source || count === null) {
        return null;
      }

      return { type, source, count };
    })
    .filter(
      (
        signal
      ): signal is {
        type: string;
        source: string;
        count: number;
      } => signal !== null
    );
}

function parseProjectCountEntries(
  metadata: Record<string, unknown>,
  key: string
): Array<{ project: string; count: number }> {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const signal = entry as Record<string, unknown>;
      const project =
        typeof signal.project === 'string' && signal.project.length > 0
          ? signal.project
          : null;
      const count =
        typeof signal.count === 'number' && Number.isFinite(signal.count)
          ? signal.count
          : null;

      if (!project || count === null) {
        return null;
      }

      return { project, count };
    })
    .filter(
      (signal): signal is { project: string; count: number } => signal !== null
    );
}

function parseDomainCountEntries(
  metadata: Record<string, unknown>,
  key: string
): Array<{ domain: string; count: number }> {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const signal = entry as Record<string, unknown>;
      const domain =
        typeof signal.domain === 'string' && signal.domain.length > 0
          ? signal.domain
          : null;
      const count =
        typeof signal.count === 'number' && Number.isFinite(signal.count)
          ? signal.count
          : null;

      if (!domain || count === null) {
        return null;
      }

      return { domain, count };
    })
    .filter(
      (signal): signal is { domain: string; count: number } => signal !== null
    );
}

function parseLayerCountEntries(
  metadata: Record<string, unknown>,
  key: string
): Array<{ layer: string; count: number }> {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const signal = entry as Record<string, unknown>;
      const layer =
        typeof signal.layer === 'string' && signal.layer.length > 0
          ? signal.layer
          : null;
      const count =
        typeof signal.count === 'number' && Number.isFinite(signal.count)
          ? signal.count
          : null;

      if (!layer || count === null) {
        return null;
      }

      return { layer, count };
    })
    .filter(
      (signal): signal is { layer: string; count: number } => signal !== null
    );
}

function asGrade(value: unknown): 'A' | 'B' | 'C' | 'D' | 'F' | null {
  if (
    value === 'A' ||
    value === 'B' ||
    value === 'C' ||
    value === 'D' ||
    value === 'F'
  ) {
    return value;
  }

  return null;
}

function gradeForScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
