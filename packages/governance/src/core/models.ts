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

export interface GovernanceAssessment {
  workspace: GovernanceWorkspace;
  profile: string;
  warnings: string[];
  violations: Violation[];
  measurements: Measurement[];
  health: HealthScore;
  recommendations: Recommendation[];
}
