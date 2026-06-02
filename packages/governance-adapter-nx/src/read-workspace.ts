import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  GovernanceDiagnostic,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { ownersForProjectRoot, readCodeowners } from './codeowners.js';
import { toGovernanceWorkspaceAdapterResult } from './to-governance-workspace-adapter-result.js';
import type { AdapterWorkspaceSnapshot } from './types.js';

export interface NxGovernanceWorkspaceContext {
  snapshot: AdapterWorkspaceSnapshot;
  adapterResult: GovernanceWorkspaceAdapterResult;
}

export async function readNxWorkspaceSnapshot(): Promise<AdapterWorkspaceSnapshot> {
  const graph = await createProjectGraphAsync();
  const codeownersEntries = readCodeowners(workspaceRoot);

  const projects = Object.values(graph.nodes).map((node) => {
    const graphTags = Array.isArray(node.data.tags) ? node.data.tags : [];
    const targets =
      node.data.targets && typeof node.data.targets === 'object'
        ? Object.keys(node.data.targets)
        : [];
    const graphMetadata =
      node.data.metadata && typeof node.data.metadata === 'object'
        ? (node.data.metadata as Record<string, unknown>)
        : {};
    const { tags, metadata } = resolveProjectTagsAndMetadata(
      node.data.root,
      workspaceRoot,
      graphTags,
      graphMetadata
    );

    return {
      name: node.name,
      root: node.data.root,
      type: node.data.projectType ?? 'unknown',
      tags,
      targets,
      metadata,
    };
  });

  const projectNames = new Set(projects.map((project) => project.name));
  const diagnostics: GovernanceDiagnostic[] = [];

  const dependencies = Object.entries(graph.dependencies).flatMap(
    ([source, edges]) => {
      if (!projectNames.has(source)) {
        diagnostics.push({
          code: 'NX_ADAPTER_DEPENDENCY_SOURCE_NOT_FOUND',
          message: `Skipped Nx dependency edges from unknown source project "${source}".`,
          severity: 'warning',
          kind: 'warning',
          category: 'adapter',
          source: 'governance-adapter-nx',
          details: {
            sourceProjectId: source,
          },
        });
        return [];
      }

      return edges.flatMap((edge) => {
        if (!edge || typeof edge !== 'object') {
          diagnostics.push({
            code: 'NX_ADAPTER_DEPENDENCY_EDGE_INVALID',
            message: `Skipped malformed Nx dependency edge from "${source}".`,
            severity: 'warning',
            kind: 'warning',
            category: 'adapter',
            source: 'governance-adapter-nx',
            details: {
              sourceProjectId: source,
            },
          });
          return [];
        }

        if (!projectNames.has(edge.target)) {
          diagnostics.push({
            code: 'NX_ADAPTER_DEPENDENCY_TARGET_NOT_FOUND',
            message: `Skipped Nx dependency from "${source}" to unknown target project "${edge.target}".`,
            severity: 'warning',
            kind: 'warning',
            category: 'adapter',
            source: 'governance-adapter-nx',
            reference: {
              projectId: source,
              targetProjectId: edge.target,
            },
            details: {
              sourceProjectId: source,
              targetProjectId: edge.target,
              dependencyType: edge.type ?? 'unknown',
            },
          });
          return [];
        }

        const sourceFile = (edge as { sourceFile?: string }).sourceFile;
        const metadata = nxDependencyMetadata(edge);

        return {
          source,
          target: edge.target,
          type: edge.type ?? 'unknown',
          sourceFile,
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        };
      });
    }
  );

  const codeownersByProject = Object.fromEntries(
    projects.map((project) => [
      project.name,
      ownersForProjectRoot(project.root, codeownersEntries),
    ])
  );

  return {
    root: workspaceRoot,
    projects,
    dependencies,
    codeownersByProject,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function createNxWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  return toGovernanceWorkspaceAdapterResult(snapshot);
}

export async function readNxWorkspaceAdapterResult(): Promise<GovernanceWorkspaceAdapterResult> {
  return createNxWorkspaceAdapterResult(await readNxWorkspaceSnapshot());
}

export async function loadNxGovernanceWorkspaceContext(): Promise<NxGovernanceWorkspaceContext> {
  const snapshot = await readNxWorkspaceSnapshot();

  return {
    snapshot,
    adapterResult: createNxWorkspaceAdapterResult(snapshot),
  };
}

export function resolveProjectTagsAndMetadata(
  projectRoot: string,
  rootPath: string,
  graphTags: string[] = [],
  graphMetadata: Record<string, unknown> = {}
): { tags: string[]; metadata: Record<string, unknown> } {
  const projectAbsoluteRoot = join(rootPath, projectRoot);

  const projectConfig = readJsonFileSafe(
    join(projectAbsoluteRoot, 'project.json')
  );
  const packageJson = readJsonFileSafe(
    join(projectAbsoluteRoot, 'package.json')
  );

  const packageNx = asRecord(packageJson?.nx);

  const packageTags = toStringArray(packageNx?.tags);
  const packageMetadata = asRecord(packageNx?.metadata) ?? {};

  const projectJsonTags = toStringArray(projectConfig?.tags);
  const projectJsonMetadata = asRecord(projectConfig?.metadata) ?? {};

  return {
    tags: uniqueStrings([...packageTags, ...projectJsonTags, ...graphTags]),
    metadata: {
      ...packageMetadata,
      ...projectJsonMetadata,
      ...graphMetadata,
    },
  };
}

function nxDependencyMetadata(edge: unknown): Record<string, unknown> {
  const record = asRecord(edge);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).filter(
      ([key, value]) =>
        !['source', 'target', 'type', 'sourceFile'].includes(key) &&
        value !== undefined
    )
  );
}

function readJsonFileSafe(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return asRecord(parsed) ?? null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
