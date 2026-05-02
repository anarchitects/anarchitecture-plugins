import type {
  GovernanceGraphBadge,
  GovernanceGraphDocument,
  GovernanceGraphEdge,
  GovernanceGraphFinding,
  GovernanceGraphHealth,
  GovernanceGraphNode,
} from '../../graph-document/contracts.js';

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  critical: 3,
  unknown: 4,
  healthy: 5,
};

export interface GovernanceGraphViewerModel {
  filters: GovernanceGraphViewerFilters;
  nodes: GovernanceGraphViewerNodeModel[];
  edges: GovernanceGraphViewerEdgeModel[];
}

export interface GovernanceGraphViewerFilters {
  domains: string[];
  layers: string[];
  ownership: string[];
  documentation: string[];
  severities: string[];
  violationTypes: string[];
}

export interface GovernanceGraphViewerNodeModel {
  node: GovernanceGraphNode;
  domain: string;
  layer: string;
  ownership: string;
  documentation: string;
  severities: string[];
  violationTypes: string[];
}

export interface GovernanceGraphViewerEdgeModel {
  edge: GovernanceGraphEdge;
  sourceLabel: string;
  targetLabel: string;
  severities: string[];
  violationTypes: string[];
}

export function renderGovernanceGraphViewerHtml(
  graphDocument: GovernanceGraphDocument
): string {
  const model = buildGovernanceGraphViewerModel(graphDocument);
  const payload = `${JSON.stringify(graphDocument, null, 2).replace(
    /</g,
    '\\u003c'
  )}\n`;
  const workspaceName = graphDocument.workspace?.name
    ? `Workspace: ${escapeHtml(graphDocument.workspace.name)}`
    : 'Workspace: unknown';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Governance Graph</title>
    <style>
      :root {
        --governance-status-healthy: #18794e;
        --governance-status-warning: #b7791f;
        --governance-status-critical: #c53030;
        --governance-status-unknown: #5f6b7a;
        --governance-border: #d8dee6;
        --governance-surface: #ffffff;
        --governance-surface-muted: #f7f9fb;
        --governance-text: #17202a;
        --governance-text-muted: #536171;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--governance-text);
        background: #f3f6f9;
      }

      .governance-graph-shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 24px;
      }

      .governance-graph-header {
        margin-bottom: 24px;
      }

      .governance-graph-header h1 {
        margin: 0 0 6px;
        font-size: 28px;
      }

      .governance-graph-header p {
        margin: 0;
        color: var(--governance-text-muted);
      }

      .governance-graph-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }

      .governance-graph-summary article,
      .governance-graph-panel,
      .governance-graph-inspector {
        background: var(--governance-surface);
        border: 1px solid var(--governance-border);
        border-radius: 8px;
      }

      .governance-graph-summary article {
        padding: 12px 14px;
      }

      .governance-graph-summary span {
        display: block;
        color: var(--governance-text-muted);
        font-size: 13px;
      }

      .governance-graph-summary strong {
        display: block;
        margin-top: 4px;
        font-size: 20px;
      }

      .governance-graph-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .governance-graph-filter {
        display: grid;
        gap: 6px;
      }

      .governance-graph-filter span,
      .governance-graph-section-heading {
        font-size: 13px;
        font-weight: 600;
        color: var(--governance-text-muted);
      }

      .governance-graph-filter select,
      .governance-graph-reset-filters,
      .governance-graph-inspector-close,
      .governance-graph-node {
        font: inherit;
      }

      .governance-graph-filter select {
        min-height: 120px;
        padding: 10px 12px;
        border: 1px solid var(--governance-border);
        border-radius: 8px;
        background: var(--governance-surface);
      }

      .governance-graph-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .governance-graph-reset-filters,
      .governance-graph-inspector-close {
        border: 1px solid var(--governance-border);
        border-radius: 8px;
        background: var(--governance-surface);
        color: var(--governance-text);
        padding: 8px 12px;
        cursor: pointer;
      }

      .governance-graph-visible-counts {
        display: flex;
        gap: 16px;
        color: var(--governance-text-muted);
        font-size: 14px;
      }

      .governance-graph-empty-results {
        margin-bottom: 16px;
        padding: 12px 14px;
        border: 1px dashed var(--governance-border);
        border-radius: 8px;
        background: var(--governance-surface);
        color: var(--governance-text-muted);
      }

      .governance-graph-layout {
        display: grid;
        grid-template-columns: minmax(0, 2.1fr) minmax(320px, 1fr);
        gap: 16px;
        align-items: start;
      }

      .governance-graph-panel {
        padding: 16px;
      }

      .governance-graph-panel + .governance-graph-panel {
        margin-top: 16px;
      }

      .governance-graph-items {
        display: grid;
        gap: 12px;
      }

      .governance-graph-node {
        width: 100%;
        text-align: left;
        border: 1px solid var(--governance-border);
        border-left-width: 4px;
        border-radius: 8px;
        background: var(--governance-surface-muted);
        padding: 14px;
        cursor: pointer;
      }

      .governance-graph-node:hover,
      .governance-graph-node-selected {
        box-shadow: 0 0 0 2px rgba(23, 32, 42, 0.08);
      }

      .governance-graph-edge {
        border: 1px solid var(--governance-border);
        border-left-width: 4px;
        border-radius: 8px;
        background: var(--governance-surface-muted);
        padding: 14px;
      }

      .governance-graph-node h2,
      .governance-graph-edge h2 {
        margin: 0 0 6px;
        font-size: 17px;
      }

      .governance-graph-meta,
      .governance-graph-edge-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        color: var(--governance-text-muted);
        font-size: 13px;
      }

      .governance-graph-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .governance-graph-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        border: 1px solid currentColor;
      }

      .governance-graph-empty {
        margin: 0;
        color: var(--governance-text-muted);
      }

      .governance-graph-inspector {
        padding: 16px;
        position: sticky;
        top: 16px;
      }

      .governance-graph-inspector header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .governance-graph-inspector h2 {
        margin: 0;
        font-size: 20px;
      }

      .governance-graph-inspector-empty {
        color: var(--governance-text-muted);
      }

      .governance-graph-inspector-section + .governance-graph-inspector-section {
        margin-top: 16px;
      }

      .governance-graph-inspector-list,
      .governance-graph-inline-list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding-left: 18px;
      }

      .governance-graph-key-value {
        display: grid;
        grid-template-columns: minmax(88px, 120px) 1fr;
        gap: 8px 12px;
        margin: 0;
      }

      .governance-graph-key-value dt {
        color: var(--governance-text-muted);
      }

      .status-healthy {
        color: var(--governance-status-healthy);
      }

      .status-warning {
        color: var(--governance-status-warning);
      }

      .status-critical {
        color: var(--governance-status-critical);
      }

      .status-unknown {
        color: var(--governance-status-unknown);
      }

      @media (max-width: 1080px) {
        .governance-graph-layout {
          grid-template-columns: 1fr;
        }

        .governance-graph-inspector {
          position: static;
        }
      }
    </style>
  </head>
  <body>
    <div class="governance-graph-shell">
      <header class="governance-graph-header">
        <h1>Governance Graph</h1>
        <p>${workspaceName}</p>
      </header>

      <section class="governance-graph-summary">
        <article><span>Nodes</span><strong>${
          graphDocument.summary.nodeCount
        }</strong></article>
        <article><span>Edges</span><strong>${
          graphDocument.summary.edgeCount
        }</strong></article>
        <article><span>Findings</span><strong>${
          graphDocument.summary.findingCount
        }</strong></article>
        <article><span>Critical nodes</span><strong>${
          graphDocument.summary.criticalNodeCount
        }</strong></article>
        <article><span>Warning nodes</span><strong>${
          graphDocument.summary.warningNodeCount
        }</strong></article>
        <article><span>Healthy nodes</span><strong>${
          graphDocument.summary.healthyNodeCount
        }</strong></article>
        <article><span>Unknown nodes</span><strong>${
          graphDocument.summary.unknownNodeCount
        }</strong></article>
      </section>

      <section class="governance-graph-filters" aria-label="Governance graph filters">
        ${renderFilterControl(
          'governance-graph-filter-domain',
          'governance-graph-filter-domain',
          'Domain',
          model.filters.domains
        )}
        ${renderFilterControl(
          'governance-graph-filter-layer',
          'governance-graph-filter-layer',
          'Layer',
          model.filters.layers
        )}
        ${renderFilterControl(
          'governance-graph-filter-ownership',
          'governance-graph-filter-ownership',
          'Ownership',
          model.filters.ownership
        )}
        ${renderFilterControl(
          'governance-graph-filter-documentation',
          'governance-graph-filter-documentation',
          'Documentation',
          model.filters.documentation
        )}
        ${renderFilterControl(
          'governance-graph-filter-severity',
          'governance-graph-filter-severity',
          'Severity',
          model.filters.severities
        )}
        ${renderFilterControl(
          'governance-graph-filter-violation-type',
          'governance-graph-filter-violation-type',
          'Violation type',
          model.filters.violationTypes
        )}
      </section>

      <div class="governance-graph-toolbar">
        <div class="governance-graph-visible-counts" aria-live="polite">
          <span data-visible-nodes>Visible nodes: ${model.nodes.length}</span>
          <span data-visible-edges>Visible edges: ${model.edges.length}</span>
        </div>
        <button type="button" class="governance-graph-reset-filters">Reset filters</button>
      </div>

      <div class="governance-graph-empty-results" data-empty-results hidden>No nodes match the current filters.</div>

      <div class="governance-graph-layout">
        <main>
          <section class="governance-graph-panel">
            <div class="governance-graph-section-heading">Nodes</div>
            ${
              model.nodes.length > 0
                ? `<div class="governance-graph-items">${model.nodes
                    .map((nodeModel) => renderNode(nodeModel))
                    .join('')}</div>`
                : '<p class="governance-graph-empty">No governance graph nodes available.</p>'
            }
          </section>

          <section class="governance-graph-panel">
            <div class="governance-graph-section-heading">Edges</div>
            ${
              model.edges.length > 0
                ? `<div class="governance-graph-items">${model.edges
                    .map((edgeModel) => renderEdge(edgeModel))
                    .join('')}</div>`
                : '<p class="governance-graph-empty">No governance graph edges available.</p>'
            }
          </section>
        </main>

        <aside class="governance-graph-inspector" aria-live="polite">
          <header>
            <div>
              <h2>Node inspector</h2>
              <p class="governance-graph-inspector-empty" data-inspector-empty>Select a node to inspect its governance details.</p>
            </div>
            <button type="button" class="governance-graph-inspector-close" data-inspector-close hidden>Close</button>
          </header>
          <div data-inspector-content hidden></div>
        </aside>
      </div>
    </div>

    <script id="governance-graph-data" type="application/json">${payload}</script>
    <script>
      (function() {
        const payloadElement = document.getElementById('governance-graph-data');
        const graphDocument = JSON.parse(payloadElement && payloadElement.textContent ? payloadElement.textContent : '{}');
        const root = document.documentElement;
        const nodeElements = Array.from(document.querySelectorAll('[data-node-id]'));
        const edgeElements = Array.from(document.querySelectorAll('[data-edge-id]'));
        const emptyResultsElement = document.querySelector('[data-empty-results]');
        const visibleNodesElement = document.querySelector('[data-visible-nodes]');
        const visibleEdgesElement = document.querySelector('[data-visible-edges]');
        const inspectorEmptyElement = document.querySelector('[data-inspector-empty]');
        const inspectorContentElement = document.querySelector('[data-inspector-content]');
        const inspectorCloseElement = document.querySelector('[data-inspector-close]');
        const filterElements = {
          domain: document.getElementById('governance-graph-filter-domain'),
          layer: document.getElementById('governance-graph-filter-layer'),
          ownership: document.getElementById('governance-graph-filter-ownership'),
          documentation: document.getElementById('governance-graph-filter-documentation'),
          severity: document.getElementById('governance-graph-filter-severity'),
          violationType: document.getElementById('governance-graph-filter-violation-type')
        };

        const nodes = Array.isArray(graphDocument.nodes) ? graphDocument.nodes : [];
        const edges = Array.isArray(graphDocument.edges) ? graphDocument.edges : [];
        const nodeMap = new Map(nodes.map(function(node) { return [node.id, node]; }));
        const outgoingByNode = new Map();
        const incomingByNode = new Map();
        let selectedNodeId = null;

        edges.forEach(function(edge) {
          const outgoing = outgoingByNode.get(edge.source) || [];
          outgoing.push(edge);
          outgoingByNode.set(edge.source, outgoing);

          const incoming = incomingByNode.get(edge.target) || [];
          incoming.push(edge);
          incomingByNode.set(edge.target, incoming);
        });

        function readSelectedValues(element) {
          if (!element) {
            return new Set();
          }

          return new Set(Array.from(element.selectedOptions).map(function(option) {
            return option.value;
          }).filter(Boolean));
        }

        function splitList(value) {
          return String(value || '')
            .split(',')
            .map(function(entry) { return entry.trim(); })
            .filter(Boolean);
        }

        function intersects(selected, values) {
          if (selected.size === 0) {
            return true;
          }

          return values.some(function(value) {
            return selected.has(value);
          });
        }

        function createSection(title) {
          const section = document.createElement('section');
          section.className = 'governance-graph-inspector-section';
          const heading = document.createElement('h3');
          heading.className = 'governance-graph-section-heading';
          heading.textContent = title;
          section.appendChild(heading);
          return section;
        }

        function appendKeyValue(section, label, value) {
          const list = section.querySelector('dl') || document.createElement('dl');
          list.className = 'governance-graph-key-value';
          const term = document.createElement('dt');
          term.textContent = label;
          const description = document.createElement('dd');
          description.textContent = value;
          list.appendChild(term);
          list.appendChild(description);
          section.appendChild(list);
        }

        function appendList(section, items) {
          const list = document.createElement('ul');
          list.className = 'governance-graph-inspector-list';
          items.forEach(function(item) {
            const entry = document.createElement('li');
            entry.textContent = item;
            list.appendChild(entry);
          });
          section.appendChild(list);
        }

        function deriveDomain(node) {
          if (node && node.metadata && typeof node.metadata.domain === 'string' && node.metadata.domain) {
            return node.metadata.domain;
          }

          const tag = Array.isArray(node && node.tags)
            ? node.tags.find(function(candidate) { return candidate.indexOf('domain:') === 0; })
            : undefined;

          return tag ? tag.slice('domain:'.length) : 'unknown';
        }

        function deriveLayer(node) {
          if (node && node.metadata && typeof node.metadata.layer === 'string' && node.metadata.layer) {
            return node.metadata.layer;
          }

          const tag = Array.isArray(node && node.tags)
            ? node.tags.find(function(candidate) { return candidate.indexOf('layer:') === 0; })
            : undefined;

          return tag ? tag.slice('layer:'.length) : 'unknown';
        }

        function deriveDocumentation(node) {
          const badges = Array.isArray(node && node.badges) ? node.badges : [];
          const documentationBadge = badges.find(function(badge) {
            return badge.kind === 'documentation';
          });

          if (documentationBadge) {
            if (documentationBadge.id === 'documentation:missing') {
              return 'missing';
            }

            if (documentationBadge.id === 'documentation:unknown') {
              return 'unknown';
            }

            return 'present';
          }

          if (node && node.metadata && (node.metadata.documentation === true || node.metadata.documented === true)) {
            return 'present';
          }

          return 'unknown';
        }

        function renderInspector(nodeId) {
          const node = nodeMap.get(nodeId);
          if (!node || !inspectorContentElement || !inspectorEmptyElement || !inspectorCloseElement) {
            return;
          }

          selectedNodeId = nodeId;
          inspectorContentElement.replaceChildren();

          const identitySection = createSection('Identity');
          appendKeyValue(identitySection, 'Label', String(node.label || node.id));
          appendKeyValue(identitySection, 'Id', String(node.id));
          appendKeyValue(identitySection, 'Type', String(node.type || 'unknown'));
          appendKeyValue(identitySection, 'Domain', deriveDomain(node));
          appendKeyValue(identitySection, 'Layer', deriveLayer(node));
          appendKeyValue(identitySection, 'Owner', String(node.owner || 'unassigned'));
          appendKeyValue(identitySection, 'Status', String(node.health || 'unknown'));
          appendKeyValue(identitySection, 'Score', String(node.score == null ? 'n/a' : node.score));
          inspectorContentElement.appendChild(identitySection);

          const tags = Array.isArray(node.tags) ? node.tags : [];
          if (tags.length > 0) {
            const tagsSection = createSection('Tags');
            appendList(tagsSection, tags);
            inspectorContentElement.appendChild(tagsSection);
          }

          const badges = Array.isArray(node.badges) ? node.badges : [];
          if (badges.length > 0) {
            const badgesSection = createSection('Badges');
            appendList(
              badgesSection,
              badges.map(function(badge) {
                return badge.label + ' [' + badge.status + ']' + (badge.message ? ': ' + badge.message : '');
              })
            );
            inspectorContentElement.appendChild(badgesSection);
          }

          if (node.metadata && Object.keys(node.metadata).length > 0) {
            const scoreBreakdownSection = createSection('Score breakdown');
            const scoreKeys = Object.entries(node.metadata).map(function(entry) {
              return entry[0] + ': ' + String(entry[1]);
            });
            appendList(scoreBreakdownSection, scoreKeys);
            inspectorContentElement.appendChild(scoreBreakdownSection);
          }

          const findings = Array.isArray(node.findings) ? node.findings : [];
          const findingsSection = createSection('Violations');
          if (findings.length > 0) {
            appendList(
              findingsSection,
              findings.map(function(finding) {
                return [
                  finding.severity || 'unknown',
                  finding.source || 'signal',
                  finding.ruleId || finding.category || finding.type || finding.id,
                  finding.message || ''
                ].filter(Boolean).join(' | ');
              })
            );
          } else {
            appendList(findingsSection, ['No violations attached to this node.']);
          }
          inspectorContentElement.appendChild(findingsSection);

          const dependencies = outgoingByNode.get(nodeId) || [];
          const dependenciesSection = createSection('Dependencies');
          appendList(
            dependenciesSection,
            dependencies.length > 0
              ? dependencies.map(function(edge) {
                  const target = nodeMap.get(edge.target);
                  return (target && target.label ? target.label : edge.target) + ' [' + (edge.health || 'unknown') + ']';
                })
              : ['No outgoing dependencies.']
          );
          inspectorContentElement.appendChild(dependenciesSection);

          const dependents = incomingByNode.get(nodeId) || [];
          const dependentsSection = createSection('Dependents');
          appendList(
            dependentsSection,
            dependents.length > 0
              ? dependents.map(function(edge) {
                  const source = nodeMap.get(edge.source);
                  return (source && source.label ? source.label : edge.source) + ' [' + (edge.health || 'unknown') + ']';
                })
              : ['No incoming dependents.']
          );
          inspectorContentElement.appendChild(dependentsSection);

          inspectorEmptyElement.hidden = true;
          inspectorCloseElement.hidden = false;
          inspectorContentElement.hidden = false;
        }

        function closeInspector() {
          selectedNodeId = null;
          nodeElements.forEach(function(element) {
            element.classList.remove('governance-graph-node-selected');
          });

          if (inspectorContentElement) {
            inspectorContentElement.hidden = true;
            inspectorContentElement.replaceChildren();
          }

          if (inspectorEmptyElement) {
            inspectorEmptyElement.hidden = false;
          }

          if (inspectorCloseElement) {
            inspectorCloseElement.hidden = true;
          }
        }

        function nodeMatchesFilters(element, selections) {
          return (
            intersects(selections.domain, [element.dataset.domain || 'unknown']) &&
            intersects(selections.layer, [element.dataset.layer || 'unknown']) &&
            intersects(selections.ownership, [element.dataset.owner || 'unknown']) &&
            intersects(selections.documentation, [element.dataset.documentation || 'unknown']) &&
            intersects(selections.severity, splitList(element.dataset.severities || element.dataset.status || 'unknown')) &&
            intersects(selections.violationType, splitList(element.dataset.violationTypes || 'none'))
          );
        }

        function applyFilters() {
          const selections = {
            domain: readSelectedValues(filterElements.domain),
            layer: readSelectedValues(filterElements.layer),
            ownership: readSelectedValues(filterElements.ownership),
            documentation: readSelectedValues(filterElements.documentation),
            severity: readSelectedValues(filterElements.severity),
            violationType: readSelectedValues(filterElements.violationType)
          };

          const visibleNodeIds = new Set();

          nodeElements.forEach(function(element) {
            const visible = nodeMatchesFilters(element, selections);
            element.hidden = !visible;
            if (visible && element.dataset.nodeId) {
              visibleNodeIds.add(element.dataset.nodeId);
            }
          });

          edgeElements.forEach(function(element) {
            const visible =
              !!element.dataset.source &&
              !!element.dataset.target &&
              visibleNodeIds.has(element.dataset.source) &&
              visibleNodeIds.has(element.dataset.target);
            element.hidden = !visible;
          });

          const visibleNodeCount = visibleNodeIds.size;
          const visibleEdgeCount = edgeElements.filter(function(element) {
            return !element.hidden;
          }).length;

          if (visibleNodesElement) {
            visibleNodesElement.textContent = 'Visible nodes: ' + String(visibleNodeCount);
          }

          if (visibleEdgesElement) {
            visibleEdgesElement.textContent = 'Visible edges: ' + String(visibleEdgeCount);
          }

          if (emptyResultsElement) {
            emptyResultsElement.hidden = visibleNodeCount !== 0;
          }

          if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
            closeInspector();
          }
        }

        function resetFilters() {
          Object.values(filterElements).forEach(function(element) {
            if (!element) {
              return;
            }

            Array.from(element.options).forEach(function(option) {
              option.selected = false;
            });
          });

          applyFilters();
        }

        nodeElements.forEach(function(element) {
          element.addEventListener('click', function() {
            const nodeId = element.dataset.nodeId;
            if (!nodeId) {
              return;
            }

            nodeElements.forEach(function(candidate) {
              candidate.classList.toggle('governance-graph-node-selected', candidate === element);
            });
            renderInspector(nodeId);
          });
        });

        Object.values(filterElements).forEach(function(element) {
          if (element) {
            element.addEventListener('change', applyFilters);
          }
        });

        const resetButton = document.querySelector('.governance-graph-reset-filters');
        if (resetButton) {
          resetButton.addEventListener('click', resetFilters);
        }

        if (inspectorCloseElement) {
          inspectorCloseElement.addEventListener('click', closeInspector);
        }

        root.dataset.governanceGraphViewer = 'ready';
        applyFilters();
      })();
    </script>
  </body>
