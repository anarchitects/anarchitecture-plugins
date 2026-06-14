import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildGovernanceWorkspace,
  evaluateGovernancePolicies,
} from '@anarchitects/governance-core';
import {
  createNxCapability,
  createNxWorkspaceAdapterResult,
  type AdapterWorkspaceSnapshot,
} from '@anarchitects/governance-adapter-nx';

describe('host -> adapter -> core compatibility flow', () => {
  it('keeps the host wired to published package roots instead of monolithic local paths', () => {
    const runGovernanceSource = readFileSync(
      path.join(__dirname, '..', 'plugin', 'run-governance.ts'),
      'utf8'
    );
    const compositionSource = readFileSync(
      path.join(__dirname, '..', 'plugin', 'compose-governance-runtime.ts'),
      'utf8'
    );

    expect(runGovernanceSource).toContain(
      "from '@anarchitects/governance-core';"
    );
    expect(runGovernanceSource).toContain(
      "from './compose-governance-runtime.js';"
    );
    expect(compositionSource).toContain(
      "from '@anarchitects/governance-core';"
    );
    expect(compositionSource).toContain(
      "from '@anarchitects/governance-adapter-nx';"
    );
    expect(runGovernanceSource).not.toMatch(
      /from '\.\.\/core\/index\.js'|from '\.\.\/core\/models\.js'/
    );
    expect(runGovernanceSource).not.toMatch(
      /from '\.\.\/nx-adapter\/read-workspace\.js'|from '\.\.\/nx-adapter\/capability\.js'|from '\.\.\/nx-adapter\/graph-adapter\.js'/
    );
  });

  it('keeps the adapter result consumable by Governance Core contracts', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'booking-ui',
          root: 'libs/booking/ui',
          type: 'library',
          tags: ['scope:booking', 'layer:ui', 'type:ui'],
          targets: ['build', 'test'],
          metadata: {
            documentation: true,
          },
        },
        {
          name: 'booking-domain',
          root: 'libs/booking/domain',
          type: 'library',
          tags: ['scope:booking', 'layer:domain', 'type:domain'],
          targets: ['lint'],
          metadata: {
            ownership: {
              team: 'booking-team',
            },
          },
        },
      ],
      dependencies: [
        {
          source: 'booking-ui',
          target: 'booking-domain',
          type: 'static',
          sourceFile: 'libs/booking/ui/src/lib/ui.ts',
        },
      ],
      codeownersByProject: {
        'booking-domain': ['@booking-team'],
      },
    };

    const adapterResult = createNxWorkspaceAdapterResult(snapshot);
    const workspace = buildGovernanceWorkspace(adapterResult);
    const capability = createNxCapability({
      workspaceRoot: snapshot.root,
      snapshot,
    });
    const bookingDomainNode = adapterResult.nodes?.find(
      (node) => node.id === 'booking-domain'
    );
    const bookingUiNode = adapterResult.nodes?.find(
      (node) => node.id === 'booking-ui'
    );

    expect(adapterResult.capabilities).toEqual(
      expect.arrayContaining([capability])
    );
    expect(adapterResult.capabilities?.map((c) => c.id)).toEqual([
      'capability:nx',
      'capability:ownership',
      'nx.dependency-graph',
      'nx.inferred-targets',
      'nx.ownership-evidence',
      'nx.project-graph',
      'nx.project-metadata',
      'nx.project-tags',
      'nx.targets',
    ]);
    expect(workspace).toMatchObject({
      id: 'workspace',
      name: 'workspace',
      root: '/workspace',
    });
    expect(adapterResult.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'booking-ui',
          targetNodeId: 'booking-domain',
          kind: 'dependency',
          metadata: expect.objectContaining({
            nx: expect.objectContaining({
              dependencyType: 'static',
              sourceFile: 'libs/booking/ui/src/lib/ui.ts',
            }),
          }),
        }),
      ])
    );
    expect(bookingUiNode).toMatchObject({
      id: 'booking-ui',
      root: 'libs/booking/ui',
      classification: {
        scope: 'booking',
        layer: 'ui',
      },
    });
    expect(bookingDomainNode).toMatchObject({
      id: 'booking-domain',
      root: 'libs/booking/domain',
      classification: {
        scope: 'booking',
        layer: 'domain',
      },
    });
  });

  it('leaves loose owner metadata as evidence only when Community ownership is required', () => {
    const snapshot: AdapterWorkspaceSnapshot = {
      root: '/workspace',
      projects: [
        {
          name: 'orders-domain',
          root: 'libs/orders/domain',
          type: 'library',
          tags: ['scope:orders', 'layer:domain'],
          targets: [],
          metadata: {
            owner: '@orders',
          },
        },
      ],
      dependencies: [],
      codeownersByProject: {},
    };

    const adapterResult = createNxWorkspaceAdapterResult(snapshot);
    const workspace = buildGovernanceWorkspace(adapterResult);
    const violations = evaluateGovernancePolicies(workspace, {
      name: 'ownership-required',
      layers: ['domain'],
      allowedDomainDependencies: {},
      ownership: {
        required: true,
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {},
    });

    expect(adapterResult.nodes?.[0]).not.toHaveProperty('ownership');
    expect(adapterResult.nodes?.[0].metadata).toEqual({
      nx: {
        projectType: 'library',
        root: 'libs/orders/domain',
        tags: ['scope:orders', 'layer:domain'],
        targets: [],
        projectMetadata: {
          owner: '@orders',
        },
      },
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'ownership-presence',
          subjectId: 'orders-domain',
          reference: {
            nodeId: 'orders-domain',
          },
        }),
      ])
    );
  });
});
