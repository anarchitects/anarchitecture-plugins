export interface GovernanceExecutorOptions {
  profile?: string;
  output?: 'cli' | 'json';
  failOnViolation?: boolean;
}

export interface GovernanceSnapshotExecutorOptions
  extends GovernanceExecutorOptions {
  snapshotDir?: string;
  metricSchemaVersion?: string;
}

export interface GovernanceDriftExecutorOptions
  extends GovernanceExecutorOptions {
  snapshotDir?: string;
  baseline?: string;
  current?: string;
  minTrendLength?: number;
}

export interface GovernanceAiExecutorOptions extends GovernanceExecutorOptions {
  snapshotDir?: string;
  snapshotPath?: string;
  topViolations?: number;
}

export interface GovernanceAiPrImpactExecutorOptions
  extends GovernanceAiExecutorOptions {
  baseRef?: string;
  headRef?: string;
}

export interface GovernanceAiCognitiveLoadExecutorOptions
  extends GovernanceAiExecutorOptions {
  project?: string;
  domain?: string;
  topProjects?: number;
}

export interface GovernanceAiRefactoringSuggestionsExecutorOptions
  extends GovernanceAiExecutorOptions {
  topProjects?: number;
}

export interface GovernanceAiOnboardingExecutorOptions
  extends GovernanceAiExecutorOptions {
  topProjects?: number;
}

export interface WorkspaceGraphExecutorOptions {
  graphJson?: string;
}

export interface WorkspaceConformanceExecutorOptions {
  conformanceJson: string;
}
