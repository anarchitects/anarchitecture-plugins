import { calculateHealthScore } from '../health-engine/calculate-health.js';
import { buildInventory } from '../inventory/build-inventory.js';
import type { AdapterWorkspaceSnapshot } from '../nx-adapter/types.js';
import { evaluatePolicies } from '../policy-engine/evaluate-policies.js';
import { angularCleanupProfile } from '../presets/angular-cleanup/profile.js';
import {
  buildGraphSignals,
  buildPolicySignals,
} from '../signal-engine/index.js';

import { calculateMetrics } from './calculate-metrics.js';

const WORKSPACE_FIXTURES: Array<{
  name: string;
  snapshot: AdapterWorkspaceSnapshot;
  expected: {
    violationRuleIds: string[];
    measurements: Record<string, { value: number; score: number }>;
    health: {
      score: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      hotspots: string[];
    };
  };
}> = [
  {
    name: 'healthy layered workspace',
    snapshot: {
      root: '/workspace',
      projects: [
        project('shop-app', 'application', 'shop', 'app', true, true),
        project('shop-feature', 'library', 'shop', 'feature', true, true),
        project('shop-ui', 'library', 'shop', 'ui', true, true),
        project('shop-util', 'library', 'shop', 'util', true, true),
      ],
      dependencies: [
        dependency('shop-app', 'shop-feature'),
        dependency('shop-feature', 'shop-ui'),
        dependency('shop-ui', 'shop-util'),
      ],
      codeownersByProject: {},
    },
    expected: {
      violationRuleIds: [],
      measurements: {
        'architectural-entropy': { value: 0, score: 100 },
        'dependency-complexity': { value: 0.1875, score: 81 },
        'domain-integrity': { value: 0, score: 100 },
        'ownership-coverage': { value: 1, score: 100 },
        'documentation-completeness': { value: 1, score: 100 },
        'layer-integrity': { value: 0, score: 100 },
      },
      health: {
        score: 97,
        grade: 'A',
        hotspots: [],
      },
    },
  },
  {
    name: 'shared dependency warning workspace',
    snapshot: {
      root: '/workspace',
      projects: [
        project('shop-app', 'application', 'shop', 'app', true, true),
        project('shop-feature', 'library', 'shop', 'feature', true, true),
        project('shared-ui', 'library', 'shared', 'ui', true, true),
        project('shared-util', 'library', 'shared', 'util', true, true),
      ],
      dependencies: [
        dependency('shop-app', 'shop-feature'),
        dependency('shop-feature', 'shared-ui'),
        dependency('shared-ui', 'shared-util'),
      ],
      codeownersByProject: {},
    },
    expected: {
      violationRuleIds: [],
      measurements: {
        'architectural-entropy': { value: 0.14, score: 86 },
        'dependency-complexity': { value: 0.1875, score: 81 },
        'domain-integrity': { value: 0, score: 100 },
        'ownership-coverage': { value: 1, score: 100 },
        'documentation-completeness': { value: 1, score: 100 },
        'layer-integrity': { value: 0, score: 100 },
      },
      health: {
        score: 95,
        grade: 'A',
        hotspots: [],
      },
    },
  },
  {
    name: 'boundary and ownership hotspot workspace',
    snapshot: {
      root: '/workspace',
      projects: [
        project('orders-app', 'application', 'orders', 'app', true, true),
        project(
          'payments-feature',
          'library',
          'payments',
          'feature',
          false,
          false
        ),
        project('payments-ui', 'library', 'payments', 'ui', true, false),
      ],
      dependencies: [
        dependency('orders-app', 'payments-feature'),
        dependency('payments-ui', 'orders-app'),
      ],
      codeownersByProject: {},
    },
    expected: {
      violationRuleIds: [
        'domain-boundary',
        'domain-boundary',
        'layer-boundary',
        'ownership-presence',
      ],
      measurements: {
        'architectural-entropy': { value: 1, score: 0 },
        'dependency-complexity': { value: 0.1667, score: 83 },
        'domain-integrity': { value: 1, score: 0 },
        'ownership-coverage': { value: 0.6667, score: 67 },
        'documentation-completeness': { value: 0.3333, score: 33 },
        'layer-integrity': { value: 0.225, score: 78 },
      },
      health: {
        score: 44,
        grade: 'F',
        hotspots: [
          'Architectural Entropy',
          'Domain Integrity',
          'Documentation Completeness',
        ],
      },
    },
  },
];

describe('workspace metric baselines', () => {
  it.each(WORKSPACE_FIXTURES)(
    'matches expected weighted metric baseline for $name',
    ({ snapshot, expected }) => {
      const inventory = buildInventory(snapshot, { projectOverrides: {} });
      const violations = evaluatePolicies(inventory, angularCleanupProfile);
      const signals = [
        ...buildGraphSignals(toWorkspaceGraphSnapshot(inventory)),
        ...buildPolicySignals(violations, {
          createdAt: '2026-03-30T00:00:00.000Z',
        }),
      ];
      const measurements = calculateMetrics({
        workspace: inventory,
        signals,
      });
      const health = calculateHealthScore(measurements, {
        'architectural-entropy':
          angularCleanupProfile.metrics.architecturalEntropyWeight,
        'dependency-complexity':
          angularCleanupProfile.metrics.dependencyComplexityWeight,
        'domain-integrity': angularCleanupProfile.metrics.domainIntegrityWeight,
        'ownership-coverage':
          angularCleanupProfile.metrics.ownershipCoverageWeight,
        'documentation-completeness':
          angularCleanupProfile.metrics.documentationCompletenessWeight,
        'layer-integrity': angularCleanupProfile.metrics.layerIntegrityWeight,
      });

      expect(violations.map((violation) => violation.ruleId)).toEqual(
        expected.violationRuleIds
      );
      expect(
        Object.fromEntries(
          measurements.map((measurement) => [
            measurement.id,
            {
              value: measurement.value,
              score: measurement.score,
            },
          ])
        )
      ).toEqual(expected.measurements);
      expect(health).toEqual(expected.health);
    }
  );
});

function toWorkspaceGraphSnapshot(
  inventory: ReturnType<typeof buildInventory>
) {
  return {
    source: 'nx-graph' as const,
    extractedAt: '2026-03-30T00:00:00.000Z',
    projects: inventory.projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      type: project.type === 'tool' ? 'unknown' : project.type,
      tags: project.tags,
      domain: project.domain,
      layer: project.layer,
    })),
    dependencies: inventory.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
    })),
  };
}

function project(
  name: string,
  type: string,
  domain: string,
  layer: string,
  owned: boolean,
  documented: boolean
) {
  return {
    name,
    root: `packages/${name}`,
    type,
    tags: [`domain:${domain}`, `layer:${layer}`],
    metadata: {
      ...(owned
        ? {
            ownership: {
              team: `@anarchitects/${domain}`,
            },
          }
        : {}),
      ...(documented ? { documentation: true } : {}),
    },
  };
}

function dependency(source: string, target: string) {
  return {
    source,
    target,
    type: 'static' as const,
  };
}
