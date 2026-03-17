import {
  renderWorkspaceGraphSummary,
  runWorkspaceGraphExecutor,
} from './executor.js';

describe('workspace-graph executor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders diagnostic summary output', () => {
    expect(
      renderWorkspaceGraphSummary({ projectCount: 4, dependencyCount: 9 })
    ).toBe('Projects: 4\nDependencies: 9');
  });

  it('prints project and dependency counts from the adapter snapshot', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const readSnapshot = jest.fn().mockResolvedValue({
      source: 'nx-graph' as const,
      extractedAt: '2026-03-17T00:00:00.000Z',
      projects: [
        { id: 'a', name: 'a', type: 'library', tags: [] },
        { id: 'b', name: 'b', type: 'library', tags: [] },
      ],
      dependencies: [
        { sourceProjectId: 'a', targetProjectId: 'b', type: 'static' },
      ],
    });
    const summarize = jest
      .fn()
      .mockReturnValue({ projectCount: 2, dependencyCount: 1 });

    const result = await runWorkspaceGraphExecutor(
      {},
      {
        readSnapshot,
        summarize,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: true });
    expect(info).toHaveBeenCalledWith('Projects: 2\nDependencies: 1');
    expect(error).not.toHaveBeenCalled();
    expect(readSnapshot).toHaveBeenCalledWith({});
  });

  it('returns unsuccessful when graph loading fails', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const readSnapshot = jest.fn().mockRejectedValue(new Error('graph failed'));
    const summarize = jest.fn();

    const result = await runWorkspaceGraphExecutor(
      {},
      {
        readSnapshot,
        summarize,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith('graph failed');
    expect(info).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });
});
