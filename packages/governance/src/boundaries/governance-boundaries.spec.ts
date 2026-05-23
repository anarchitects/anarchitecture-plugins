import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface BoundaryViolation {
  file: string;
  line: number;
  kind: 'import' | 'text';
  matched: string;
  rule: string;
}

interface ImportBoundaryRule {
  kind: 'import';
  rule: string;
  matches: (specifier: string) => boolean;
}

interface TextBoundaryRule {
  kind: 'text';
  rule: string;
  pattern: RegExp;
}

type BoundaryRule = ImportBoundaryRule | TextBoundaryRule;

const governanceSourceRoot = path.resolve(__dirname, '..');

describe('governance boundary enforcement', () => {
  it('keeps Core-facing runtime source free of Nx, host, and adapter leakage', () => {
    const coreFacingFiles = collectImplementationFiles([
      'core',
      'policy-engine',
      'metric-engine',
      'health-engine',
      'signal-engine',
      'inventory',
    ]);

    const violations = scanBoundaryViolations(coreFacingFiles, [
      {
        kind: 'import',
        rule: 'Core-facing modules must not import Nx APIs.',
        matches: (specifier) =>
          specifier === 'nx' || specifier.startsWith('@nx/'),
      },
      {
        kind: 'import',
        rule: 'Core-facing modules must not import adapter internals.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../nx-adapter') ||
          startsWithRelativeBoundary(specifier, '../conformance-adapter') ||
          startsWithRelativeBoundary(specifier, '../typescript-adapter') ||
          startsWithRelativeBoundary(specifier, '../manual-workspace'),
      },
      {
        kind: 'import',
        rule: 'Core-facing modules must not import host-owned runtime modules.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../nx-host') ||
          startsWithRelativeBoundary(specifier, '../standalone-cli') ||
          startsWithRelativeBoundary(specifier, '../executors') ||
          startsWithRelativeBoundary(specifier, '../generators') ||
          startsWithRelativeBoundary(specifier, '../plugin'),
      },
      {
        kind: 'import',
        rule: 'Core-facing modules must not import filesystem APIs.',
        matches: (specifier) =>
          specifier === 'fs' ||
          specifier === 'node:fs' ||
          specifier === 'path' ||
          specifier === 'node:path',
      },
      {
        kind: 'text',
        rule: 'Core-facing modules must not reference Nx configuration files directly.',
        pattern: /\bnx\.json\b/,
      },
      {
        kind: 'text',
        rule: 'Core-facing modules must not depend on Nx project graph types.',
        pattern: /\bProjectGraph\b|\bCreateNodes\b/,
      },
      {
        kind: 'text',
        rule: 'Core-facing modules must not access process-level host runtime directly.',
        pattern: /\bprocess\./,
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Core-facing boundary violations detected.'
    );
  });

  it('keeps portable extension contracts and runtime free of Nx and host-owned discovery/loading', () => {
    const portableExtensionFiles = collectImplementationFiles([
      'extensions/contracts.ts',
      'extensions/capabilities.ts',
      'extensions/diagnostics.ts',
      'extensions/runtime.ts',
      'extensions/config.ts',
      'extensions/host.ts',
    ]);

    const violations = scanBoundaryViolations(portableExtensionFiles, [
      {
        kind: 'import',
        rule: 'Portable extension modules must not import Nx APIs.',
        matches: (specifier) =>
          specifier === 'nx' || specifier.startsWith('@nx/'),
      },
      {
        kind: 'import',
        rule: 'Portable extension modules must not import filesystem or path APIs.',
        matches: (specifier) =>
          specifier === 'fs' ||
          specifier === 'node:fs' ||
          specifier === 'path' ||
          specifier === 'node:path',
      },
      {
        kind: 'import',
        rule: 'Portable extension modules must not import host-owned discovery or runtime modules.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../nx-host') ||
          startsWithRelativeBoundary(specifier, '../plugin') ||
          startsWithRelativeBoundary(specifier, '../executors') ||
          startsWithRelativeBoundary(specifier, '../generators'),
      },
      {
        kind: 'import',
        rule: 'Portable extension modules must not import adapter internals.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../nx-adapter') ||
          startsWithRelativeBoundary(specifier, '../typescript-adapter') ||
          startsWithRelativeBoundary(specifier, '../manual-workspace'),
      },
      {
        kind: 'text',
        rule: 'Portable extension modules must not perform module loading.',
        pattern: /\bimport\s*\(/,
      },
      {
        kind: 'text',
        rule: 'Portable extension modules must not read Nx configuration directly.',
        pattern: /\bnx\.json\b/,
      },
      {
        kind: 'text',
        rule: 'Portable extension modules must not access process-level host runtime directly.',
        pattern: /\bprocess\./,
      },
      {
        kind: 'text',
        rule: 'Portable extension modules must not perform filesystem reads directly.',
        pattern: /\breadFileSync\s*\(|\breaddirSync\s*\(|\bstatSync\s*\(/,
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Portable extension boundary violations detected.'
    );
  });

  it('keeps Nx host-owned runtime wired to published Core and adapter package roots only', () => {
    const hostOwnedFiles = collectImplementationFiles([
      'plugin',
      'nx-host',
      'executors',
      'generators',
    ]);

    const violations = scanBoundaryViolations(hostOwnedFiles, [
      {
        kind: 'import',
        rule: 'Host-owned runtime must not import monolithic local Core implementation paths.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../core') ||
          startsWithRelativeBoundary(specifier, '../../core'),
      },
      {
        kind: 'import',
        rule: 'Host-owned runtime must not import local standalone CLI or TypeScript adapter paths.',
        matches: (specifier) =>
          startsWithRelativeBoundary(specifier, '../standalone-cli') ||
          startsWithRelativeBoundary(specifier, '../../standalone-cli') ||
          startsWithRelativeBoundary(specifier, '../typescript-adapter') ||
          startsWithRelativeBoundary(specifier, '../../typescript-adapter'),
      },
      {
        kind: 'import',
        rule: 'Host-owned runtime must not deep-import or tunnel through local Nx adapter internals.',
        matches: (specifier) =>
          specifier.startsWith('@anarchitects/governance-adapter-nx/') ||
          startsWithRelativeBoundary(specifier, '../nx-adapter') ||
          startsWithRelativeBoundary(specifier, '../../nx-adapter'),
      },
      {
        kind: 'import',
        rule: 'Host-owned runtime must not deep-import Governance Core internals.',
        matches: (specifier) =>
          specifier.startsWith('@anarchitects/governance-core/'),
      },
      {
        kind: 'import',
        rule: 'Host-owned runtime must not import Governance CLI or TypeScript adapter packages.',
        matches: (specifier) =>
          specifier === '@anarchitects/governance-cli' ||
          specifier === '@anarchitects/governance-adapter-typescript',
      },
      {
        kind: 'import',
        rule: 'Host-owned runtime must not import the root compatibility shell.',
        matches: (specifier) =>
          specifier === '@anarchitects/nx-governance' ||
          specifier === '../index.js' ||
          specifier === '../../index.js' ||
          specifier === '../../../index.js',
      },
      {
        kind: 'text',
        rule: 'Host-owned runtime must not reference Community source paths directly.',
        pattern:
          /\banarchitecture-community\b|@anarchitecture-community\/source/,
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Host/runtime boundary violations detected.'
    );
  });
});

function collectImplementationFiles(entries: string[]): string[] {
  const collected = new Set<string>();

  for (const entry of entries) {
    const absoluteEntry = path.join(governanceSourceRoot, entry);

    if (!absoluteEntry.endsWith('.ts')) {
      collectImplementationFilesFromDirectory(absoluteEntry, collected);
      continue;
    }

    if (isImplementationFile(absoluteEntry)) {
      collected.add(absoluteEntry);
    }
  }

  return [...collected].sort((left, right) => left.localeCompare(right));
}

function collectImplementationFilesFromDirectory(
  directory: string,
  collected: Set<string>
): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectImplementationFilesFromDirectory(resolved, collected);
      continue;
    }

    if (entry.isFile() && isImplementationFile(resolved)) {
      collected.add(resolved);
    }
  }
}

function isImplementationFile(filePath: string): boolean {
  return (
    filePath.endsWith('.ts') &&
    !filePath.endsWith('.spec.ts') &&
    !filePath.endsWith('.test.ts') &&
    !filePath.endsWith('.fixtures.ts')
  );
}

function scanBoundaryViolations(
  files: string[],
  rules: BoundaryRule[]
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf8');
    const relativePath = path.relative(governanceSourceRoot, filePath);

    for (const importMatch of findImportMatches(source)) {
      for (const rule of rules) {
        if (rule.kind !== 'import' || !rule.matches(importMatch.specifier)) {
          continue;
        }

        violations.push({
          file: relativePath,
          line: importMatch.line,
          kind: 'import',
          matched: importMatch.specifier,
          rule: rule.rule,
        });
      }
    }

    for (const rule of rules) {
      if (rule.kind !== 'text') {
        continue;
      }

      for (const match of findTextMatches(source, rule.pattern)) {
        violations.push({
          file: relativePath,
          line: match.line,
          kind: 'text',
          matched: match.value,
          rule: rule.rule,
        });
      }
    }
  }

  return violations;
}

function findImportMatches(source: string): Array<{
  specifier: string;
  line: number;
}> {
  const importPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  const matches: Array<{ specifier: string; line: number }> = [];

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const index = match.index ?? 0;

    if (!specifier) {
      continue;
    }

    matches.push({
      specifier,
      line: lineNumberForIndex(source, index),
    });
  }

  return matches;
}

function findTextMatches(
  source: string,
  pattern: RegExp
): Array<{ value: string; line: number }> {
  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  );
  const matches: Array<{ value: string; line: number }> = [];

  for (const match of source.matchAll(globalPattern)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (!value) {
      continue;
    }

    matches.push({
      value,
      line: lineNumberForIndex(source, index),
    });
  }

  return matches;
}

function lineNumberForIndex(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function startsWithRelativeBoundary(
  specifier: string,
  prefix: string
): boolean {
  return specifier === prefix || specifier.startsWith(`${prefix}/`);
}

function expectBoundaryViolationsToBeEmpty(
  violations: BoundaryViolation[],
  header: string
): void {
  if (violations.length === 0) {
    expect(violations).toEqual([]);
    return;
  }

  const formattedViolations = violations
    .map(
      (violation) =>
        `- ${violation.file}:${violation.line} [${violation.kind}] "${violation.matched}" :: ${violation.rule}`
    )
    .join('\n');

  throw new Error(`${header}\n${formattedViolations}`);
}
