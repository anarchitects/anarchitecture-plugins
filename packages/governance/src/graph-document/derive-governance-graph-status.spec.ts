import type { GovernanceGraphFinding } from './contracts.js';
import {
  deriveGovernanceGraphBadges,
  deriveGovernanceGraphEdgeStatus,
  deriveGovernanceGraphNodeStatus,
} from './derive-governance-graph-status.js';

describe('governance graph status derivation', () => {
  it('marks a node healthy when metadata is complete and findings are non-negative', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [],
      owner: '@org/payments',
      ownershipRequired: true,
      documentation: true,
      documentationRequired: true,
      isKnown: true,
    });

    expect(result).toEqual({
      health: 'healthy',
      score: 100,
      badges: [
        {
          id: 'ownership:present',
          label: 'Owner',
          kind: 'ownership',
          status: 'healthy',
          message: 'Owner metadata is present (@org/payments).',
        },
        {
          id: 'documentation:present',
          label: 'Docs',
          kind: 'documentation',
          status: 'healthy',
          message: 'Documentation metadata is present.',
        },
      ],
    });
  });

  it('marks a node warning when warning findings are present', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [finding({ severity: 'warning' })],
      owner: '@org/payments',
      ownershipRequired: true,
      documentation: true,
      documentationRequired: true,
      isKnown: true,
    });

    expect(result.health).toBe('warning');
    expect(result.score).toBe(70);
  });

  it('marks a node critical when error findings are present', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [finding({ severity: 'error' })],
      owner: '@org/payments',
      ownershipRequired: true,
      documentation: true,
      documentationRequired: true,
      isKnown: true,
    });

    expect(result.health).toBe('critical');
    expect(result.score).toBe(40);
  });

  it('marks a node unknown when metadata requirements are unavailable and there are no findings', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [],
      isKnown: false,
    });

    expect(result).toEqual({
      health: 'unknown',
      score: 0,
      badges: [
        {
          id: 'ownership:unknown',
          label: 'Ownership unknown',
          kind: 'ownership',
          status: 'unknown',
          message:
            'Ownership requirements were not available for this graph node.',
        },
        {
          id: 'documentation:unknown',
          label: 'Docs unknown',
          kind: 'documentation',
          status: 'unknown',
          message:
            'Documentation requirements were not available for this graph node.',
        },
      ],
    });
  });

  it('marks an edge healthy when it is known and has no negative findings', () => {
    expect(
      deriveGovernanceGraphEdgeStatus({
        findings: [],
        isKnown: true,
      })
    ).toEqual({
      health: 'healthy',
      score: 100,
    });
  });

  it('marks an edge warning when warning findings are present', () => {
    expect(
      deriveGovernanceGraphEdgeStatus({
        findings: [finding({ severity: 'warning' })],
        isKnown: true,
      }).health
    ).toBe('warning');
  });

  it('marks an edge critical when error findings are present', () => {
    expect(
      deriveGovernanceGraphEdgeStatus({
        findings: [finding({ severity: 'error' })],
        isKnown: true,
      }).health
    ).toBe('critical');
  });

  it('emits an ownership missing badge when ownership is required and absent', () => {
    expect(
      deriveGovernanceGraphBadges({
        findings: [],
        ownershipRequired: true,
        ownershipSource: 'none',
        documentation: true,
        documentationRequired: true,
      })
    ).toContainEqual({
      id: 'ownership:missing',
      label: 'Missing owner',
      kind: 'ownership',
      status: 'warning',
      message: 'No ownership metadata or CODEOWNERS mapping was found.',
    });
  });

  it('escalates ownership missing to critical when an ownership error finding exists', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [
        finding({
          severity: 'error',
          category: 'ownership',
          ruleId: 'ownership-presence',
          type: 'ownership-gap',
        }),
      ],
      ownershipRequired: true,
      ownershipSource: 'none',
      documentation: true,
      documentationRequired: true,
      isKnown: true,
    });

    expect(result.badges[0]).toMatchObject({
      id: 'ownership:missing',
      status: 'critical',
    });
    expect(result.health).toBe('critical');
  });

  it('emits a documentation missing badge when documentation is required and absent', () => {
    expect(
      deriveGovernanceGraphBadges({
        findings: [],
        owner: '@org/payments',
        ownershipRequired: true,
        documentationRequired: true,
      })
    ).toContainEqual({
      id: 'documentation:missing',
      label: 'Missing docs',
      kind: 'documentation',
      status: 'warning',
      message: 'Documentation metadata is missing or incomplete.',
    });
  });

  it('prefers critical over warning and unknown status inputs deterministically', () => {
    const result = deriveGovernanceGraphNodeStatus({
      findings: [finding({ severity: 'error' })],
      ownershipRequired: true,
      ownershipSource: 'none',
      isKnown: false,
    });

    expect(result.health).toBe('critical');
  });

  it('sorts badges deterministically', () => {
    const result = deriveGovernanceGraphBadges({
      findings: [],
      ownershipRequired: true,
      documentationRequired: true,
    });

    expect(result.map((badge) => badge.id)).toEqual([
      'ownership:missing',
      'documentation:missing',
    ]);
  });
});

function finding(
  overrides: Partial<GovernanceGraphFinding> = {}
): GovernanceGraphFinding {
  return {
    id: overrides.id ?? 'finding-1',
    source: overrides.source ?? 'policy',
    severity: overrides.severity ?? 'info',
    message: overrides.message ?? 'Finding message.',
    ...(overrides.ruleId ? { ruleId: overrides.ruleId } : {}),
    ...(overrides.projectId ? { projectId: overrides.projectId } : {}),
    ...(overrides.targetProjectId
      ? { targetProjectId: overrides.targetProjectId }
      : {}),
    ...(overrides.category ? { category: overrides.category } : {}),
    ...(overrides.type ? { type: overrides.type } : {}),
    ...(overrides.sourcePluginId
      ? { sourcePluginId: overrides.sourcePluginId }
      : {}),
  };
}
