import type { GovernanceGraphDocument } from '../../graph-document/contracts.js';
import { renderGovernanceGraphViewerHtml } from './viewer.js';

describe('governance graph viewer', () => {
  it('contains the embedded graph payload script', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      '<script id="governance-graph-data" type="application/json">'
    );
  });

  it('escapes less-than characters in embedded payload', () => {
    const rendered = renderGovernanceGraphViewerHtml(
      createGraphDocument({
        nodes: [
          {
            id: 'orders-<app>',
            label: 'orders-<app>',
            type: 'application',
            tags: [],
            health: 'warning',
            score: 70,
            badges: [],
            findings: [],
          },
        ],
      })
    );

    expect(rendered).toContain('\\u003capp>');
  });

  it('renders summary counts', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('<span>Nodes</span><strong>4</strong>');
    expect(rendered).toContain('<span>Edges</span><strong>3</strong>');
    expect(rendered).toContain('<span>Findings</span><strong>5</strong>');
    expect(rendered).toContain('<span>Critical nodes</span><strong>1</strong>');
  });

  it('renders an empty-state message when no nodes exist', () => {
    const rendered = renderGovernanceGraphViewerHtml(
      createGraphDocument({
        summary: {
          nodeCount: 0,
          edgeCount: 0,
          findingCount: 0,
          healthyNodeCount: 0,
          warningNodeCount: 0,
          criticalNodeCount: 0,
          unknownNodeCount: 0,
          healthyEdgeCount: 0,
          warningEdgeCount: 0,
          criticalEdgeCount: 0,
          unknownEdgeCount: 0,
        },
        nodes: [],
        edges: [],
      })
    );

    expect(rendered).toContain('No governance graph nodes available.');
    expect(rendered).toContain('No governance graph edges available.');
  });

  it('renders nodes with labels and stable data-node-id attributes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('data-node-id="orders-app"');
    expect(rendered).toContain('>Orders App<');
  });

  it('applies deterministic status classes to nodes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'class="governance-graph-node status-healthy" data-node-id="orders-app"'
    );
    expect(rendered).toContain(
      'class="governance-graph-node status-warning" data-node-id="shared-util"'
    );
    expect(rendered).toContain(
      'class="governance-graph-node status-critical" data-node-id="billing-ui"'
    );
    expect(rendered).toContain(
      'class="governance-graph-node status-unknown" data-node-id="legacy-tool"'
    );
  });

  it('renders edges with source/target relationships and stable data attributes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'data-edge-id="orders-app-&gt;shared-util-&gt;static"'
    );
    expect(rendered).toContain('data-source="orders-app"');
    expect(rendered).toContain('data-target="shared-util"');
    expect(rendered).toContain('Orders App');
    expect(rendered).toContain('Shared Util');
  });

  it('applies deterministic status classes to edges', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('class="governance-graph-edge status-warning"');
    expect(rendered).toContain('class="governance-graph-edge status-critical"');
    expect(rendered).toContain('class="governance-graph-edge status-unknown"');
  });

  it('renders ownership badges with kind and status classes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'class="governance-graph-badge badge-ownership status-healthy"'
    );
    expect(rendered).toContain('data-badge-id="ownership:present"');
    expect(rendered).toContain('>Owner<');
  });

  it('renders documentation badges with kind and status classes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'class="governance-graph-badge badge-documentation status-warning"'
    );
    expect(rendered).toContain('data-badge-id="documentation:missing"');
    expect(rendered).toContain('>Missing docs<');
  });

  it('escapes dynamic text in node labels, ids, badges, and edge labels', () => {
    const rendered = renderGovernanceGraphViewerHtml(
      createGraphDocument({
        nodes: [
          {
            id: '"unsafe-node"&<node>',
            label: '"unsafe-node"&<node>',
            type: 'application',
            tags: ['tag<unsafe>'],
            health: 'warning',
            score: 70,
            badges: [
              {
                id: 'documentation:<missing>',
                label: 'Docs <missing>',
                kind: 'documentation',
                status: 'warning',
                message: 'Missing "docs" <now>',
              },
            ],
            findings: [],
          },
        ],
        edges: [
          {
            id: 'edge<unsafe>',
            source: '"unsafe-node"&<node>',
            target: '"unsafe-node"&<node>',
            type: 'static<script>',
            health: 'warning',
            score: 70,
            findings: [],
          },
        ],
      })
    );

    expect(rendered).toContain('&quot;unsafe-node&quot;&amp;&lt;node&gt;');
    expect(rendered).toContain('Docs &lt;missing&gt;');
    expect(rendered).toContain('title="Missing &quot;docs&quot; &lt;now&gt;"');
    expect(rendered).toContain('static&lt;script&gt;');
  });

  it('is deterministic for the same graph document input', () => {
    const document = createGraphDocument();

    expect(renderGovernanceGraphViewerHtml(document)).toBe(
      renderGovernanceGraphViewerHtml(document)
    );
  });
});

