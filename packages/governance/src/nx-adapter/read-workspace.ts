import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GovernanceWorkspaceAdapterResult } from '../core/index.js';

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
      metadata,
    };
  });

  const projectNames = new Set(projects.map((project) => project.name));

  const dependencies = Object.entries(graph.dependencies).flatMap(
    ([source, edges]) =>
      (projectNames.has(source) ? edges : []).flatMap((edge) => {
        if (!projectNames.has(edge.target)) {
          return [];
        }

        const sourceFile = (edge as { sourceFile?: string }).sourceFile;

        return {
          source,
          target: edge.target,
          type: edge.type ?? 'unknown',
          sourceFile,
        };
      })
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
