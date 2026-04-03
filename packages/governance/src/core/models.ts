import type {
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from '../signal-engine/types.js';

export interface GovernanceWorkspace {
  id: string;
  name: string;
  root: string;
  projects: GovernanceProject[];
  dependencies: GovernanceDependency[];
}

export interface GovernanceProject {
  id: string;
  name: string;
  root: string;
  type: 'application' | 'library' | 'tool' | 'unknown';
  tags: string[];
  domain?: string;
  layer?: string;
  ownership?: Ownership;
  metadata: Record<string, unknown>;
}

export interface GovernanceDependency {
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
  sourceFile?: string;
}

export interface Ownership {
  team?: string;
  contacts?: string[];
  source: 'project-metadata' | 'codeowners' | 'merged' | 'none';
}

export interface Violation {
  id: string;
  ruleId: string;
  project: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

export interface Measurement {
  id: string;
  name: string;
  value: number;
  score: number;
  maxScore: number;
  unit: 'ratio' | 'count' | 'score';
}

export interface Recommendation {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  hotspots: string[];
}

export interface SignalBreakdownEntry {
  source: 'graph' | 'conformance' | 'policy';
  count: number;
}

export interface SignalTypeBreakdownEntry {
  type: GovernanceSignalType;
  count: number;
}

export interface SignalSeverityBreakdownEntry {
  severity: GovernanceSignalSeverity;
  count: number;
}

export interface SignalBreakdown {
  total: number;
  bySource: SignalBreakdownEntry[];
  byType: SignalTypeBreakdownEntry[];
  bySeverity: SignalSeverityBreakdownEntry[];
}

export type GovernanceMetricFamily =
  | 'architecture'
  | 'boundaries'
  | 'ownership'
  | 'documentation';

export interface MetricBreakdownMeasurement {
  id: Measurement['id'];
  name: string;
  score: number;
}

export interface MetricBreakdownFamily {
  family: GovernanceMetricFamily;
  score: number;
  measurements: MetricBreakdownMeasurement[];
}

export interface MetricBreakdown {
  families: MetricBreakdownFamily[];
}

export interface GovernanceTopIssue {
  type: GovernanceSignalType;
  source: GovernanceSignalSource;
  severity: GovernanceSignalSeverity;
  count: number;
  projects: string[];
  ruleId?: string;
  message: string;
}

export interface GovernanceAssessment {
  workspace: GovernanceWorkspace;
  profile: string;
  warnings: string[];
  violations: Violation[];
  measurements: Measurement[];
  signalBreakdown: SignalBreakdown;
  metricBreakdown: MetricBreakdown;
  topIssues: GovernanceTopIssue[];
  health: HealthScore;
  recommendations: Recommendation[];
}

export interface SnapshotViolation {
  type: string;
  source: string;
  target?: string;
  ruleId?: string;
  severity?: Violation['severity'];
  message?: string;
}

export interface MetricSnapshot {
  timestamp: string;
  repo: string;
  branch: string;
  commitSha: string;
  pluginVersion: string;
  metricSchemaVersion: string;
  metrics: Record<string, number>;
  scores: Record<string, number>;
  violations: SnapshotViolation[];
}

export interface SnapshotMetricDelta {
  id: string;
  baseline: number;
  current: number;
  delta: number;
}

export interface SnapshotComparison {
  baseline: MetricSnapshot;
  current: MetricSnapshot;
  metricDeltas: SnapshotMetricDelta[];
  scoreDeltas: SnapshotMetricDelta[];
  newViolations: SnapshotViolation[];
  resolvedViolations: SnapshotViolation[];
}

export interface DriftSignal {
  id: string;
  status: 'worsening' | 'stable' | 'improving';
  magnitude: number;
  details?: Record<string, unknown>;
}

export interface CognitiveLoadSignal {
  id: string;
  name: string;
  value: number;
  score: number;
  weight: number;
  unit: 'ratio' | 'count' | 'score';
  details?: Record<string, unknown>;
}

export interface CognitiveLoadAssessment {
  overallScore: number;
  risk: 'low' | 'medium' | 'high';
  signals: CognitiveLoadSignal[];
  hotspots: string[];
}

export interface AiAnalysisRequest {
  kind:
    | 'root-cause'
    | 'drift'
    | 'pr-impact'
    | 'scorecard'
    | 'cognitive-load'
    | 'onboarding'
    | 'recommendations'
    | 'smell-clusters'
    | 'refactoring-suggestions';
  generatedAt: string;
  profile: string;
  inputs: {
    snapshot?: MetricSnapshot;
    comparison?: SnapshotComparison;
    topViolations?: SnapshotViolation[];
    dependencies?: GovernanceDependency[];
    affectedProjects?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface AiAnalysisFinding {
  id: string;
  title: string;
  detail: string;
  signals: string[];
  confidence?: number;
}

export interface AiAnalysisResult {
  kind: AiAnalysisRequest['kind'];
  summary: string;
  findings: AiAnalysisFinding[];
  recommendations: Recommendation[];
  metadata?: Record<string, unknown>;
}
