import { GovernanceWorkspace } from '../core/index.js';
import { angularCleanupProfile } from '../presets/angular-cleanup/profile.js';

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
    const violations = evaluatePolicies(baseWorkspace, angularCleanupProfile);

    expect(violations.some((v) => v.ruleId === 'domain-boundary')).toBe(true);
  });

  it('flags ownership when ownership is required', () => {
    const violations = evaluatePolicies(baseWorkspace, angularCleanupProfile);

    expect(
      violations.filter((violation) => violation.ruleId === 'ownership-presence')
        .length
    ).toBe(2);
  });

  it('flags layer boundary when higher layer depends on lower-positioned layer', () => {
    const profile = {
      ...angularCleanupProfile,
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
});
