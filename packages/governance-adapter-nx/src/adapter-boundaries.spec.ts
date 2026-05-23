import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface BoundaryViolation {
  file: string;
  line: number;
  matched: string;
  rule: string;
}

interface BoundaryRule {
  rule: string;
  test: (line: string) => string | null;
}

const adapterSourceRoot = path.resolve(__dirname);

describe('governance adapter nx boundary enforcement', () => {
  it('keeps the adapter package isolated from host internals and monolithic source paths', () => {
    const files = collectImplementationFiles(adapterSourceRoot);

    const violations = scanBoundaryViolations(files, [
      {
        rule: 'Adapter must not import the Nx host package.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/nx-governance(?:\/|$)/),
      },
      {
        rule: 'Adapter must not import the standalone Governance CLI package.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/governance-cli(?:\/|$)/),
      },
      {
        rule: 'Adapter must not import the TypeScript adapter package.',
        test: (line) =>
          matchImport(
            line,
            /^@anarchitects\/governance-adapter-typescript(?:\/|$)/
          ),
      },
      {
        rule: 'Adapter must import Governance Core from the published package root only.',
        test: (line) => matchImport(line, /^@anarchitects\/governance-core\//),
      },
      {
        rule: 'Adapter must not import monolithic governance source paths.',
        test: (line) =>
          matchImport(
            line,
            /(?:^|\/)governance\/src\/(?:core|plugin|executors|generators|nx-host|standalone-cli|typescript-adapter|manual-workspace)\//
          ),
      },
      {
        rule: 'Adapter must not import Community source paths directly.',
        test: (line) =>
          matchImport(line, /anarchitecture-community|governance-core\/src\//),
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Nx adapter boundary violations detected.'
    );
  });
});

function collectImplementationFiles(directory: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collected.push(...collectImplementationFiles(resolved));
      continue;
    }

    if (
      entry.isFile() &&
      resolved.endsWith('.ts') &&
      !resolved.endsWith('.spec.ts') &&
      !resolved.endsWith('.test.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}

function scanBoundaryViolations(
  files: string[],
  rules: BoundaryRule[]
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      for (const rule of rules) {
        const matched = rule.test(line);
        if (!matched) {
          continue;
        }

        violations.push({
          file: path.relative(adapterSourceRoot, file),
          line: index + 1,
          matched,
          rule: rule.rule,
        });
      }
    });
  }

  return violations;
}

function matchImport(line: string, pattern: RegExp): string | null {
  const match = line.match(/from ['"]([^'"]+)['"]/);
  if (!match) {
    return null;
  }

  return pattern.test(match[1]) ? match[1] : null;
}

function expectBoundaryViolationsToBeEmpty(
  violations: BoundaryViolation[],
  message: string
): void {
  const formatted = violations.map(
    (violation) =>
      `${violation.file}:${violation.line} ${violation.rule} (${violation.matched})`
  );

  if (formatted.length > 0) {
    throw new Error(`${message}\n${formatted.join('\n')}`);
  }
}
