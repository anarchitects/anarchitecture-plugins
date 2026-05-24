import { workspaceRoot } from '@nx/devkit';
import type { GovernanceProject } from '@anarchitects/governance-core';
import { execFileSync } from 'node:child_process';
export function readChangedFiles(baseRef: string, headRef: string): string[] {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', `${baseRef}...${headRef}`],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    )
      .toString()
      .trim();

    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export function resolveAffectedProjects(
  projects: GovernanceProject[],
  changedFiles: string[]
): GovernanceProject[] {
  if (changedFiles.length === 0) {
    return [];
  }

  const changedSet = new Set(changedFiles);

  return projects.filter((project) => {
    const normalizedRoot = project.root.replace(/\\/g, '/').replace(/\/+$/, '');

    for (const filePath of changedSet) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (
        normalizedPath === normalizedRoot ||
        normalizedPath.startsWith(`${normalizedRoot}/`)
      ) {
        return true;
      }
    }

    return false;
  });
}
