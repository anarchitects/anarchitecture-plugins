import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runAgovCli } from './agov.js';

describe('agov check', () => {
  it('executes a valid non-Nx governance check with explicit workspace and profile paths', () => {
    const workspacePath = path.join(
      __dirname,
      '..',
      'manual-workspace',
      'fixtures',
      'demo-workspace.yaml'
    );
    const profilePath = path.join(
      __dirname,
      'fixtures',
      'passing-profile.json'
    );
    const io = createMemoryIo();

    const exitCode = runAgovCli(
      [
        'check',
        '--workspace',
        workspacePath,
        '--profile',
        profilePath,
        '--format',
        'json',
      ],
      io
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(io.out)).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          id: 'demo',
          name: 'demo',
          root: '.',
          projects: [
            expect.objectContaining({
              id: 'customer-domain',
              domain: 'customer',
              layer: 'domain',
            }),
            expect.objectContaining({
              id: 'order-domain',
              domain: 'order',
              layer: 'domain',
            }),
          ],
          dependencies: [
            {
              source: 'customer-domain',
              target: 'order-domain',
              type: 'static',
            },
          ],
        },
        profile: 'check-pass',
        warnings: [],
        violations: [],
        signalBreakdown: {
          total: 0,
        },
        health: {
          score: 65,
          status: 'critical',
          grade: 'D',
        },
        recommendations: [],
      },
    });
    expect(io.err).toBe('');
  });

  it('returns a deterministic usage error when the workspace path is missing', () => {
    const io = createMemoryIo();

    expect(runAgovCli(['check', '--profile', 'profile.json'], io)).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.missing_workspace',
        message: 'Missing required agov check option "--workspace".',
      },
    });
  });

  it('returns a deterministic usage error when the profile path is missing', () => {
    const io = createMemoryIo();

    expect(runAgovCli(['check', '--workspace', 'workspace.yaml'], io)).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.missing_profile',
        message: 'Missing required agov check option "--profile".',
      },
    });
  });

  it('returns a deterministic JSON error for an invalid workspace file', () => {
    const profilePath = path.join(
      __dirname,
      'fixtures',
      'passing-profile.json'
    );
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-invalid-workspace-'));
    const invalidWorkspacePath = path.join(tempDir, 'invalid-workspace.yaml');
    writeFileSync(
      invalidWorkspacePath,
      'schemaVersion: 1\nworkspace: [\n',
      'utf8'
    );

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          invalidWorkspacePath,
          '--profile',
          profilePath,
          '--format',
          'json',
        ],
        io
      )
    ).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.workspace_load_failed',
        message: `Failed to parse YAML workspace file "${path.resolve(
          invalidWorkspacePath
        )}".`,
        details: {
          filePath: path.resolve(invalidWorkspacePath),
          loaderCode: 'governance.workspace_loader.parse_error',
        },
      },
    });
  });

  it('returns a deterministic JSON error for an invalid profile file', () => {
    const workspacePath = path.join(
      __dirname,
      '..',
      'manual-workspace',
      'fixtures',
      'demo-workspace.yaml'
    );
    const io = createMemoryIo();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-invalid-profile-'));
    const invalidProfilePath = path.join(tempDir, 'invalid-profile.json');
    writeFileSync(invalidProfilePath, '{"name":"broken"', 'utf8');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          invalidProfilePath,
          '--format',
          'json',
        ],
        io
      )
    ).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.profile_load_failed',
        message: `Failed to parse JSON governance profile file "${path.resolve(
          invalidProfilePath
        )}".`,
        details: {
          filePath: path.resolve(invalidProfilePath),
          loaderCode: 'governance.profile_loader.parse_error',
        },
      },
    });
  });

  it('produces deterministic JSON output for the same inputs', () => {
    const workspacePath = path.join(
      __dirname,
      '..',
      'manual-workspace',
      'fixtures',
      'demo-workspace.yaml'
    );
    const profilePath = path.join(
      __dirname,
      'fixtures',
      'passing-profile.json'
    );

    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'json',
        ],
        first
      )
    ).toBe(0);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'json',
        ],
        second
      )
    ).toBe(0);
    expect(first.out).toBe(second.out);
  });

  it('keeps standalone CLI files free of Nx imports', () => {
    for (const filePath of [
      path.resolve(__dirname, 'agov.ts'),
      path.resolve(__dirname, 'check.ts'),
      path.resolve(__dirname, 'bin/agov.ts'),
    ]) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(/from ['"]nx['"]/);
      expect(source).not.toMatch(/from ['"]@nx\//);
      expect(source).not.toMatch(/workspaceRoot/);
    }
  });
});

function createMemoryIo(): {
  out: string;
  err: string;
  stdout(message: string): void;
  stderr(message: string): void;
} {
  return {
    out: '',
    err: '',
    stdout(message: string) {
      this.out = message;
    },
    stderr(message: string) {
      this.err = message;
    },
  };
}
