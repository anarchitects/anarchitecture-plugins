import { workspaceRoot } from '@nx/devkit';
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