</html>
`;
}

export function buildGovernanceGraphViewerModel(
  graphDocument: GovernanceGraphDocument
): GovernanceGraphViewerModel {
  const labelById = new Map(
    graphDocument.nodes.map((node) => [node.id, node.label] as const)
  );
  const nodeModels = graphDocument.nodes.map((node) => buildNodeModel(node));
  const edgeModels = graphDocument.edges.map((edge) =>
    buildEdgeModel(edge, labelById)
  );

  return {
    filters: {
      domains: collectFilterValues(nodeModels.map((node) => node.domain)),
      layers: collectFilterValues(nodeModels.map((node) => node.layer)),
      ownership: collectFilterValues(
        nodeModels.map((node) => node.ownership),
        compareText
      ),
      documentation: collectFilterValues(
        nodeModels.map((node) => node.documentation),
        compareText
      ),
      severities: collectFilterValues(
        [
          ...nodeModels.flatMap((node) => node.severities),
          ...edgeModels.flatMap((edge) => edge.severities),
        ],
        compareSeverity
      ),
      violationTypes: collectFilterValues(
        [
          ...nodeModels.flatMap((node) => node.violationTypes),
          ...edgeModels.flatMap((edge) => edge.violationTypes),
        ],
        compareText
      ),
    },
    nodes: nodeModels,
    edges: edgeModels,
  };
}

function buildNodeModel(
  node: GovernanceGraphNode
): GovernanceGraphViewerNodeModel {
  return {
    node,
    domain: deriveDomain(node),
    layer: deriveLayer(node),
    ownership: deriveOwnership(node),
    documentation: deriveDocumentation(node),
    severities: deriveSeverities(node.findings, node.health),
    violationTypes: deriveViolationTypes(node.findings),
  };
}

function buildEdgeModel(
  edge: GovernanceGraphEdge,
  labelById: Map<string, string>
): GovernanceGraphViewerEdgeModel {
  return {
    edge,
    sourceLabel: labelById.get(edge.source) ?? edge.source,
    targetLabel: labelById.get(edge.target) ?? edge.target,
    severities: deriveSeverities(edge.findings, edge.health),
    violationTypes: deriveViolationTypes(edge.findings),
  };
}

function renderFilterControl(
  className: string,
  id: string,
  label: string,
  values: string[]
): string {
  return `<label class="governance-graph-filter ${className}" for="${id}">
  <span>${escapeHtml(label)}</span>
  <select id="${id}" multiple size="${Math.max(
    3,
    Math.min(8, values.length || 3)
  )}">
    ${values
      .map(
        (value) =>
          `<option value="${escapeAttribute(value)}">${escapeHtml(
            value
          )}</option>`
      )
      .join('')}
  </select>
