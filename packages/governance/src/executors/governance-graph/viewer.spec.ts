import type { GovernanceGraphDocument } from '../../graph-document/contracts.js';
import {
  buildGovernanceGraphViewerModel,
  renderGovernanceGraphViewerHtml,
} from './viewer.js';

describe('governance graph viewer', () => {
  it('contains filter controls for the planned MVP facets', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-domain"'
    );
    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-layer"'
    );
    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-ownership"'
    );
    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-documentation"'
    );
    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-severity"'
    );
    expect(rendered).toContain(
      'class="governance-graph-filter governance-graph-filter-violation-type"'
    );
  });

  it('contains a reset control, visible counts region, and node inspector region', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('class="governance-graph-reset-filters"');
    expect(rendered).toContain('class="governance-graph-visible-counts"');
    expect(rendered).toContain('class="governance-graph-inspector"');
    expect(rendered).toContain('class="governance-graph-inspector-empty"');
  });

  it('contains the embedded graph payload script and escapes less-than characters', () => {
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

    expect(rendered).toContain(
      '<script id="governance-graph-data" type="application/json">'
    );
    expect(rendered).toContain('\\u003capp>');
  });

  it('renders summary counts and visible counts', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('<span>Nodes</span><strong>4</strong>');
    expect(rendered).toContain('<span>Edges</span><strong>3</strong>');
    expect(rendered).toContain('<span>Findings</span><strong>5</strong>');
    expect(rendered).toContain('<span>Critical nodes</span><strong>1</strong>');
    expect(rendered).toContain('Visible nodes: 4');
    expect(rendered).toContain('Visible edges: 3');
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

  it('renders nodes with stable filter data attributes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('data-node-id="orders-app"');
    expect(rendered).toContain('data-domain="orders"');
    expect(rendered).toContain('data-layer="app"');
    expect(rendered).toContain('data-owner="@org/orders"');
    expect(rendered).toContain('data-documentation="present"');
    expect(rendered).toContain('data-severities="healthy"');
    expect(rendered).toContain('data-violation-types=""');
  });

  it('renders edges with stable source and target data attributes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'data-edge-id="orders-app-&gt;shared-util-&gt;static"'
    );
    expect(rendered).toContain('data-source="orders-app"');
    expect(rendered).toContain('data-target="shared-util"');
  });

  it('applies deterministic status classes to nodes and edges', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('class="governance-graph-node status-healthy"');
    expect(rendered).toContain('class="governance-graph-node status-warning"');
    expect(rendered).toContain('class="governance-graph-node status-critical"');
    expect(rendered).toContain('class="governance-graph-node status-unknown"');
    expect(rendered).toContain('class="governance-graph-edge status-warning"');
    expect(rendered).toContain('class="governance-graph-edge status-critical"');
    expect(rendered).toContain('class="governance-graph-edge status-unknown"');
  });

  it('renders ownership and documentation badges with deterministic classes', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain(
      'class="governance-graph-badge badge-ownership status-healthy"'
    );
    expect(rendered).toContain(
      'class="governance-graph-badge badge-documentation status-warning"'
    );
    expect(rendered).toContain('data-badge-id="ownership:present"');
    expect(rendered).toContain('data-badge-id="documentation:missing"');
  });

  it('derives domain and layer from metadata before tags', () => {
    const model = buildGovernanceGraphViewerModel(
      createGraphDocument({
        nodes: [
          {
            id: 'checkout-ui',
            label: 'Checkout UI',
            type: 'application',
            tags: ['domain:orders', 'layer:web'],
            owner: '@org/checkout',
            health: 'healthy',
            score: 100,
            badges: [],
            findings: [],
            metadata: {
              domain: 'commerce',
              layer: 'frontend',
            },
          },
        ],
        edges: [],
      })
    );

    expect(model.nodes[0]).toMatchObject({
      domain: 'commerce',
      layer: 'frontend',
    });
  });

  it('derives ownership and documentation filters from badges and metadata', () => {
    const model = buildGovernanceGraphViewerModel(createGraphDocument());

    expect(model.filters.ownership).toEqual([
      '@org/orders',
      'missing',
      'unknown',
    ]);
    expect(model.filters.documentation).toEqual([
      'missing',
      'present',
      'unknown',
    ]);
  });

  it('derives severity and violation type filters deterministically', () => {
    const model = buildGovernanceGraphViewerModel(createGraphDocument());

    expect(model.filters.severities).toEqual([
      'error',
      'warning',
      'info',
      'unknown',
      'healthy',
    ]);
    expect(model.filters.violationTypes).toEqual([
      'boundary',
      'docs-stale',
      'documentation',
      'missing-domain-context',
      'ownership',
      'ownership-gap',
      'policy',
      'signal',
    ]);
  });

  it('keeps graph payload data traceable for dependencies and dependents', () => {
    const model = buildGovernanceGraphViewerModel(createGraphDocument());

    expect(model.edges).toEqual([
      expect.objectContaining({
        edge: expect.objectContaining({
          source: 'orders-app',
          target: 'shared-util',
        }),
        sourceLabel: 'Orders App',
        targetLabel: 'Shared Util',
      }),
      expect.any(Object),
      expect.any(Object),
    ]);
  });

  it('includes script hooks for filtering, reset, and node inspection', () => {
    const rendered = renderGovernanceGraphViewerHtml(createGraphDocument());

    expect(rendered).toContain('function applyFilters()');
    expect(rendered).toContain('function resetFilters()');
    expect(rendered).toContain('function renderInspector(nodeId)');
    expect(rendered).toContain('governance-graph-node-selected');
    expect(rendered).toContain('Score breakdown');
    expect(rendered).toContain('Dependencies');
    expect(rendered).toContain('Dependents');
    expect(rendered).toContain('Violations');
  });

  it('escapes dynamic text in labels, ids, attributes, badges, and edge labels', () => {
    const rendered = renderGovernanceGraphViewerHtml(
      createGraphDocument({
        nodes: [
          {
            id: '"unsafe-node"&<node>',
            label: '"unsafe-node"&<node>',
            type: 'application',
            tags: ['domain:<unsafe>', 'layer:"unsafe"'],
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
    expect(rendered).toContain('data-domain="&lt;unsafe&gt;"');
    expect(rendered).toContain('data-layer="&quot;unsafe&quot;"');
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
        owner: '@org/orders',
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
        tags: ['domain:shared', 'layer:shared'],
        owner: '@org/orders',
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
        findings: [
          {
            id: 'signal-missing-domain',
            source: 'signal',
            severity: 'warning',
            message: 'Shared util is missing domain context.',
            projectId: 'shared-util',
            category: 'boundary',
            type: 'missing-domain-context',
          },
          {
            id: 'violation-docs',
            source: 'policy',
            severity: 'warning',
            message: 'Shared util docs are stale.',
            ruleId: 'docs-stale',
            projectId: 'shared-util',
            category: 'documentation',
          },
          {
            id: 'signal-ownership',
            source: 'signal',
            severity: 'info',
            message: 'Ownership coverage signal.',
            projectId: 'shared-util',
            category: 'ownership',
            type: 'ownership-gap',
          },
        ],
        metadata: {
          score: 10,
          documented: true,
        },
      },
      {
        id: 'billing-ui',
        label: 'Billing UI',
        type: 'library',
        tags: ['domain:billing', 'layer:ui'],
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
        findings: [
          {
            id: 'policy-boundary',
            source: 'policy',
            severity: 'error',
            message: 'Boundary breach.',
            category: 'policy',
          },
        ],
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
          {
            id: 'f-2',
            source: 'policy',
            severity: 'error',
            message: 'Error',
            category: 'policy',
          },
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
