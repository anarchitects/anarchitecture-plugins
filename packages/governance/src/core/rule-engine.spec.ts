import type {
  GovernanceRule,
  GovernanceRuleCategory,
  GovernanceRuleContext,
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
    await expect(
      evaluateRulePack(coreBuiltInRulePack, {
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
    const firstViolation: Violation = {
      id: 'domain-violation',
      ruleId: 'domain-boundary',
      project: 'platform-shell',
      severity: 'error',
      category: 'boundary',
      message: 'Platform shell should not depend on booking UI.',
    };
    const firstSignal: GovernanceSignal = {
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
    const firstMeasurement: Measurement = {
      id: 'boundary-integrity',
      name: 'Boundary Integrity',
      family: 'boundaries',
      value: 0.75,
      score: 75,
      maxScore: 100,
      unit: 'ratio',
    };

    const secondViolation: Violation = {
      id: 'ownership-violation',
      ruleId: 'ownership-presence',
      project: 'booking-domain',
      severity: 'warning',
      category: 'ownership',
      message: 'Booking domain is missing ownership metadata.',
    };

    const result = await evaluateRules(
      [
        testRule('aggregate-one', () => ({
          violations: [firstViolation],
          signals: [firstSignal],
        })),
        testRule('aggregate-two', () => ({
          measurements: [firstMeasurement],
          violations: [secondViolation],
        })),
      ],
      {
        workspace: coreTestWorkspace,
      }
    );

    expect(result.violations).toEqual([firstViolation, secondViolation]);
    expect(result.signals).toEqual([firstSignal]);
    expect(result.measurements).toEqual([firstMeasurement]);
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
    expect(coreBuiltInRulePack).toEqual({
      id: 'core',
      name: 'Governance Core Built-in Rules',
      rules: [],
    });
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
