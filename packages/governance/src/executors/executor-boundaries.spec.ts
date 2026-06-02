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

const executorsRoot = path.resolve(__dirname);

describe('governance executor boundary enforcement', () => {
  it('keeps executors thin and routed through host command APIs', () => {
    const files = collectImplementationFiles(executorsRoot);

    const violations = scanBoundaryViolations(files, [
      {
        rule: 'Executors must not import the Nx governance adapter package directly.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/governance-adapter-nx(?:\/|$)/),
      },
      {
        rule: 'Executors must not import the Nx governance extension package directly.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/governance-extension-nx(?:\/|$)/),
      },
      {
        rule: 'Executors must not import rule implementation modules directly.',
        test: (line) =>
          matchImport(line, /(?:^|\/)(?:core|policy-engine)\/.*rules/),
      },
      {
        rule: 'Executors must not import metric implementation modules directly.',
        test: (line) =>
          matchImport(line, /(?:^|\/)(?:metric-engine|delivery-impact)\//),
      },
      {
        rule: 'Executors must not import recommendation implementation modules directly.',
        test: (line) => matchImport(line, /recommendations/),
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Governance executor boundary violations detected.'
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
          file: path.relative(executorsRoot, file),
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
