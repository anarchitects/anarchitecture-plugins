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

const packageRoot = path.resolve(__dirname, '..', '..');
const sourceRoot = path.resolve(__dirname, '..');

describe('governance extension nx boundary enforcement', () => {
  it('depends only on Governance Core and runtime helpers', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([
      '@anarchitects/governance-core',
      'tslib',
    ]);
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import adapter, host, executor, renderer, or monolithic internals', () => {
    const files = collectImplementationFiles(sourceRoot);

    const violations = scanBoundaryViolations(files, [
      {
        rule: 'Extension must not import the Nx adapter package.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/governance-adapter-nx(?:\/|$)/),
      },
      {
        rule: 'Extension must not import the Nx host package.',
        test: (line) =>
          matchImport(line, /^@anarchitects\/nx-governance(?:\/|$)/),
      },
      {
        rule: 'Extension must import Governance Core from the published package root only.',
        test: (line) => matchImport(line, /^@anarchitects\/governance-core\//),
      },
      {
        rule: 'Extension must not import monolithic governance source paths.',
        test: (line) =>
          matchImport(
            line,
            /(?:^|\/)governance\/src\/(?:core|plugin|executors|generators|nx-host|standalone-cli|typescript-adapter|manual-workspace|rendering|reporting)\//
          ),
      },
      {
        rule: 'Extension must not import Community source paths directly.',
        test: (line) =>
          matchImport(line, /anarchitecture-community|governance-core\/src\//),
      },
    ]);

    expectBoundaryViolationsToBeEmpty(
      violations,
      'Nx extension boundary violations detected.'
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
          file: path.relative(sourceRoot, file),
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
