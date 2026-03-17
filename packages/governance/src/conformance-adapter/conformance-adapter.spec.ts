import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ConformanceAdapter,
  ConformanceAdapterError,
  extractProjects,
  mapRuleToCategory,
  normalizeSeverity,
  sanitizeMetadata,
  summarizeConformance,
} from './conformance-adapter.js';

describe('ConformanceAdapter', () => {
  const adapter = new ConformanceAdapter();

  it('supports array-based conformance findings', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      {
        id: 'a',
        ruleId: 'enforce-project-boundaries',
        severity: 'error',
        message: 'cross boundary import',
      },
    ]);

    expect(snapshot.source).toBe('nx-conformance');
    expect(snapshot.findings).toEqual([
      {
        id: 'a',
        ruleId: 'enforce-project-boundaries',
        category: 'boundary',
        severity: 'error',
        projectId: undefined,
        relatedProjectIds: [],
        message: 'cross boundary import',
      },
    ]);
  });

  it('supports object shape with violations and workspace id', () => {
    const snapshot = adapter.readSnapshotFromParsedInput({
      workspaceId: 'workspace-a',
      violations: [
        {
          rule: '@nx/conformance/ensure-owners',
          severity: 'warn',
          message: 'missing owner',
          project: 'libs/shared',
        },
      ],
    });

    expect(snapshot.workspaceId).toBe('workspace-a');
    expect(snapshot.findings).toHaveLength(1);
    expect(snapshot.findings[0]).toMatchObject({
      ruleId: '@nx/conformance/ensure-owners',
      category: 'ownership',
      severity: 'warning',
      projectId: 'libs/shared',
      relatedProjectIds: [],
      message: 'missing owner',
    });
  });

  it('supports nested results/rules with violations', () => {
    const snapshot = adapter.readSnapshotFromParsedInput({
      results: [
        {
          ruleId: 'dependency-check',
          violations: [
            {
              severity: 'error',
              message: 'dependency mismatch',
              projectId: 'a',
              targetProjectId: 'b',
            },
          ],
        },
      ],
    });

    expect(snapshot.findings).toEqual([
      {
        id: expect.stringMatching(/^finding-/),
        ruleId: undefined,
        category: 'dependency',
        severity: 'error',
        projectId: 'a',
        relatedProjectIds: ['b'],
        message: 'dependency mismatch',
      },
    ]);
  });

  it('classifies file-not-found errors', () => {
    expect(() =>
      adapter.readSnapshot({
        conformanceJson: `/tmp/missing-conformance-${Date.now()}.json`,
      })
    ).toThrow(ConformanceAdapterError);

    try {
      adapter.readSnapshot({
        conformanceJson: `/tmp/missing-conformance-${Date.now()}.json`,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConformanceAdapterError);
      expect((error as ConformanceAdapterError).reason).toBe('file not found');
    }
  });

  it('classifies invalid JSON errors', () => {
    const fixture = makeFixtureFile('{ invalid json');

    try {
      expect(() =>
        adapter.readSnapshot({
          conformanceJson: fixture.filePath,
        })
      ).toThrow(ConformanceAdapterError);

      try {
        adapter.readSnapshot({ conformanceJson: fixture.filePath });
      } catch (error) {
        expect(error).toBeInstanceOf(ConformanceAdapterError);
        expect((error as ConformanceAdapterError).reason).toBe('invalid JSON');
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('classifies unsupported shapes', () => {
    expect(() =>
      adapter.readSnapshotFromParsedInput({ hello: 'world' })
    ).toThrow(ConformanceAdapterError);

    try {
      adapter.readSnapshotFromParsedInput({ hello: 'world' });
    } catch (error) {
      expect((error as ConformanceAdapterError).reason).toBe(
        'unsupported shape'
      );
    }
  });

  it('normalizes unknown severity to warning and marks metadata flag', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      {
        ruleId: 'custom-rule',
        severity: 'critical',
        message: 'custom issue',
      },
    ]);

    expect(snapshot.findings[0]).toMatchObject({
      severity: 'warning',
      metadata: {
        normalizedSeverity: true,
      },
    });
  });

  it('builds deterministic IDs when missing', () => {
    const first = adapter.readSnapshotFromParsedInput([
      { ruleId: 'a', message: 'm', projectId: 'p' },
    ]);
    const second = adapter.readSnapshotFromParsedInput([
      { ruleId: 'a', message: 'm', projectId: 'p' },
    ]);

    expect(first.findings[0].id).toBe(second.findings[0].id);
    expect(first.findings[0].id).toMatch(/^finding-/);
  });

  it('falls back to index-based ID only when hashing input is unavailable', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      {
        severity: 'warning',
      },
    ]);

    expect(snapshot.findings[0].id).toBe('finding-1');
  });

  it('deduplicates and sorts related project ids', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      {
        projectId: 'a',
        relatedProjectIds: ['d', 'b', 'd', 'c'],
        targetProjectId: 'b',
      },
    ]);

    expect(snapshot.findings[0].relatedProjectIds).toEqual(['b', 'c', 'd']);
  });

  it('sanitizes metadata to non-mapped shallow fields only', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      {
        ruleId: 'dep',
        message: 'm',
        customString: 'ok',
        customNumber: 2,
        customBoolean: true,
        nested: { too: 'big' },
        largeArray: Array.from({ length: 30 }, (_, i) => `${i}`),
        list: ['a', 'b'],
      },
    ]);

    expect(snapshot.findings[0].metadata).toEqual({
      customString: 'ok',
      customNumber: 2,
      customBoolean: true,
      list: ['a', 'b'],
      normalizedSeverity: true,
    });
  });

  it('summarizes findings by severity', () => {
    const snapshot = adapter.readSnapshotFromParsedInput([
      { ruleId: 'a', message: 'm1', severity: 'error' },
      { ruleId: 'b', message: 'm2', severity: 'warning' },
      { ruleId: 'c', message: 'm3', severity: 'info' },
    ]);

    expect(summarizeConformance(snapshot)).toEqual({
      total: 3,
      errors: 1,
      warnings: 1,
    });
  });
});

