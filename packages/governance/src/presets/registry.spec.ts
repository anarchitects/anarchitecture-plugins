import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  backendLayered3TierProfile,
  backendLayeredDddProfile,
  createBackendLayered3TierStarterProfile,
  createBackendLayeredDddStarterProfile,
} from './backend-layered/profile.js';
import {
  createFrontendLayeredStarterProfile,
  frontendLayeredProfile,
} from './frontend-layered/profile.js';
import {
  createLayeredWorkspaceStarterProfile,
  layeredWorkspaceProfile,
} from './layered-workspace/profile.js';
import {
  createBuiltInGovernanceStarterProfile,
  resolveBuiltInGovernanceProfile,
} from './registry.js';

describe('governance preset registry', () => {
  it('resolves frontend-layered through the neutral registry', () => {
    expect(resolveBuiltInGovernanceProfile('frontend-layered')).toEqual(
      frontendLayeredProfile
    );
  });

  it('resolves layered-workspace through the neutral registry', () => {
    expect(resolveBuiltInGovernanceProfile('layered-workspace')).toEqual(
      layeredWorkspaceProfile
    );
  });

  it('resolves backend-layered-3tier through the neutral registry', () => {
    expect(resolveBuiltInGovernanceProfile('backend-layered-3tier')).toEqual(
      backendLayered3TierProfile
    );
  });

  it('resolves backend-layered-ddd through the neutral registry', () => {
    expect(resolveBuiltInGovernanceProfile('backend-layered-ddd')).toEqual(
      backendLayeredDddProfile
    );
  });

  it('preserves starter profile shapes through the neutral registry', () => {
    expect(createBuiltInGovernanceStarterProfile('frontend-layered')).toEqual(
      createFrontendLayeredStarterProfile()
    );
    expect(createBuiltInGovernanceStarterProfile('layered-workspace')).toEqual(
      createLayeredWorkspaceStarterProfile()
    );
    expect(
      createBuiltInGovernanceStarterProfile('backend-layered-3tier')
    ).toEqual(createBackendLayered3TierStarterProfile());
    expect(
      createBuiltInGovernanceStarterProfile('backend-layered-ddd')
    ).toEqual(createBackendLayeredDddStarterProfile());
  });

  it('preserves the previous frontend starter profile shape', () => {
    expect(createFrontendLayeredStarterProfile()).toEqual({
      boundaryPolicySource: 'eslint',
      layers: ['app', 'feature', 'ui', 'data-access', 'util'],
      allowedDomainDependencies: {
        '*': ['shared'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {
        architecturalEntropyWeight: 0.2,
        dependencyComplexityWeight: 0.2,
        domainIntegrityWeight: 0.2,
        ownershipCoverageWeight: 0.2,
        documentationCompletenessWeight: 0.2,
        layerIntegrityWeight: 0.2,
      },
      projectOverrides: {},
    });
    expect(createFrontendLayeredStarterProfile()).toEqual(
      createLayeredWorkspaceStarterProfile()
    );
  });

  it('keeps backend-layered/profile.ts independent from frontend-layered/profile.ts', () => {
    const backendModule = readFileSync(
      path.join(__dirname, 'backend-layered/profile.ts'),
      'utf8'
    );

    expect(backendModule).not.toContain('../frontend-layered/profile.js');
    expect(backendModule).not.toContain('../frontend-layered/profile.js');
  });

  it('does not reintroduce angular-cleanup into the preset registry modules', () => {
    const files = [
      path.join(__dirname, 'frontend-layered/profile.ts'),
      path.join(__dirname, 'backend-layered/profile.ts'),
      path.join(__dirname, 'layered-workspace/profile.ts'),
      path.join(__dirname, 'registry.ts'),
    ];

    for (const filePath of files) {
      expect(readFileSync(filePath, 'utf8')).not.toContain('angular-cleanup');
    }
  });
});
