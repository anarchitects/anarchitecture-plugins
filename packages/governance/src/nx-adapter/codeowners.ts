import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CodeownersEntry {
  pattern: string;
  owners: string[];
}

export function readCodeowners(workspaceRoot: string): CodeownersEntry[] {
  const candidates = [
    '.github/CODEOWNERS',
    'CODEOWNERS',
    'docs/CODEOWNERS',
  ].map((path) => join(workspaceRoot, path));

  const filePath = candidates.find((path) => existsSync(path));
  if (!filePath) {
    return [];
  }

  const content = readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length > 1)
    .map(([pattern, ...owners]) => ({ pattern, owners }));
}

export function ownersForProjectRoot(
  projectRoot: string,
  entries: CodeownersEntry[]
): string[] {
  const normalizedRoot = normalizeForCodeowners(projectRoot);
  const matches = entries.filter((entry) =>
    matchesCodeownersPattern(normalizedRoot, entry.pattern)
  );

  if (!matches.length) {
    return [];
  }

  const lastMatch = matches[matches.length - 1];
  return Array.from(new Set(lastMatch.owners));
}

function normalizeForCodeowners(input: string): string {
  return input
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .trim();
}

function matchesCodeownersPattern(projectRoot: string, pattern: string): boolean {
  const normalizedPattern = normalizePattern(pattern);
  const regex = globToRegex(normalizedPattern);
  const projectCandidates = [
    projectRoot,
    `${projectRoot}/`,
    `${projectRoot}/placeholder.file`,
  ];

  return projectCandidates.some((candidate) => regex.test(candidate));
}

function normalizePattern(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  let normalized = trimmed.replace(/^\//, '');

  if (normalized.endsWith('/')) {
    normalized = `${normalized}**`;
  }

  if (!normalized.includes('/')) {
    normalized = `**/${normalized}`;
  }

  return normalized;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
    .replace(/\?/g, '[^/]');

  return new RegExp(`^${escaped}$`);
}
