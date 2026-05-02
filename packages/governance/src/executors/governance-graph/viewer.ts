import type {
  GovernanceGraphBadge,
  GovernanceGraphDocument,
  GovernanceGraphEdge,
  GovernanceGraphNode,
} from '../../graph-document/contracts.js';

export function renderGovernanceGraphViewerHtml(
  graphDocument: GovernanceGraphDocument
): string {
  const payload = JSON.stringify(graphDocument, null, 2).replace(
    /</g,
    '\\u003c'
  );
  const nodeLabels = new Map(
    graphDocument.nodes.map((node) => [node.id, node.label] as const)
  );

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>Governance Graph</title>',
    '  <style>',
    '    :root {',
    '      color-scheme: light;',
    '      font-family: Inter, system-ui, sans-serif;',
    '      --governance-status-healthy: #15803d;',
    '      --governance-status-warning: #b45309;',
    '      --governance-status-critical: #b91c1c;',
    '      --governance-status-unknown: #475569;',
    '      --governance-bg: #f8fafc;',
    '      --governance-surface: #ffffff;',
    '      --governance-border: #cbd5e1;',
    '      --governance-muted: #475569;',
    '      --governance-text: #0f172a;',
    '    }',
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; padding: 32px; background: var(--governance-bg); color: var(--governance-text); }',
    '    main { max-width: 1200px; margin: 0 auto; }',
    '    h1, h2, h3, p { margin-top: 0; }',
    '    h1 { margin-bottom: 8px; font-size: 28px; }',
    '    p { color: var(--governance-muted); }',
    '    .governance-graph-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }',
    '    .governance-graph-metric { background: var(--governance-surface); border: 1px solid var(--governance-border); border-radius: 8px; padding: 16px; }',
    '    .governance-graph-metric strong { display: block; font-size: 22px; color: var(--governance-text); }',
    '    .governance-graph-viewer { display: grid; gap: 16px; }',
    '    .governance-graph-section { background: var(--governance-surface); border: 1px solid var(--governance-border); border-radius: 8px; padding: 16px; }',
    '    .governance-graph-nodes, .governance-graph-edges { display: grid; gap: 12px; }',
    '    .governance-graph-node, .governance-graph-edge { border: 1px solid var(--governance-border); border-left-width: 6px; border-radius: 8px; padding: 16px; background: rgba(255, 255, 255, 0.88); }',
    '    .governance-graph-node header, .governance-graph-edge header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }',
    '    .governance-graph-label { font-weight: 600; }',
    '    .governance-graph-meta, .governance-graph-edge-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 14px; color: var(--governance-muted); }',
    '    .governance-graph-score { font-weight: 600; font-size: 14px; color: var(--governance-text); }',
    '    .governance-graph-badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }',
    '    .governance-graph-badge { display: inline-flex; align-items: center; gap: 6px; border: 1px solid currentColor; border-radius: 999px; padding: 4px 10px; font-size: 12px; background: rgba(255, 255, 255, 0.92); }',
    '    .governance-graph-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }',
    '    .governance-graph-tag { border-radius: 999px; background: #e2e8f0; color: #334155; padding: 4px 8px; font-size: 12px; }',
    '    .governance-graph-empty { margin: 0; padding: 24px; border: 1px dashed var(--governance-border); border-radius: 8px; background: #ffffff; color: var(--governance-muted); }',
    '    .governance-graph-edge-route { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-weight: 600; margin-bottom: 8px; }',
    '    .status-healthy { color: var(--governance-status-healthy); }',
    '    .status-warning { color: var(--governance-status-warning); }',
    '    .status-critical { color: var(--governance-status-critical); }',
    '    .status-unknown { color: var(--governance-status-unknown); }',
    '    .badge-ownership, .badge-documentation, .badge-policy, .badge-conformance, .badge-metric, .badge-signal { text-transform: none; }',
    '    @media (max-width: 900px) { .governance-graph-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }',
    '    @media (max-width: 640px) { body { padding: 16px; } .governance-graph-summary { grid-template-columns: 1fr; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="governance-graph-root" data-payload-loaded="false">',
    '    <h1>Governance Graph</h1>',
    `    <p>Workspace: ${escapeHtml(
      graphDocument.workspace?.name ?? 'workspace'
    )}</p>`,
    '    <section class="governance-graph-summary" aria-label="Graph summary">',
    renderSummaryMetric('Nodes', graphDocument.summary.nodeCount),
    renderSummaryMetric('Edges', graphDocument.summary.edgeCount),
    renderSummaryMetric('Findings', graphDocument.summary.findingCount),
    renderSummaryMetric(
      'Critical nodes',
      graphDocument.summary.criticalNodeCount
    ),
    renderSummaryMetric(
      'Warning nodes',
      graphDocument.summary.warningNodeCount
    ),
    renderSummaryMetric(
      'Healthy nodes',
      graphDocument.summary.healthyNodeCount
    ),
    renderSummaryMetric(
      'Critical edges',
      graphDocument.summary.criticalEdgeCount
    ),
    renderSummaryMetric(
      'Unknown nodes',
      graphDocument.summary.unknownNodeCount
    ),
    '    </section>',
    '    <section class="governance-graph-viewer">',
    '      <section class="governance-graph-section" aria-labelledby="governance-graph-nodes-heading">',
    '        <h2 id="governance-graph-nodes-heading">Nodes</h2>',
    graphDocument.nodes.length > 0
      ? [
          '        <div class="governance-graph-nodes">',
          ...graphDocument.nodes.map((node) => renderNode(node)),
          '        </div>',
        ].join('\n')
      : '        <p class="governance-graph-empty">No governance graph nodes available.</p>',
    '      </section>',
    '      <section class="governance-graph-section" aria-labelledby="governance-graph-edges-heading">',
    '        <h2 id="governance-graph-edges-heading">Edges</h2>',
    graphDocument.edges.length > 0
      ? [
          '        <div class="governance-graph-edges">',
          ...graphDocument.edges.map((edge) => renderEdge(edge, nodeLabels)),
          '        </div>',
        ].join('\n')
      : '        <p class="governance-graph-empty">No governance graph edges available.</p>',
    '      </section>',
    '    </section>',
    '    <script id="governance-graph-data" type="application/json">',
    payload,
    '    </script>',
    '    <script>',
    '      const root = document.querySelector(".governance-graph-root");',
    '      const payloadElement = document.getElementById("governance-graph-data");',
    '      if (root && payloadElement) {',
    '        JSON.parse(payloadElement.textContent || "{}");',
    '        root.setAttribute("data-payload-loaded", "true");',
    '      }',
    '    </script>',
    '  </main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function renderSummaryMetric(label: string, value: number): string {
  return `      <div class="governance-graph-metric"><span>${escapeHtml(
    label
  )}</span><strong>${value}</strong></div>`;
}

