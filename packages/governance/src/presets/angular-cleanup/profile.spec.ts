import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadProfileOverrides } from './profile.js';

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

      const result = await loadProfileOverrides(workspaceRoot, 'angular-cleanup');

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
              relatedProjectIds: ['payments-lib', 'checkout-app', 'payments-lib'],
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

      const result = await loadProfileOverrides(workspaceRoot, 'angular-cleanup');

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
        loadProfileOverrides(workspaceRoot, 'angular-cleanup')
      ).rejects.toThrow(
        `Governance profile at ${path.join(
          workspaceRoot,
          'tools/governance/profiles/angular-cleanup.json'
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
        loadProfileOverrides(workspaceRoot, 'angular-cleanup')
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          `Governance profile at ${path.join(
            workspaceRoot,
            'tools/governance/profiles/angular-cleanup.json'
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
        loadProfileOverrides(workspaceRoot, 'angular-cleanup')
      ).rejects.toThrow(
        `Governance profile at ${path.join(
          workspaceRoot,
          'tools/governance/profiles/angular-cleanup.json'
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
        loadProfileOverrides(workspaceRoot, 'angular-cleanup')
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
  content: Record<string, unknown>
): void {
  const profilesDir = path.join(workspaceRoot, 'tools/governance/profiles');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(
    path.join(profilesDir, 'angular-cleanup.json'),
    `${JSON.stringify(content, null, 2)}\n`
  );
}
