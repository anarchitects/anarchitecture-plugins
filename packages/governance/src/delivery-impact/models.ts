export type GovernanceAudience = 'management' | 'technical-lead' | 'developer';

export type GovernanceInsightCategory =
  | 'cost-of-change'
  | 'time-to-market'
  | 'delivery-risk'
  | 'predictability'
  | 'maintainability'
  | 'ownership'
  | (string & {});

export interface GovernanceInsight {
  id: string;
  audience: GovernanceAudience;
  category: GovernanceInsightCategory;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  drivers: GovernanceInsightDriver[];
  relatedMeasurements: string[];
  relatedSignals: string[];
  relatedViolations: string[];
}

export interface GovernanceInsightDriver {
  id: string;
  label: string;
  value?: number | string;
  score?: number;
  unit?: 'ratio' | 'count' | 'score';
  trend?: 'improving' | 'stable' | 'worsening';
  explanation?: string;
}

export interface DeliveryImpactAssessment {
  generatedAt: string;
  profile: string;
  indices: DeliveryImpactIndex[];
  insights: GovernanceInsight[];
  drivers: GovernanceInsightDriver[];
}

export interface DeliveryImpactIndex {
  id: string;
  name: string;
  score: number;
  risk: 'low' | 'medium' | 'high';
  trend?: 'improving' | 'stable' | 'worsening';
  drivers: GovernanceInsightDriver[];
}
