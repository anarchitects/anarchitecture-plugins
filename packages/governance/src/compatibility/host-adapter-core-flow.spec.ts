import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildGovernanceWorkspace } from '@anarchitects/governance-core';
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

    expect(runGovernanceSource).toContain(
      "from '@anarchitects/governance-core';"
    );
    expect(runGovernanceSource).toContain(
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
    const bookingDomainProject = workspace.projects.find(
      (project) => project.id === 'booking-domain'
    );
    const bookingUiProject = workspace.projects.find(
      (project) => project.id === 'booking-ui'
    );

    expect(adapterResult.capabilities).toEqual(
      expect.arrayContaining([capability])
    );
    expect(adapterResult.capabilities?.map((c) => c.id)).toEqual([
      'capability:nx',
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
      dependencies: [
        {
          source: 'booking-ui',
          target: 'booking-domain',
          type: 'static',
          sourceFile: 'libs/booking/ui/src/lib/ui.ts',
        },
      ],
    });
    expect(bookingUiProject).toMatchObject({
      id: 'booking-ui',
      root: 'libs/booking/ui',
      domain: 'booking',
      layer: 'ui',
    });
    expect(bookingDomainProject).toMatchObject({
      id: 'booking-domain',
      root: 'libs/booking/domain',
      domain: 'booking',
      layer: 'domain',
    });
  });
});
