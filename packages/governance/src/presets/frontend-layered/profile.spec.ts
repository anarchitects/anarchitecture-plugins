import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  backendLayered3TierProfile,
  backendLayeredDddProfile,
  createBackendLayered3TierStarterProfile,
  createBackendLayeredDddStarterProfile,
  createFrontendLayeredStarterProfile,
  createLayeredWorkspaceStarterProfile,
  frontendLayeredProfile,
  loadProfileOverrides,
} from './profile.js';

describe('loadProfileOverrides', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns defaults with empty exceptions when the profile file is missing', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      const result = await loadProfileOverrides(
        workspaceRoot,
        'missing-profile'
      );

      expect(result.exceptions).toEqual([]);
      expect(result.projectOverrides).toEqual({});
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('exposes a deterministic starter profile template for init seeding', () => {
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

  it('resolves the frontend-layered profile name with the expected defaults', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      const result = await loadProfileOverrides(
        workspaceRoot,
        'frontend-layered'
      );

      expect(result.layers).toEqual(frontendLayeredProfile.layers);
      expect(result.allowedDomainDependencies).toEqual(
        frontendLayeredProfile.allowedDomainDependencies
      );
      expect(result.ownership).toEqual(frontendLayeredProfile.ownership);
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('lets frontend-layered fall back to an existing layered-workspace runtime profile file', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(
        workspaceRoot,
        {
          boundaryPolicySource: 'profile',
          layers: ['app', 'feature', 'util'],
          projectOverrides: {
            checkout: {
              documentation: true,
            },
          },
        },
        'layered-workspace'
      );

      const result = await loadProfileOverrides(
        workspaceRoot,
        'frontend-layered'
      );

      expect(result.layers).toEqual(['app', 'feature', 'util']);
      expect(result.projectOverrides).toEqual({
        checkout: {
          documentation: true,
        },
      });
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('resolves backend-layered-3tier with its dedicated layer taxonomy', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      const result = await loadProfileOverrides(
        workspaceRoot,
        'backend-layered-3tier'
      );

      expect(result.layers).toEqual(backendLayered3TierProfile.layers);
      expect(createBackendLayered3TierStarterProfile().layers).toEqual([
        'api',
        'service',
        'data-access',
      ]);
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('resolves backend-layered-ddd with its dedicated layer taxonomy', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      const result = await loadProfileOverrides(
        workspaceRoot,
        'backend-layered-ddd'
      );

      expect(result.layers).toEqual(backendLayeredDddProfile.layers);
      expect(createBackendLayeredDddStarterProfile().layers).toEqual([
        'api',
        'application',
        'domain',
        'infrastructure',
      ]);
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('keeps existing behavior when no exceptions are declared', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        boundaryPolicySource: 'profile',
        layers: ['app', 'feature', 'util'],
        allowedDomainDependencies: {
          '*': ['shared'],
        },
        ownership: {
          required: false,
          metadataField: 'ownership',
        },
        metrics: {
          architecturalEntropyWeight: 0.4,
        },
        projectOverrides: {
          'billing-app': {
            documentation: true,
          },
        },
      });

      const result = await loadProfileOverrides(
        workspaceRoot,
        'frontend-layered'
      );

      expect(result.exceptions).toEqual([]);
      expect(result.layers).toEqual(['app', 'feature', 'util']);
      expect(result.ownership).toEqual({
        required: false,
        metadataField: 'ownership',
      });
      expect(result.metrics?.['architectural-entropy']).toBe(0.4);
      expect(result.projectOverrides).toEqual({
        'billing-app': {
          documentation: true,
        },
      });
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('loads ESLint constraints from a custom helper path declared in the runtime profile', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        boundaryPolicySource: 'eslint',
        eslint: {
          helperPath: 'tools/custom/governance-helper.mjs',
        },
      });
      writeHelper(
        workspaceRoot,
        'tools/custom/governance-helper.mjs',
        `export const governanceDepConstraints = [
  {
    sourceTag: 'domain:billing',
    onlyDependOnLibsWithTags: ['domain:shared', 'domain:reporting'],
  },
];
`
      );

      const result = await loadProfileOverrides(
        workspaceRoot,
        'frontend-layered'
      );

      expect(result.eslintHelperPath).toBe(
        'tools/custom/governance-helper.mjs'
      );
      expect(result.runtimeWarnings).toEqual([
        'Boundary policy source is ESLint constraints (tools/custom/governance-helper.mjs). Profile allowedDomainDependencies is treated as fallback.',
      ]);
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('loads and normalizes policy and conformance exceptions', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        exceptions: [
          {
            id: ' z-conformance ',
            source: 'conformance',
            scope: {
              source: 'conformance',
              ruleId: ' enforce-module-boundaries ',
              relatedProjectIds: [
                'payments-lib',
                'checkout-app',
                'payments-lib',
              ],
            },
            reason: ' Known migration overlap. ',
            owner: ' @org/architecture ',
            review: {
              reviewBy: ' 2026-06-01 ',
            },
          },
          {
            id: ' a-policy ',
            source: 'policy',
            scope: {
              source: 'policy',
              ruleId: ' domain-boundary ',
              projectId: ' billing-feature ',
              targetProjectId: ' shared-util ',
            },
            reason: ' Transitional boundary. ',
            owner: ' @org/architecture ',
            review: {
              expiresAt: ' 2026-08-01 ',
            },
          },
        ],
      });

      const result = await loadProfileOverrides(
        workspaceRoot,
        'frontend-layered'
      );

      expect(result.exceptions).toEqual([
        {
          id: 'a-policy',
          source: 'policy',
          scope: {
            source: 'policy',
            ruleId: 'domain-boundary',
            projectId: 'billing-feature',
            targetProjectId: 'shared-util',
          },
          reason: 'Transitional boundary.',
          owner: '@org/architecture',
          review: {
            expiresAt: '2026-08-01',
          },
        },
        {
          id: 'z-conformance',
          source: 'conformance',
          scope: {
            source: 'conformance',
            ruleId: 'enforce-module-boundaries',
            relatedProjectIds: ['checkout-app', 'payments-lib'],
          },
          reason: 'Known migration overlap.',
          owner: '@org/architecture',
          review: {
            reviewBy: '2026-06-01',
          },
        },
      ]);
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('rejects non-array exceptions', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        exceptions: {
          id: 'invalid',
        },
      });

      await expect(
        loadProfileOverrides(workspaceRoot, 'frontend-layered')
      ).rejects.toThrow(
        `Governance profile at ${path.join(
          workspaceRoot,
          'tools/governance/profiles/frontend-layered.json'
        )} has invalid exceptions: expected an array.`
      );
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('rejects invalid exception entries with file-aware context', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        exceptions: [
          {
            id: 'bad-review',
            source: 'policy',
            scope: {
              source: 'policy',
              ruleId: 'domain-boundary',
              projectId: 'billing-feature',
            },
            reason: 'Missing review window.',
            owner: '@org/architecture',
            review: {},
          },
        ],
      });

      await expect(
        loadProfileOverrides(workspaceRoot, 'frontend-layered')
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          `Governance profile at ${path.join(
            workspaceRoot,
            'tools/governance/profiles/frontend-layered.json'
          )} has invalid exception "bad-review" at index 0: Governance exception review must define reviewBy or expiresAt.`
        ),
      });
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('rejects duplicate exception ids', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        exceptions: [
          {
            id: 'duplicate-id',
            source: 'policy',
            scope: {
              source: 'policy',
              ruleId: 'domain-boundary',
              projectId: 'billing-feature',
            },
            reason: 'First exception.',
            owner: '@org/architecture',
            review: {
              reviewBy: '2026-06-01',
            },
          },
          {
            id: 'duplicate-id',
            source: 'conformance',
            scope: {
              source: 'conformance',
              ruleId: 'enforce-module-boundaries',
            },
            reason: 'Second exception.',
            owner: '@org/architecture',
            review: {
              expiresAt: '2026-08-01',
            },
          },
        ],
      });

      await expect(
        loadProfileOverrides(workspaceRoot, 'frontend-layered')
      ).rejects.toThrow(
        `Governance profile at ${path.join(
          workspaceRoot,
          'tools/governance/profiles/frontend-layered.json'
        )} has duplicate exception id "duplicate-id".`
      );
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });

  it('rejects mismatched top-level and scope sources through the loader', async () => {
    const workspaceRoot = mkTempWorkspaceRoot();

    try {
      writeProfile(workspaceRoot, {
        exceptions: [
          {
            id: 'source-mismatch',
            source: 'policy',
            scope: {
              source: 'conformance',
              ruleId: 'enforce-module-boundaries',
            },
            reason: 'Mismatched source.',
            owner: '@org/architecture',
            review: {
              reviewBy: '2026-06-01',
            },
          },
        ],
      });

      await expect(
        loadProfileOverrides(workspaceRoot, 'frontend-layered')
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Exception "source-mismatch" has source "policy" but scope source "conformance".'
        ),
      });
    } finally {
      cleanupTempWorkspaceRoot(workspaceRoot);
    }
  });
});

function mkTempWorkspaceRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'nx-governance-profile-'));
}

function cleanupTempWorkspaceRoot(workspaceRoot: string): void {
  rmSync(workspaceRoot, { recursive: true, force: true });
}

function writeProfile(
  workspaceRoot: string,
  content: Record<string, unknown>,
  profileName = 'frontend-layered'
): void {
  const profilesDir = path.join(workspaceRoot, 'tools/governance/profiles');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(
    path.join(profilesDir, `${profileName}.json`),
    `${JSON.stringify(content, null, 2)}\n`
  );
}

function writeHelper(
  workspaceRoot: string,
  helperPath: string,
  content: string
): void {
  const absolutePath = path.join(workspaceRoot, helperPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}
