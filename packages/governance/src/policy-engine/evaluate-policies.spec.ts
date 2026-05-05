import { GovernanceWorkspace } from '../core/index.js';
import { frontendLayeredProfile } from '../presets/frontend-layered/profile.js';

import { evaluatePolicies } from './evaluate-policies.js';

describe('evaluatePolicies', () => {
  const baseWorkspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [
      {
        id: 'a',
        name: 'a',
        root: 'packages/a',
        type: 'library',
        tags: ['domain:shop', 'layer:feature'],
        domain: 'shop',
        layer: 'feature',
        ownership: { source: 'none' },
        metadata: {},
      },
      {
        id: 'b',
        name: 'b',
        root: 'packages/b',
        type: 'library',
        tags: ['domain:billing', 'layer:data-access'],
        domain: 'billing',
        layer: 'data-access',
        ownership: { source: 'none' },
        metadata: {},
      },
    ],
    dependencies: [
      {
        source: 'a',
        target: 'b',
        type: 'static',
      },
    ],
  };

  it('flags cross-domain dependency that is not allowed', () => {
    const violations = evaluatePolicies(baseWorkspace, frontendLayeredProfile);

    expect(violations.some((v) => v.ruleId === 'domain-boundary')).toBe(true);
  });

  it('flags ownership when ownership is required', () => {
    const violations = evaluatePolicies(baseWorkspace, frontendLayeredProfile);

    expect(
      violations.filter(
        (violation) => violation.ruleId === 'ownership-presence'
      ).length
    ).toBe(2);
  });

  it('flags layer boundary when higher layer depends on lower-positioned layer', () => {
    const profile = {
      ...frontendLayeredProfile,
      layers: ['app', 'feature', 'ui', 'data-access', 'util'],
      allowedDomainDependencies: {
        '*': ['billing'],
      },
    };

    const violations = evaluatePolicies(
      {
        ...baseWorkspace,
        dependencies: [{ source: 'b', target: 'a', type: 'static' }],
      },
      profile
    );

    expect(violations.some((v) => v.ruleId === 'layer-boundary')).toBe(true);
  });

  it('uses explicit layer dependencies to allow edges that ordered fallback would reject', () => {
    const violations = evaluatePolicies(
      {
        ...baseWorkspace,
        dependencies: [{ source: 'b', target: 'a', type: 'static' }],
      },
      {
        ...frontendLayeredProfile,
        allowedDomainDependencies: {
          '*': ['shop'],
        },
        allowedLayerDependencies: {
          'data-access': ['feature'],
        },
      }
    );

    expect(violations.some((v) => v.ruleId === 'layer-boundary')).toBe(false);
  });

  it('uses explicit layer dependencies to reject edges that ordered fallback would allow', () => {
    const violations = evaluatePolicies(baseWorkspace, {
      ...frontendLayeredProfile,
      allowedDomainDependencies: {
        '*': ['billing'],
      },
      allowedLayerDependencies: {
        feature: ['ui'],
      },
    });

    expect(violations.some((v) => v.ruleId === 'layer-boundary')).toBe(true);
  });

  it('uses explicit layer dependencies to govern same-layer edges', () => {
    const workspace: GovernanceWorkspace = {
      ...baseWorkspace,
      projects: [
        baseWorkspace.projects[0],
        {
          ...baseWorkspace.projects[1],
          id: 'c',
          name: 'c',
          root: 'packages/c',
          tags: ['domain:shop', 'layer:feature'],
          domain: 'shop',
          layer: 'feature',
        },
      ],
      dependencies: [{ source: 'a', target: 'c', type: 'static' }],
    };

    const violations = evaluatePolicies(workspace, {
      ...frontendLayeredProfile,
      allowedDomainDependencies: {
        '*': ['shop'],
      },
      allowedLayerDependencies: {
        feature: ['ui'],
      },
    });

    expect(violations.some((v) => v.ruleId === 'layer-boundary')).toBe(true);
  });

  it('preserves missing or unknown project layer behavior when explicit rules are present', () => {
    const workspace: GovernanceWorkspace = {
      ...baseWorkspace,
      projects: [
        {
          ...baseWorkspace.projects[0],
          tags: ['domain:shop', 'layer:unknown'],
          layer: 'unknown',
        },
        baseWorkspace.projects[1],
      ],
    };

    const violations = evaluatePolicies(workspace, {
      ...frontendLayeredProfile,
      allowedLayerDependencies: {
        feature: ['ui'],
      },
    });

    expect(violations.some((v) => v.ruleId === 'layer-boundary')).toBe(false);
  });

  it('can report both domain and layer violations for the same dependency', () => {
    const violations = evaluatePolicies(baseWorkspace, {
      ...frontendLayeredProfile,
      allowedDomainDependencies: {
        '*': [],
      },
      allowedLayerDependencies: {
        feature: ['ui'],
      },
    });

    expect(
      violations.filter((v) => v.ruleId === 'domain-boundary')
    ).toHaveLength(1);
    expect(
      violations.filter((v) => v.ruleId === 'layer-boundary')
    ).toHaveLength(1);
  });
});
