import type {
  GovernanceAssessment,
  GovernanceDependency,
  GovernanceProject,
  GovernanceTopIssue,
  Ownership,
  Violation,
} from '../core/index.js';
import type {
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from '../signal-engine/index.js';

export const GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION = '1.0';

export interface GovernanceGraphDocument {
  schemaVersion: typeof GOVERNANCE_GRAPH_DOCUMENT_SCHEMA_VERSION;
  summary: GovernanceGraphSummary;
  nodes: GovernanceGraphNode[];
  edges: GovernanceGraphEdge[];
  findings: GovernanceGraphFinding[];
  filters: GovernanceGraphFilters;
}

export interface GovernanceGraphSummary {
  workspace: Pick<GovernanceAssessment['workspace'], 'id' | 'name' | 'root'>;
  profile: GovernanceAssessment['profile'];
  warnings: GovernanceAssessment['warnings'];
  projectCount: number;
  dependencyCount: number;
  signalCount: number;
  violationCount: number;
  findingCount: number;
  health: GovernanceAssessment['health'];
  signalBreakdown: GovernanceAssessment['signalBreakdown'];
  metricBreakdown: GovernanceAssessment['metricBreakdown'];
  topIssues: GovernanceTopIssue[];
}

export interface GovernanceGraphNodeOwnership {
  present: boolean;
  source: Ownership['source'];
  team?: string;
  contacts: string[];
}

export interface GovernanceGraphNode {
  id: GovernanceProject['id'];
  name: GovernanceProject['name'];
  root: GovernanceProject['root'];
  type: GovernanceProject['type'];
  tags: string[];
  domain?: GovernanceProject['domain'];
  layer?: GovernanceProject['layer'];
  ownership: GovernanceGraphNodeOwnership;
  documentationPresent: boolean;
  dependencyCount: number;
  dependentCount: number;
  findingIds: GovernanceGraphFinding['id'][];
}

export interface GovernanceGraphEdge {
  id: string;
  sourceProjectId: GovernanceDependency['source'];
  targetProjectId: GovernanceDependency['target'];
  dependencyType: GovernanceDependency['type'];
  sourceFile?: GovernanceDependency['sourceFile'];
  findingIds: GovernanceGraphFinding['id'][];
}

export interface GovernanceGraphFinding {
  id: string;
  kind: 'signal' | 'violation';
  source: GovernanceSignalSource;
  type: GovernanceSignalType | Violation['ruleId'];
  category: GovernanceSignalCategory | Violation['category'];
  severity: GovernanceSignalSeverity | Violation['severity'];
  message: string;
  ruleId?: Violation['ruleId'];
  sourcePluginId?: string;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
}

export interface GovernanceGraphStringFacetEntry {
  value: string;
  count: number;
}

export interface GovernanceGraphBooleanFacetEntry {
  value: boolean;
  count: number;
}

export interface GovernanceGraphFilters {
  domains: GovernanceGraphStringFacetEntry[];
  layers: GovernanceGraphStringFacetEntry[];
  projectTypes: GovernanceGraphStringFacetEntry[];
  ownershipPresence: GovernanceGraphBooleanFacetEntry[];
  documentationPresence: GovernanceGraphBooleanFacetEntry[];
  findingSeverities: GovernanceGraphStringFacetEntry[];
  findingSources: GovernanceGraphStringFacetEntry[];
  findingCategories: GovernanceGraphStringFacetEntry[];
  findingTypes: GovernanceGraphStringFacetEntry[];
  ruleIds: GovernanceGraphStringFacetEntry[];
  sourcePluginIds: GovernanceGraphStringFacetEntry[];
  metricFamilies: GovernanceGraphStringFacetEntry[];
}
