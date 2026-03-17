import { ConformanceAdapterError } from '../../conformance-adapter/conformance-adapter.js';
import {
  renderWorkspaceConformanceSummary,
  runWorkspaceConformanceExecutor,
} from './executor.js';

describe('workspace-conformance executor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders diagnostic summary output', () => {
    expect(
      renderWorkspaceConformanceSummary({
        total: 7,
        errors: 3,
        warnings: 2,
      })
    ).toBe('Findings: 7\nErrors: 3\nWarnings: 2');
  });

  it('prints finding, error, and warning counts from conformance summary', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const readSnapshot = jest.fn().mockReturnValue({
      source: 'nx-conformance' as const,
      extractedAt: '2026-03-17T00:00:00.000Z',
      findings: [],
    });
    const summarize = jest
      .fn()
      .mockReturnValue({ total: 5, errors: 2, warnings: 3 });

    const result = await runWorkspaceConformanceExecutor(
      { conformanceJson: 'dist/conformance-result.json' },
      {
        readSnapshot,
        summarize,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: true });
    expect(info).toHaveBeenCalledWith('Findings: 5\nErrors: 2\nWarnings: 3');
    expect(error).not.toHaveBeenCalled();
    expect(readSnapshot).toHaveBeenCalledWith({
      conformanceJson: 'dist/conformance-result.json',
    });
  });

  it('returns unsuccessful and logs reasoned message when loading fails', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const readSnapshot = jest.fn().mockImplementation(() => {
      throw new Error('Conformance file not found at /tmp/missing.json.');
    });
    const summarize = jest.fn();

    const result = await runWorkspaceConformanceExecutor(
      { conformanceJson: '/tmp/missing.json' },
      {
        readSnapshot,
        summarize,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Unable to read Nx Conformance results: Conformance file not found at /tmp/missing.json.'
    );
    expect(info).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('returns unsuccessful and includes adapter reason in output message', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const readSnapshot = jest.fn().mockImplementation(() => {
      throw new ConformanceAdapterError(
        'Conformance file at /tmp/input.json contains invalid JSON.',
        'invalid JSON'
      );
    });
    const summarize = jest.fn();

    const result = await runWorkspaceConformanceExecutor(
      { conformanceJson: '/tmp/input.json' },
      {
        readSnapshot,
        summarize,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Unable to read Nx Conformance results (invalid JSON): Conformance file at /tmp/input.json contains invalid JSON.'
    );
    expect(info).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });
});
