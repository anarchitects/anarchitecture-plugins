import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const UNKNOWN_PROJECT_TYPE = 'unknown';
const UNKNOWN_DEPENDENCY_TYPE = 'unknown';

export interface WorkspaceGraphProject {
  name: string;
  root: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface WorkspaceGraphDependency {
  source: string;
  target: string;
  type: string;
  sourceFile?: string;
}

export interface WorkspaceGraphSourceMetadata {
  kind: 'nx-api' | 'json';
  graphJsonPath?: string;
}

export interface WorkspaceGraphSnapshot {
  root: string;
  source: WorkspaceGraphSourceMetadata;
  projects: WorkspaceGraphProject[];
  dependencies: WorkspaceGraphDependency[];
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
      return normalizeProjectGraph(graph, {
        kind: 'nx-api',
      });
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
      return normalizeProjectGraph(parsed, {
        kind: 'json',
        graphJsonPath,
      });
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

function normalizeProjectGraph(
  rawGraph: unknown,
  source: WorkspaceGraphSourceMetadata
): WorkspaceGraphSnapshot {
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

  const projects = Object.entries(nodes)
    .map(([projectName, node]) => normalizeProjectNode(projectName, node))
    .sort((a, b) => a.name.localeCompare(b.name));

  const projectNames = new Set(projects.map((project) => project.name));
  const dependencies: WorkspaceGraphDependency[] = [];

  for (const [sourceProjectName, edges] of Object.entries(
    dependenciesBySource
  )) {
    if (!projectNames.has(sourceProjectName) || !Array.isArray(edges)) {
      continue;
    }

    for (const edge of edges) {
      const normalized = normalizeDependency(edge, sourceProjectName);
      if (!normalized || !projectNames.has(normalized.target)) {
        continue;
      }

      dependencies.push(normalized);
    }
  }

  dependencies.sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.type.localeCompare(b.type) ||
      (a.sourceFile ?? '').localeCompare(b.sourceFile ?? '')
  );

  return {
    root: workspaceRoot,
    source,
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
): WorkspaceGraphProject {
  const node = asRecord(rawNode) ?? {};
  const data = asRecord(node.data) ?? {};

  return {
    name: asString(node.name) ?? projectName,
    root: asString(data.root) ?? '',
    type:
      asString(data.projectType) ?? asString(node.type) ?? UNKNOWN_PROJECT_TYPE,
    tags: toStringArray(data.tags),
    metadata: asRecord(data.metadata) ?? {},
  };
}

function normalizeDependency(
  rawDependency: unknown,
  sourceProjectName: string
): WorkspaceGraphDependency | null {
  const dependency = asRecord(rawDependency);
  if (!dependency) {
    return null;
  }

  const target = asString(dependency.target);
  if (!target) {
    return null;
  }

  return {
    source: sourceProjectName,
    target,
    type: asString(dependency.type) ?? UNKNOWN_DEPENDENCY_TYPE,
    sourceFile: asString(dependency.sourceFile),
  };
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