function renderNode(node: GovernanceGraphNode): string {
  return [
    `          <article class="governance-graph-node status-${
      node.health
    }" data-node-id="${escapeHtmlAttribute(
      node.id
    )}" data-node-health="${escapeHtmlAttribute(node.health)}">`,
    '            <header>',
    `              <div><div class="governance-graph-label">${escapeHtml(
      node.label
    )}</div><div class="governance-graph-meta"><code>${escapeHtml(
      node.id
    )}</code><span>${escapeHtml(node.type)}</span><span>Findings: ${
      node.findings.length
    }</span></div></div>`,
    node.score !== undefined
      ? `              <span class="governance-graph-score">${node.score}/100</span>`
      : '              <span class="governance-graph-score">n/a</span>',
    '            </header>',
    node.badges.length > 0
      ? [
          '            <div class="governance-graph-badges">',
          ...node.badges.map((badge) => renderBadge(badge)),
          '            </div>',
        ].join('\n')
      : '            <div class="governance-graph-badges"></div>',
    node.tags.length > 0
      ? [
          '            <ul class="governance-graph-tags">',
          ...node.tags.map(
            (tag) =>
              `              <li class="governance-graph-tag">${escapeHtml(
                tag
              )}</li>`
          ),
          '            </ul>',
        ].join('\n')
      : '',
    '          </article>',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderEdge(
  edge: GovernanceGraphEdge,
  nodeLabels: Map<string, string>
): string {
  const sourceLabel = nodeLabels.get(edge.source) ?? edge.source;
  const targetLabel = nodeLabels.get(edge.target) ?? edge.target;

  return [
    `          <article class="governance-graph-edge status-${
      edge.health
    }" data-edge-id="${escapeHtmlAttribute(
      edge.id
    )}" data-source="${escapeHtmlAttribute(
      edge.source
    )}" data-target="${escapeHtmlAttribute(
      edge.target
    )}" data-edge-health="${escapeHtmlAttribute(edge.health)}">`,
    '            <header>',
    `              <div class="governance-graph-edge-route"><span>${escapeHtml(
      sourceLabel
    )}</span><span aria-hidden="true">→</span><span>${escapeHtml(
      targetLabel
    )}</span></div>`,
    edge.score !== undefined
      ? `              <span class="governance-graph-score">${edge.score}/100</span>`
      : '              <span class="governance-graph-score">n/a</span>',
    '            </header>',
    `            <div class="governance-graph-edge-meta"><span>${escapeHtml(
      edge.type
    )}</span><span>Status: ${escapeHtml(edge.health)}</span><span>Findings: ${
      edge.findings.length
    }</span></div>`,
    '          </article>',
  ].join('\n');
}

function renderBadge(badge: GovernanceGraphBadge): string {
  const titleAttribute = badge.message
    ? ` title="${escapeHtmlAttribute(badge.message)}"`
    : '';

  return `              <span class="governance-graph-badge badge-${escapeHtmlAttribute(
    badge.kind
  )} status-${escapeHtmlAttribute(
    badge.status
  )}" data-badge-id="${escapeHtmlAttribute(
    badge.id
  )}" data-badge-kind="${escapeHtmlAttribute(
    badge.kind
  )}"${titleAttribute}>${escapeHtml(badge.label)}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}