</label>`;
}

function renderNode(nodeModel: GovernanceGraphViewerNodeModel): string {
  const { node } = nodeModel;

  return `<button type="button" class="governance-graph-node status-${
    node.health
  }" data-node-id="${escapeAttribute(node.id)}" data-domain="${escapeAttribute(
    nodeModel.domain
  )}" data-layer="${escapeAttribute(
    nodeModel.layer
  )}" data-owner="${escapeAttribute(
    nodeModel.ownership
  )}" data-documentation="${escapeAttribute(
    nodeModel.documentation
  )}" data-status="${escapeAttribute(
    node.health
  )}" data-severities="${escapeAttribute(
    nodeModel.severities.join(',')
  )}" data-violation-types="${escapeAttribute(
    nodeModel.violationTypes.join(',')
  )}">
  <h2>${escapeHtml(node.label)}</h2>
  <div class="governance-graph-meta">
    <span>${escapeHtml(node.id)}</span>
    <span>${escapeHtml(node.type)}</span>
    <span>Domain: ${escapeHtml(nodeModel.domain)}</span>
    <span>Layer: ${escapeHtml(nodeModel.layer)}</span>
    <span>Owner: ${escapeHtml(node.owner ?? 'unassigned')}</span>
    <span>Score: ${escapeHtml(
      node.score == null ? 'n/a' : String(node.score)
    )}</span>
    <span>Findings: ${node.findings.length}</span>
  </div>
  ${
    node.tags.length > 0
      ? `<div class="governance-graph-meta">${node.tags
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join('')}</div>`
      : ''
  }
  ${
    node.badges.length > 0
      ? `<div class="governance-graph-badges">${node.badges
          .map((badge) => renderBadge(badge))
          .join('')}</div>`
      : ''
  }
