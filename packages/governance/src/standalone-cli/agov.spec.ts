import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

  it('renders markdown output to stdout', () => {
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

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'markdown',
        ],
        io
      )
    ).toBe(0);
    expect(io.out).toContain('# agov check');
    expect(io.out).toContain('## Signal Sources');
    expect(io.out).toContain('| Source | Count |');
    expect(io.err).toBe('');
  });

  it('renders table output to stdout', () => {
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

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'table',
        ],
        io
      )
    ).toBe(0);
    expect(io.out).toContain('agov check');
    expect(io.out).toContain('Governance Check - check-pass');
    expect(io.out).toContain('Field      Value');
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

  it('returns a deterministic usage error for an unsupported format', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          'workspace.yaml',
          '--profile',
          'profile.json',
          '--format',
          'html',
        ],
        io
      )
    ).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.unsupported_format',
        message:
          'Unsupported agov check format. Supported formats are "json", "markdown", and "table".',
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

  it('writes report output to an explicit file path instead of stdout', () => {
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-output-'));
    const outputPath = path.join(tempDir, 'report.md');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'markdown',
          '--output',
          outputPath,
        ],
        io
      )
    ).toBe(0);
    expect(io.out).toBe('');
    expect(io.err).toBe('');
    expect(readFileSync(outputPath, 'utf8')).toContain('# agov check');
    expect(statSync(outputPath).isFile()).toBe(true);
  });

  it('returns a deterministic output write error for an invalid output path', () => {
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'agov-output-failure-'));
    const outputPath = path.join(tempDir, 'missing', 'report.md');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          workspacePath,
          '--profile',
          profilePath,
          '--format',
          'table',
          '--output',
          outputPath,
        ],
        io
      )
    ).toBe(1);
    expect(JSON.parse(io.err)).toEqual({
      error: {
        code: 'agov.cli.output_write_failed',
        message: `Failed to write agov report output to "${path.resolve(
          outputPath
        )}".`,
        details: {
          filePath: path.resolve(outputPath),
        },
      },
    });
    expect(io.out).toBe('');
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

  it('produces deterministic markdown output for the same inputs', () => {
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
          'markdown',
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
          'markdown',
        ],
        second
      )
    ).toBe(0);
    expect(first.out).toBe(second.out);
  });

  it('produces deterministic table output for the same inputs', () => {
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
          'table',
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
          'table',
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
      path.resolve(__dirname, 'render-report.ts'),
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
