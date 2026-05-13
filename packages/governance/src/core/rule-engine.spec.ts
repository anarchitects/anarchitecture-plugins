import type {
  GovernanceRule,
  GovernanceRuleCategory,
  GovernanceRuleContext,
  GovernanceRulePack,
  GovernanceRuleSeverity,
  GovernanceSignal,
  Measurement,
  Violation,
} from './index.js';
import {
  CORE_BUILT_IN_RULE_PACK_ID,
  coreBuiltInRulePack,
  coreBuiltInRulePacks,
  evaluateRulePack,
  evaluateRules,
} from './index.js';
import { coreTestWorkspace } from './testing/workspace.fixtures.js';

describe('Core rule engine contracts', () => {
  it('returns empty arrays for an empty rule pack', async () => {
    const emptyRulePack: GovernanceRulePack = {
      id: 'empty',
      name: 'Empty',
      rules: [],
    };

    await expect(
      evaluateRulePack(emptyRulePack, {
        workspace: coreTestWorkspace,
      })
    ).resolves.toEqual({
      violations: [],
      signals: [],
      measurements: [],
    });
  });

  it('executes rules in provided order', async () => {
    const callOrder: string[] = [];
    const rules: GovernanceRule[] = [
      testRule('rule-one', () => {
        callOrder.push('rule-one');
        return {};
      }),
      testRule('rule-two', () => {
        callOrder.push('rule-two');
        return {};
      }),
    ];

    await evaluateRules(rules, {
      workspace: coreTestWorkspace,
    });

    expect(callOrder).toEqual(['rule-one', 'rule-two']);
  });

  it('aggregates violations, signals, and measurements deterministically', async () => {
    const violation: Violation = {
      id: 'domain-violation',
      ruleId: 'domain-boundary',
      project: 'platform-shell',
      severity: 'error',
      category: 'boundary',
      message: 'Platform shell should not depend on booking UI.',
    };
    const signal: GovernanceSignal = {
      id: 'signal-domain-violation',
      type: 'domain-boundary-violation',
      sourceProjectId: 'platform-shell',
      targetProjectId: 'booking-ui',
      relatedProjectIds: ['platform-shell', 'booking-ui'],
      severity: 'warning',
      category: 'boundary',
      message: 'Platform shell should not depend on booking UI.',
      source: 'policy',
      createdAt: '2026-05-13T00:00:00.000Z',
    };
    const measurement: Measurement = {
      id: 'boundary-integrity',
      name: 'Boundary Integrity',
      family: 'boundaries',
      value: 0.75,
      score: 75,
      maxScore: 100,
      unit: 'ratio',
    };

    const result = await evaluateRules(
      [
        testRule('aggregate-one', () => ({
          violations: [violation],
        })),
        testRule('aggregate-two', () => ({
          signals: [signal],
        })),
        testRule('aggregate-three', () => ({
          measurements: [measurement],
        })),
      ],
      {
        workspace: coreTestWorkspace,
      }
    );

    expect(result.violations).toEqual([violation]);
    expect(result.signals).toEqual([signal]);
    expect(result.measurements).toEqual([measurement]);
  });

  it('treats missing arrays as empty during aggregation', async () => {
    const measurement: Measurement = {
      id: 'ownership-coverage',
      name: 'Ownership Coverage',
      family: 'ownership',
      value: 1,
      score: 100,
      maxScore: 100,
      unit: 'ratio',
    };

    const result = await evaluateRules(
      [
        testRule('empty-result', () => ({})),
        testRule('measurement-only', () => ({
          measurements: [measurement],
        })),
        testRule('empty-result-two', () => ({})),
      ],
      {
        workspace: coreTestWorkspace,
      }
    );

    expect(result).toEqual({
      violations: [],
      signals: [],
      measurements: [measurement],
    });
  });

  it('supports plain governance workspace fixtures without Nx APIs', async () => {
    const result = await evaluateRules(
      [
        testRule('workspace-fixture', ({ workspace }) => ({
          violations: [
            {
              id: 'workspace-project-count',
              ruleId: 'workspace-project-count',
              project: workspace.projects[0].name,
              severity: 'info',
              category: 'architecture',
              message: `Workspace ${workspace.name} has ${workspace.projects.length} projects.`,
              details: {
                dependencyCount: workspace.dependencies.length,
              },
            },
          ],
        })),
      ],
      {
        workspace: coreTestWorkspace,
      }
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        project: 'booking-ui',
        category: 'architecture',
        severity: 'info',
        details: {
          dependencyCount: 2,
        },
      }),
    ]);
  });

  it('exposes the built-in core rule pack placeholder from the core boundary', () => {
    expect(CORE_BUILT_IN_RULE_PACK_ID).toBe('core');
    expect(coreBuiltInRulePack.id).toBe('core');
    expect(coreBuiltInRulePack.name).toBe('Governance Core Built-in Rules');
    expect(coreBuiltInRulePack.rules.map((rule) => rule.id)).toEqual([
      'domain-boundary',
      'layer-boundary',
      'ownership-presence',
      'project-name-convention',
      'tag-convention',
      'missing-domain',
      'missing-layer',
    ]);
    expect(coreBuiltInRulePacks).toEqual([coreBuiltInRulePack]);
  });
});

function testRule(
  id: string,
  evaluate: (
    context: GovernanceRuleContext
  ) => ReturnType<GovernanceRule['evaluate']>,
  category: GovernanceRuleCategory = 'structure',
  defaultSeverity: GovernanceRuleSeverity = 'warning'
): GovernanceRule {
  return {
    id,
    name: id,
    category,
    defaultSeverity,
    evaluate,
  };
}
