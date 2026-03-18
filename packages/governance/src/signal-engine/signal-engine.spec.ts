import type { ConformanceSnapshot } from '../conformance-adapter/conformance-adapter.js';
import type { WorkspaceGraphSnapshot } from '../nx-adapter/graph-adapter.js';
import {
  buildConformanceSignals,
  buildGovernanceSignals,
  buildGraphSignals,
} from './index.js';

describe('signal-engine', () => {
  it('emits baseline structural and additive cross-domain signals for a cross-domain dependency', () => {
    const signals = buildGraphSignals(
      makeGraphSnapshot({
        projects: [
          {
            id: 'shop-app',
            domain: 'shop',
          },
          {
            id: 'billing-lib',
            domain: 'billing',
          },
        ],
        dependencies: [
          {
            sourceProjectId: 'shop-app',
            targetProjectId: 'billing-lib',
            type: 'static',
          },
        ],
      })
    );

    const structuralSignal = signals.find(
      (signal) => signal.type === 'structural-dependency'
    );
    const crossDomainSignal = signals.find(
      (signal) => signal.type === 'cross-domain-dependency'
    );

    expect(signals).toHaveLength(2);
    expect(structuralSignal).toBeDefined();
    expect(structuralSignal).toMatchObject({
      source: 'graph',
      severity: 'info',
      category: 'dependency',
      sourceProjectId: 'shop-app',
      targetProjectId: 'billing-lib',
      relatedProjectIds: ['billing-lib', 'shop-app'],
      createdAt: '2026-03-17T00:00:00.000Z',
    });

    expect(crossDomainSignal).toBeDefined();
    expect(crossDomainSignal).toMatchObject({
      source: 'graph',
      severity: 'warning',
      category: 'boundary',
      sourceProjectId: 'shop-app',
      targetProjectId: 'billing-lib',
      relatedProjectIds: ['billing-lib', 'shop-app'],
      metadata: {
        sourceDomain: 'shop',
        targetDomain: 'billing',
      },
      createdAt: '2026-03-17T00:00:00.000Z',
    });
  });

  it('emits missing-domain-context as additive signal and keeps boundary category explicit', () => {
    const signals = buildGraphSignals(
      makeGraphSnapshot({
        projects: [
          {
            id: 'app-a',
            domain: undefined,
          },
          {
            id: 'lib-b',
            domain: 'shared',
          },
        ],
        dependencies: [
          {
            sourceProjectId: 'app-a',
            targetProjectId: 'lib-b',
            type: 'static',
          },
        ],
      })
    );

    const structuralSignal = signals.find(
      (signal) => signal.type === 'structural-dependency'
    );
    const missingDomainSignal = signals.find(
      (signal) => signal.type === 'missing-domain-context'
    );

    expect(signals).toHaveLength(2);
    expect(structuralSignal).toBeDefined();
    expect(missingDomainSignal).toBeDefined();
    expect(missingDomainSignal).toMatchObject({
      source: 'graph',
      severity: 'warning',
      category: 'boundary',
      metadata: {
        sourceDomain: undefined,
        targetDomain: 'shared',
        missingSourceDomain: true,
        missingTargetDomain: false,
      },
      createdAt: '2026-03-17T00:00:00.000Z',
    });
  });

  it('maps conformance findings and only sets targetProjectId when exactly one related project exists', () => {
    const signals = buildConformanceSignals(
      makeConformanceSnapshot({
        findings: [
          {
            id: 'finding-a',
            category: 'boundary',
            severity: 'error',
            projectId: 'project-a',
            relatedProjectIds: ['project-b'],
            message: 'Boundary rule violated',
          },
          {
            id: 'finding-b',
            category: 'compliance',
            severity: 'warning',
            projectId: 'project-a',
            relatedProjectIds: ['project-c', 'project-b', 'project-c'],
            message: 'Compliance rule warning',
          },
        ],
      })
    );

    const singleTargetSignal = signals.find(
      (signal) => signal.message === 'Boundary rule violated'
    );
    const multiTargetSignal = signals.find(
      (signal) => signal.message === 'Compliance rule warning'
    );

    expect(singleTargetSignal).toMatchObject({
      type: 'conformance-violation',
      source: 'conformance',
      sourceProjectId: 'project-a',
      targetProjectId: 'project-b',
      relatedProjectIds: ['project-b'],
      category: 'boundary',
      severity: 'error',
      message: 'Boundary rule violated',
      createdAt: '2026-03-18T00:00:00.000Z',
    });
    expect(multiTargetSignal).toMatchObject({
      type: 'conformance-violation',
      source: 'conformance',
      sourceProjectId: 'project-a',
      targetProjectId: undefined,
      relatedProjectIds: ['project-b', 'project-c'],
      category: 'compliance',
      severity: 'warning',
      message: 'Compliance rule warning',
      createdAt: '2026-03-18T00:00:00.000Z',
    });
  });

  it('includes normalized relatedProjectIds in deterministic id generation', () => {
    const signals = buildConformanceSignals(
      makeConformanceSnapshot({
        findings: [
          {
            id: 'finding-1',
            category: 'dependency',
            severity: 'warning',
            projectId: 'project-a',
            relatedProjectIds: ['project-b', 'project-c'],
            message: 'Dependency warning',
          },
          {
            id: 'finding-2',
            category: 'dependency',
            severity: 'warning',
            projectId: 'project-a',
            relatedProjectIds: ['project-b', 'project-d'],
            message: 'Dependency warning',
          },
        ],
      })
    );

    expect(signals).toHaveLength(2);
    expect(signals[0].targetProjectId).toBeUndefined();
    expect(signals[1].targetProjectId).toBeUndefined();
    expect(signals[0].id).not.toBe(signals[1].id);
  });

  it('deduplicates by id and sorts deterministically across merged sources', () => {
    const signals = buildGovernanceSignals({
      graphSnapshot: makeGraphSnapshot({
        projects: [
          { id: 'a', domain: 'core' },
          { id: 'b', domain: 'core' },
          { id: 'c', domain: 'core' },
        ],
        dependencies: [
          { sourceProjectId: 'b', targetProjectId: 'c', type: 'static' },
          { sourceProjectId: 'a', targetProjectId: 'c', type: 'static' },
        ],
      }),
      conformanceSnapshot: makeConformanceSnapshot({
        findings: [
          {
            id: 'dup-1',
            category: 'boundary',
            severity: 'info',
            projectId: 'b',
            relatedProjectIds: [],
            message: 'same issue',
          },
          {
            id: 'dup-2',
            category: 'boundary',
            severity: 'info',
            projectId: 'b',
            relatedProjectIds: [],
            message: 'same issue',
          },
          {
            id: 'warn-1',
            category: 'boundary',
            severity: 'warning',
            projectId: 'z',
            relatedProjectIds: [],
            message: 'warn issue',
          },
          {
            id: 'error-1',
            category: 'boundary',
            severity: 'error',
            projectId: 'a',
            relatedProjectIds: [],
            message: 'error issue',
          },
          {
            id: 'info-1',
            category: 'boundary',
            severity: 'info',
            projectId: 'a',
            relatedProjectIds: [],
            message: 'alpha info issue',
          },
        ],
      }),
    });

    expect(signals).toHaveLength(6);
    expect(signals.filter((signal) => signal.source === 'graph')).toHaveLength(2);
    expect(signals.filter((signal) => signal.source === 'conformance')).toHaveLength(
      4
    );

    expect(
      signals.map(
        (signal) =>
          `${signal.source}|${signal.type}|${signal.severity}|${signal.sourceProjectId ?? ''}|${signal.message}`
      )
    ).toEqual([
      'graph|structural-dependency|info|a|Dependency: a -> c.',
      'graph|structural-dependency|info|b|Dependency: b -> c.',
      'conformance|conformance-violation|info|a|alpha info issue',
      'conformance|conformance-violation|info|b|same issue',
      'conformance|conformance-violation|warning|z|warn issue',
      'conformance|conformance-violation|error|a|error issue',
    ]);
  });
});

function makeGraphSnapshot(input: {
  projects: Array<{ id: string; domain?: string }>;
  dependencies: WorkspaceGraphSnapshot['dependencies'];
}): WorkspaceGraphSnapshot {
  return {
    source: 'nx-graph',
    extractedAt: '2026-03-17T00:00:00.000Z',
    projects: input.projects.map((project) => ({
      id: project.id,
      name: project.id,
      type: 'library',
      tags: project.domain ? [`domain:${project.domain}`] : [],
      domain: project.domain,
    })),
    dependencies: input.dependencies,
  };
}

function makeConformanceSnapshot(input: {
  findings: ConformanceSnapshot['findings'];
}): ConformanceSnapshot {
  return {
    source: 'nx-conformance',
    extractedAt: '2026-03-18T00:00:00.000Z',
    findings: input.findings,
  };
}

