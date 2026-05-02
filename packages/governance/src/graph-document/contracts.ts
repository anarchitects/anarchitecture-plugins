import type { GovernanceSignalSeverity } from '../signal-engine/types.js';

export const GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION = '1.0';

export interface GovernanceGraphDocument {
  /**
   * Versioned contract identifier for JSON export consumers.
   */
  schemaVersion: string;
  generatedAt?: string;
  workspace?: GovernanceGraphWorkspace;
  summary: GovernanceGraphSummary;
  nodes: GovernanceGraphNode[];
  edges: GovernanceGraphEdge[];
  facets: GovernanceGraphFacets;
}

export interface GovernanceGraphWorkspace {
  id?: string;
  name?: string;
  root?: string;
  profile?: string;
}

export interface GovernanceGraphNode {
  id: string;
  label: string;
  type: string;
  tags: string[];
  owner?: string;
  health: GovernanceGraphHealth;
  findings: GovernanceGraphFinding[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GovernanceGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  health: GovernanceGraphHealth;
  findings: GovernanceGraphFinding[];
}

export type GovernanceGraphHealth =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'unknown';

export type GovernanceGraphFindingSource =
  | 'policy'
  | 'conformance'
  | 'signal'
  | 'extension'
  | 'metric';

export interface GovernanceGraphFinding {
  id: string;
  source: GovernanceGraphFindingSource;
  severity: GovernanceSignalSeverity;
  message: string;
  ruleId?: string;
  projectId?: string;
  targetProjectId?: string;
  category?: string;
  type?: string;
  sourcePluginId?: string;
}

export interface GovernanceGraphSummary {
  nodeCount: number;
  edgeCount: number;
  findingCount: number;
  healthyNodeCount: number;
  warningNodeCount: number;
  criticalNodeCount: number;
  unknownNodeCount: number;
  healthyEdgeCount: number;
  warningEdgeCount: number;
  criticalEdgeCount: number;
  unknownEdgeCount: number;
}

export interface GovernanceGraphFacets {
  health: GovernanceGraphHealth[];
  tags: string[];
  owners: string[];
  findingSources: GovernanceGraphFindingSource[];
  findingSeverities: GovernanceSignalSeverity[];
  ruleIds: string[];
}
