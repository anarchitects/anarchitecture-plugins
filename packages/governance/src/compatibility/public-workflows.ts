export const GOVERNANCE_EXECUTOR_IDS = [
  'repo-health',
  'repo-boundaries',
  'repo-ownership',
  'repo-architecture',
  'repo-snapshot',
  'repo-drift',
  'repo-management-insights',
  'repo-ai-management-insights',
  'repo-ai-root-cause',
  'repo-ai-drift',
  'repo-ai-pr-impact',
  'repo-ai-cognitive-load',
  'repo-ai-recommendations',
  'repo-ai-smell-clusters',
  'repo-ai-refactoring-suggestions',
  'repo-ai-scorecard',
  'repo-ai-onboarding',
  'workspace-graph',
  'workspace-conformance',
  'governance-graph',
] as const;

export const GOVERNANCE_GENERATOR_IDS = [
  'init',
  'add-extension',
  'eslint-integration',
] as const;

export const GOVERNANCE_INFERRED_TARGET_NAMES = [
  'repo-health',
  'repo-boundaries',
  'repo-ownership',
  'repo-architecture',
] as const;

export const GOVERNANCE_MINIMAL_TARGET_NAMES = [
  'repo-health',
  'governance-graph',
] as const;

export const GOVERNANCE_FULL_ONLY_TARGET_NAMES = [
  'repo-boundaries',
  'repo-ownership',
  'repo-architecture',
  'repo-snapshot',
  'repo-drift',
  'repo-management-insights',
  'repo-ai-management-insights',
  'workspace-graph',
  'workspace-conformance',
  'repo-ai-root-cause',
  'repo-ai-drift',
  'repo-ai-pr-impact',
  'repo-ai-cognitive-load',
  'repo-ai-recommendations',
  'repo-ai-smell-clusters',
  'repo-ai-refactoring-suggestions',
  'repo-ai-scorecard',
  'repo-ai-onboarding',
] as const;

export const GOVERNANCE_FULL_TARGET_NAMES = [
  ...GOVERNANCE_MINIMAL_TARGET_NAMES,
  ...GOVERNANCE_FULL_ONLY_TARGET_NAMES,
] as const;

export const GOVERNANCE_AI_WORKFLOW_TARGET_NAMES = [
  'repo-ai-management-insights',
  'repo-ai-root-cause',
  'repo-ai-drift',
  'repo-ai-pr-impact',
  'repo-ai-cognitive-load',
  'repo-ai-recommendations',
  'repo-ai-smell-clusters',
  'repo-ai-refactoring-suggestions',
  'repo-ai-scorecard',
  'repo-ai-onboarding',
] as const;

export const GOVERNANCE_DEFAULT_PROFILE_GLOB =
  'tools/governance/profiles/*.json';
export const GOVERNANCE_DEFAULT_PROFILE_NAME = 'frontend-layered';
export const GOVERNANCE_DEFAULT_SNAPSHOT_DIR = '.governance-metrics/snapshots';
export const GOVERNANCE_DEFAULT_METRIC_SCHEMA_VERSION = '1.2';
export const GOVERNANCE_AI_HANDOFF_OUTPUT_DIR = '.governance-metrics/ai';
export const GOVERNANCE_GRAPH_DEFAULT_HTML_OUTPUT_PATH =
  'dist/governance/graph.html';
export const GOVERNANCE_GRAPH_DEFAULT_JSON_OUTPUT_PATH =
  'dist/governance/graph.json';

export const GOVERNANCE_AI_HANDOFF_USE_CASES = [
  'management-insights',
  'root-cause',
  'drift',
  'pr-impact',
  'scorecard',
] as const;

export const GOVERNANCE_PACKAGE_PUBLIC_ENTRYPOINTS = {
  main: 'dist/index.js',
  plugin: 'dist/plugin/index.js',
  executors: 'dist/index.json',
  generators: 'dist/index.json',
  bin: 'dist/standalone-cli/bin/agov.js',
} as const;