function createGraphDocument(
  overrides: Partial<GovernanceGraphDocument> = {}
): GovernanceGraphDocument {
  return {
    schemaVersion: '1.0',
    workspace: {
      name: 'workspace',
      ...(overrides.workspace ?? {}),
    },
    summary: {
      nodeCount: 4,
      edgeCount: 3,
      findingCount: 5,
      healthyNodeCount: 1,
      warningNodeCount: 1,
      criticalNodeCount: 1,
      unknownNodeCount: 1,
      healthyEdgeCount: 0,
      warningEdgeCount: 1,
      criticalEdgeCount: 1,
      unknownEdgeCount: 1,
      ...(overrides.summary ?? {}),
    },
    nodes: overrides.nodes ?? [
      {
        id: 'orders-app',
        label: 'Orders App',
        type: 'application',
        tags: ['domain:orders', 'layer:app'],
        health: 'healthy',
        score: 100,
        badges: [
          {
            id: 'ownership:present',
            label: 'Owner',
            kind: 'ownership',
            status: 'healthy',
            message: 'Owner metadata is present.',
          },
          {
            id: 'documentation:present',
            label: 'Docs',
            kind: 'documentation',
            status: 'healthy',
            message: 'Documentation metadata is present.',
          },
        ],
        findings: [],
      },
      {
        id: 'shared-util',
        label: 'Shared Util',
        type: 'library',
        tags: ['domain:shared'],
        health: 'warning',
        score: 70,
        badges: [
          {
            id: 'ownership:present',
            label: 'Owner',
            kind: 'ownership',
            status: 'healthy',
            message: 'Owner metadata is present.',
          },
          {
            id: 'documentation:missing',
            label: 'Missing docs',
            kind: 'documentation',
            status: 'warning',
            message: 'Documentation metadata is missing.',
          },
        ],
        findings: [],
      },
      {
        id: 'billing-ui',
        label: 'Billing UI',
        type: 'library',
        tags: ['domain:billing'],
        health: 'critical',
        score: 40,
        badges: [
          {
            id: 'ownership:missing',
            label: 'Missing owner',
            kind: 'ownership',
            status: 'critical',
            message: 'No ownership metadata or CODEOWNERS mapping was found.',
          },
        ],
        findings: [],
      },
      {
        id: 'legacy-tool',
        label: 'Legacy Tool',
        type: 'tool',
        tags: ['domain:legacy'],
        health: 'unknown',
        score: 0,
        badges: [
          {
            id: 'documentation:unknown',
            label: 'Docs unknown',
            kind: 'documentation',
            status: 'unknown',
            message: 'Documentation requirements were not available.',
          },
        ],
        findings: [],
      },
    ],
    edges: overrides.edges ?? [
      {
        id: 'orders-app->shared-util->static',
        source: 'orders-app',
        target: 'shared-util',
        type: 'static',
        health: 'warning',
        score: 70,
        findings: [
          { id: 'f-1', source: 'signal', severity: 'warning', message: 'Warn' },
        ],
      },
      {
        id: 'billing-ui->shared-util->static',
        source: 'billing-ui',
        target: 'shared-util',
        type: 'static',
        health: 'critical',
        score: 40,
        findings: [
          { id: 'f-2', source: 'policy', severity: 'error', message: 'Error' },
        ],
      },
      {
        id: 'legacy-tool->orders-app->implicit',
        source: 'legacy-tool',
        target: 'orders-app',
        type: 'implicit',
        health: 'unknown',
        score: 0,
        findings: [],
      },
    ],
    facets: {
      health: ['critical', 'warning', 'unknown', 'healthy'],
      tags: ['domain:orders'],
      owners: ['@org/orders'],
      findingSources: ['policy', 'signal'],
      findingSeverities: ['error', 'warning'],
      ruleIds: [],
      ...(overrides.facets ?? {}),
    },
    ...overrides,
  };
}
