import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const UNKNOWN_PROJECT_TYPE = 'unknown';
const UNKNOWN_DEPENDENCY_TYPE = 'unknown';

export interface GovernedProject {
  id: string;
  name: string;
  root?: string;
  type: 'application' | 'library' | 'unknown';
  tags: string[];
  domain?: string;
  layer?: string;
  workspaceId?: string;
}

export interface WorkspaceGraphSnapshot {
  workspaceId?: string;
  projects: GovernedProject[];
  dependencies: GovernedDependency[];
  extractedAt: string;
  source: 'nx-graph';
}

export interface GovernedDependency {
  sourceProjectId: string;
  targetProjectId: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
  workspaceId?: string;
}

export interface GraphSummary {
  projectCount: number;
  dependencyCount: number;
}

export interface GraphAdapterOptions {
  graphJson?: string;
}

export class GraphAdapter {
  async readSnapshot(
    options: GraphAdapterOptions = {}
  ): Promise<WorkspaceGraphSnapshot> {
    try {
      const graph = await createProjectGraphAsync();
      return normalizeProjectGraph(graph);
    } catch {
      if (!options.graphJson) {
        throw new Error(
          'Unable to load workspace graph from Nx API and no graphJson fallback was provided.'
        );
      }

      return this.readSnapshotFromJson(options.graphJson);
    }
  }

  readSnapshotFromJson(graphJson: string): WorkspaceGraphSnapshot {
    const graphJsonPath = path.isAbsolute(graphJson)
      ? graphJson
      : path.resolve(workspaceRoot, graphJson);

    let parsed: unknown;

    try {
      parsed = JSON.parse(readFileSync(graphJsonPath, 'utf8'));
    } catch {
      throw new Error(
        `Unable to read workspace graph JSON at ${graphJsonPath}.`
      );
    }

    try {
      return normalizeProjectGraph(parsed);
    } catch {
      throw new Error(
        `Workspace graph JSON at ${graphJsonPath} does not contain a valid graph shape.`
      );
    }
  }

  summarize(snapshot: WorkspaceGraphSnapshot): GraphSummary {
    return {
      projectCount: snapshot.projects.length,
      dependencyCount: snapshot.dependencies.length,
    };
  }
}

const defaultGraphAdapter = new GraphAdapter();

export async function readWorkspaceGraphSnapshot(
  options: GraphAdapterOptions = {}
): Promise<WorkspaceGraphSnapshot> {
  return defaultGraphAdapter.readSnapshot(options);
}

export function readWorkspaceGraphSnapshotFromJson(
  graphJson: string
): WorkspaceGraphSnapshot {
  return defaultGraphAdapter.readSnapshotFromJson(graphJson);
}

export function summarizeWorkspaceGraph(
  snapshot: WorkspaceGraphSnapshot
): GraphSummary {
  return defaultGraphAdapter.summarize(snapshot);
}

function normalizeProjectGraph(rawGraph: unknown): WorkspaceGraphSnapshot {
  const record = asRecord(rawGraph);
  if (!record) {
    throw new Error('Invalid project graph shape.');
  }

  const graph = unwrapGraphEnvelope(record);
  const nodes = asRecord(graph.nodes);
  const dependenciesBySource = asRecord(graph.dependencies);

  if (!nodes || !dependenciesBySource) {
    throw new Error('Invalid project graph shape.');
  }

  const mappedProjects = Object.entries(nodes)
    .map(([projectName, node]) => normalizeProjectNode(projectName, node))
    .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));

  const scopeFallbackEnabled = mappedProjects.some((project) =>
    hasTagWithPrefix(project.tags, 'scope')
  );

  const projects = mappedProjects.map((project) => ({
    ...project,
    domain: inferProjectDomain(project.tags, scopeFallbackEnabled),
    layer: inferProjectLayer(project.tags),
  }));

  const projectNames = new Set(projects.map((project) => project.id));
  const dependencies: GovernedDependency[] = [];

  for (const [sourceProjectName, edges] of Object.entries(
    dependenciesBySource
  )) {
    if (!projectNames.has(sourceProjectName) || !Array.isArray(edges)) {
      continue;
    }

    for (const edge of edges) {
      const normalized = normalizeDependency(edge, sourceProjectName);
      if (!normalized || !projectNames.has(normalized.targetProjectId)) {
        continue;
      }

      dependencies.push(normalized);
    }
  }

  dependencies.sort(
    (a, b) =>
      a.sourceProjectId.localeCompare(b.sourceProjectId) ||
      a.targetProjectId.localeCompare(b.targetProjectId) ||
      a.type.localeCompare(b.type)
  );

  return {
    extractedAt: new Date().toISOString(),
    source: 'nx-graph',
    projects,
    dependencies,
  };
}

function unwrapGraphEnvelope(
  graph: Record<string, unknown>
): Record<string, unknown> {
  const graphEnvelope = asRecord(graph.graph);
  return graphEnvelope ?? graph;
}

function normalizeProjectNode(
  projectName: string,
  rawNode: unknown
): Omit<GovernedProject, 'domain' | 'layer'> {
  const node = asRecord(rawNode) ?? {};
  const data = asRecord(node.data) ?? {};
  const root = asString(data.root);

  return {
    id: projectName,
    name: asString(node.name) ?? projectName,
    root,
    type: normalizeProjectType(
      asString(data.projectType) ?? asString(node.type) ?? UNKNOWN_PROJECT_TYPE
    ),
    tags: toStringArray(data.tags),
  };
}

function normalizeDependency(
  rawDependency: unknown,
  sourceProjectName: string
): GovernedDependency | null {
  const dependency = asRecord(rawDependency);
  if (!dependency) {
    return null;
  }

  const target = asString(dependency.target);
  if (!target) {
    return null;
  }

  return {
    sourceProjectId: sourceProjectName,
    targetProjectId: target,
    type: normalizeDependencyType(
      asString(dependency.type) ?? UNKNOWN_DEPENDENCY_TYPE
    ),
  };
}

function inferProjectDomain(
  tags: string[],
  scopeFallbackEnabled: boolean
): string | undefined {
  const domainTag = readTagValue(tags, 'domain');
  if (domainTag) {
    return domainTag;
  }

  if (!scopeFallbackEnabled) {
    return undefined;
  }

  return readTagValue(tags, 'scope');
}

function inferProjectLayer(tags: string[]): string | undefined {
  return readTagValue(tags, 'layer');
}

function hasTagWithPrefix(tags: string[], prefix: string): boolean {
  return tags.some((tag) => tag.startsWith(`${prefix}:`));
}

function readTagValue(tags: string[], prefix: string): string | undefined {
  const matchingTag = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!matchingTag) {
    return undefined;
  }

  const value = matchingTag.slice(prefix.length + 1);
  return value ? value : undefined;
}

function normalizeProjectType(
  type: string
): 'application' | 'library' | 'unknown' {
  if (type === 'application' || type === 'app') {
    return 'application';
  }

  if (type === 'library' || type === 'lib') {
    return 'library';
  }

  return 'unknown';
}

function normalizeDependencyType(
  type: string
): 'static' | 'dynamic' | 'implicit' | 'unknown' {
  if (type === 'static' || type === 'dynamic' || type === 'implicit') {
    return type;
  }

  return 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}