describe('conformance helpers', () => {
  it('maps category by rule/message matcher registry', () => {
    expect(mapRuleToCategory('enforce-project-boundaries', 'x')).toBe(
      'boundary'
    );
    expect(mapRuleToCategory('enforce-dependencies', 'x')).toBe('dependency');
    expect(mapRuleToCategory('ensure-owners', 'x')).toBe('ownership');
    expect(mapRuleToCategory('foo', 'Conformance check failed')).toBe(
      'compliance'
    );
    expect(mapRuleToCategory('foo', 'x')).toBe('unknown');
  });

  it('normalizes severity to canonical model', () => {
    expect(normalizeSeverity('error')).toEqual({
      severity: 'error',
      normalized: false,
    });
    expect(normalizeSeverity('warn')).toEqual({
      severity: 'warning',
      normalized: false,
    });
    expect(normalizeSeverity('warning')).toEqual({
      severity: 'warning',
      normalized: false,
    });
    expect(normalizeSeverity('info')).toEqual({
      severity: 'info',
      normalized: false,
    });
    expect(normalizeSeverity('unknown')).toEqual({
      severity: 'warning',
      normalized: true,
    });
  });

  it('extracts project identifiers and always returns related array', () => {
    expect(
      extractProjects({
        project: { name: 'a' },
        projectIds: ['c', 'b'],
        targetProject: { id: 'd' },
      })
    ).toEqual({
      projectId: 'a',
      relatedProjectIds: ['b', 'c', 'd'],
    });

    expect(extractProjects({})).toEqual({
      projectId: undefined,
      relatedProjectIds: [],
    });
  });

  it('sanitizes metadata with mapped fields excluded', () => {
    expect(
      sanitizeMetadata({
        ruleId: 'a',
        message: 'm',
        id: 'x',
        keep: 'y',
        nested: { z: 1 },
      })
    ).toEqual({
      keep: 'y',
    });
  });
});

function makeFixtureFile(content: string): {
  filePath: string;
  cleanup: () => void;
} {
  const dirPath = mkdtempSync(
    path.join(tmpdir(), 'nx-governance-conformance-')
  );
  const filePath = path.join(dirPath, 'conformance.json');
  writeFileSync(filePath, content, 'utf8');

  return {
    filePath,
    cleanup: () => rmSync(dirPath, { recursive: true, force: true }),
  };
}