</button>`;
}

function renderEdge(edgeModel: GovernanceGraphViewerEdgeModel): string {
  const { edge } = edgeModel;

  return `<article class="governance-graph-edge status-${
    edge.health
  }" data-edge-id="${escapeAttribute(edge.id)}" data-source="${escapeAttribute(
    edge.source
  )}" data-target="${escapeAttribute(
    edge.target
  )}" data-status="${escapeAttribute(
    edge.health
  )}" data-severities="${escapeAttribute(
    edgeModel.severities.join(',')
  )}" data-violation-types="${escapeAttribute(
    edgeModel.violationTypes.join(',')
  )}">
  <h2>${escapeHtml(edgeModel.sourceLabel)} → ${escapeHtml(
    edgeModel.targetLabel
  )}</h2>
  <div class="governance-graph-edge-meta">
    <span>${escapeHtml(edge.source)}</span>
    <span>${escapeHtml(edge.target)}</span>
    <span>${escapeHtml(edge.type)}</span>
    <span>Score: ${escapeHtml(
      edge.score == null ? 'n/a' : String(edge.score)
    )}</span>
    <span>Findings: ${edge.findings.length}</span>
  </div>
</article>`;
}

function renderBadge(badge: GovernanceGraphBadge): string {
  return `<span class="governance-graph-badge badge-${escapeAttribute(
    badge.kind
  )} status-${escapeAttribute(badge.status)}" data-badge-id="${escapeAttribute(
    badge.id
  )}" data-badge-kind="${escapeAttribute(badge.kind)}"${
    badge.message ? ` title="${escapeAttribute(badge.message)}"` : ''
  }>${escapeHtml(badge.label)}</span>`;
}

function deriveDomain(node: GovernanceGraphNode): string {
  return (
    readMetadataText(node.metadata?.domain) ??
    readTagValue(node, 'domain') ??
    'unknown'
  );
}

function deriveLayer(node: GovernanceGraphNode): string {
  return (
    readMetadataText(node.metadata?.layer) ??
    readTagValue(node, 'layer') ??
    'unknown'
  );
}

function deriveOwnership(node: GovernanceGraphNode): string {
  if (node.owner) {
    return node.owner;
  }

  const ownershipBadge = node.badges.find(
    (badge) => badge.kind === 'ownership'
  );

  if (ownershipBadge?.id === 'ownership:missing') {
    return 'missing';
  }

  if (ownershipBadge?.id === 'ownership:unknown') {
    return 'unknown';
  }

  return 'unknown';
}

function deriveDocumentation(node: GovernanceGraphNode): string {
  const documentationBadge = node.badges.find(
    (badge) => badge.kind === 'documentation'
  );

  if (documentationBadge?.id === 'documentation:missing') {
    return 'missing';
  }

  if (documentationBadge?.id === 'documentation:unknown') {
    return 'unknown';
  }

  if (
    documentationBadge?.id === 'documentation:present' ||
    node.metadata?.documentation === true ||
    node.metadata?.documented === true
  ) {
    return 'present';
  }

  return 'unknown';
}

function deriveSeverities(
  findings: GovernanceGraphFinding[],
  health: GovernanceGraphHealth
): string[] {
  const severities = collectFilterValues(
    findings.map((finding) => finding.severity),
    compareSeverity
  );
  return severities.length > 0 ? severities : [health];
}

function deriveViolationTypes(findings: GovernanceGraphFinding[]): string[] {
  return collectFilterValues(
    findings.flatMap((finding) => [
      finding.type,
      finding.category,
      finding.ruleId,
      finding.source,
    ]),
    compareText
  );
}

function readMetadataText(
  value: string | number | boolean | null | undefined
): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readTagValue(
  node: GovernanceGraphNode,
  prefix: 'domain' | 'layer'
): string | undefined {
  return node.tags
    .find((tag) => tag.startsWith(`${prefix}:`))
    ?.slice(prefix.length + 1);
}

function collectFilterValues(
  values: Array<string | undefined>,
  comparator: (left: string, right: string) => number = compareText
): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort(comparator);
}

function compareSeverity(left: string, right: string): number {
  return (
    (SEVERITY_ORDER[left] ?? Number.MAX_SAFE_INTEGER) -
      (SEVERITY_ORDER[right] ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right)
  );
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
