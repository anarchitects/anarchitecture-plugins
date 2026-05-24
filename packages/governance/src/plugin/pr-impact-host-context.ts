import { workspaceRoot } from '@nx/devkit';
import { execFileSync } from 'node:child_process';

import type { GovernanceAssessment } from '@anarchitects/governance-core';

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
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function resolveAffectedProjects(
  assessment: GovernanceAssessment,
  changedFiles: string[]
): GovernanceAssessment['workspace']['projects'] {
  if (changedFiles.length === 0) {
    return [];
  }

  const changedSet = new Set(changedFiles);

  return assessment.workspace.projects.filter((project) => {
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
