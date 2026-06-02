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

  it('prints project and dependency counts from the host composition summary', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const summarizeGraph = jest.fn().mockResolvedValue({
      summary: { projectCount: 2, dependencyCount: 1 },
      source: 'host-canonical-workspace',
    });

    const result = await runWorkspaceGraphExecutor(
      { graphJson: 'dist/project-graph.json' },
      {
        summarizeGraph,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: true });
    expect(info).toHaveBeenCalledWith('Projects: 2\nDependencies: 1');
    expect(error).not.toHaveBeenCalled();
    expect(summarizeGraph).toHaveBeenCalledWith({
      graphJson: 'dist/project-graph.json',
    });
  });

  it('returns unsuccessful when graph loading fails', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const summarizeGraph = jest
      .fn()
      .mockRejectedValue(new Error('graph failed'));

    const result = await runWorkspaceGraphExecutor(
      {},
      {
        summarizeGraph,
        info,
        error,
      }
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith('graph failed');
    expect(info).not.toHaveBeenCalled();
  });
});
