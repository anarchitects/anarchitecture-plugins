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
      renderWorkspaceGraphSummary({
        nodeCount: 4,
        relationCount: 9,
        dependencyRelationCount: 9,
      })
    ).toBe('Nodes: 4\nRelations: 9\nDependency Relations: 9');
  });

  it('prints canonical node and relation counts from the host composition summary', async () => {
    const info = jest.fn();
    const error = jest.fn();
    const summarizeGraph = jest.fn().mockResolvedValue({
      summary: { nodeCount: 2, relationCount: 1, dependencyRelationCount: 1 },
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
    expect(info).toHaveBeenCalledWith(
      'Nodes: 2\nRelations: 1\nDependency Relations: 1'
    );
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
