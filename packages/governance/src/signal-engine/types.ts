import type { Category } from '../conformance-adapter/conformance-adapter.js';

export type GovernanceSignalType =
  | 'structural-dependency'
  | 'cross-domain-dependency'
  | 'missing-domain-context'
  | 'circular-dependency'
  | 'conformance-violation';

export type GovernanceSignalSeverity = 'info' | 'warning' | 'error';

export type GovernanceSignalCategory = Category | 'structure';

export type GovernanceSignalSource = 'graph' | 'conformance';

export interface GovernanceSignal {
  id: string;
  type: GovernanceSignalType;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  metadata?: Record<string, unknown>;
  source: GovernanceSignalSource;
  createdAt: string;
}

