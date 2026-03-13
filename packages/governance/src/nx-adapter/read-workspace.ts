import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';

import { ownersForProjectRoot, readCodeowners } from './codeowners.js';
import { AdapterWorkspaceSnapshot } from './types.js';

export async function readNxWorkspaceSnapshot(): Promise<AdapterWorkspaceSnapshot> {
  const graph = await createProjectGraphAsync();
  const codeownersEntries = readCodeowners(workspaceRoot);

  const projects = Object.values(graph.nodes).map((node) => {
    const tags = Array.isArray(node.data.tags) ? node.data.tags : [];
    const metadata =
      node.data.metadata && typeof node.data.metadata === 'object'
        ? (node.data.metadata as Record<string, unknown>)
        : {};

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
