import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const governanceRoot = path.resolve(__dirname, '..', '..');
const sourceRoot = path.join(governanceRoot, 'src');
const quarantinedDirectories = [
  'health-engine',
  'metric-engine',
  'policy-engine',
  'signal-engine',
  'inventory',
  'ai-analysis',
  'delivery-impact',
  'core',
  'standalone-cli',
  'typescript-adapter',
  'manual-workspace',
] as const;
const quarantinedFiles = new Set([
  path.join(sourceRoot, 'plugin', 'apply-governance-exceptions.ts'),
  path.join(sourceRoot, 'plugin', 'build-exception-report.ts'),
  path.join(sourceRoot, 'plugin', 'evaluate-exception-lifecycle.ts'),
]);

describe('nx-governance ownership audit guards', () => {
  it('keeps the host package free of standalone CLI publishing and Community adapter dependencies', () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(governanceRoot, 'package.json'), 'utf8')
    ) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(packageManifest.bin).toBeUndefined();
    expect(packageManifest.dependencies).not.toHaveProperty(
      '@anarchitects/governance-cli'
    );
    expect(packageManifest.dependencies).not.toHaveProperty(
      '@anarchitects/governance-adapter-typescript'
    );
  });

  it('keeps the host package publishable with a semver adapter dependency', () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(governanceRoot, 'package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>;
    };
    const adapterManifest = JSON.parse(
      readFileSync(
        path.join(
          governanceRoot,
          '..',
          'governance-adapter-nx',
          'package.json'
        ),
        'utf8'
      )
    ) as {
      version: string;
    };

    expect(
      packageManifest.dependencies?.['@anarchitects/governance-adapter-nx']
    ).toBe(adapterManifest.version);
    expect(
      packageManifest.dependencies?.['@anarchitects/governance-adapter-nx']
    ).not.toMatch(/^workspace:/);
  });

  it('keeps leaked Core-like, CLI, manual-workspace, and TypeScript adapter trees out of the build and test program surfaces', () => {
    const tsconfigLib = JSON.parse(
      readFileSync(path.join(governanceRoot, 'tsconfig.lib.json'), 'utf8')
    ) as {
      exclude?: string[];
    };
    const tsconfigSpec = JSON.parse(
      readFileSync(path.join(governanceRoot, 'tsconfig.spec.json'), 'utf8')
    ) as {
      exclude?: string[];
    };

    expect(tsconfigLib.exclude).toEqual(
      expect.arrayContaining([
        'src/health-engine/**',
        'src/metric-engine/**',
        'src/policy-engine/**',
        'src/signal-engine/**',
        'src/inventory/**',
        'src/ai-analysis/**',
        'src/delivery-impact/**',
        'src/core/**',
        'src/standalone-cli/**',
        'src/typescript-adapter/**',
        'src/manual-workspace/**',
        'src/plugin/apply-governance-exceptions.ts',
        'src/plugin/build-exception-report.ts',
        'src/plugin/evaluate-exception-lifecycle.ts',
      ])
    );
    expect(tsconfigSpec.exclude).toEqual(
      expect.arrayContaining([
        'src/health-engine/**',
        'src/metric-engine/**',
        'src/policy-engine/**',
        'src/signal-engine/**',
        'src/inventory/**',
        'src/ai-analysis/**',
        'src/delivery-impact/**',
        'src/core/**',
        'src/standalone-cli/**',
        'src/typescript-adapter/**',
        'src/manual-workspace/**',
        'src/plugin/apply-governance-exceptions.ts',
        'src/plugin/apply-governance-exceptions.spec.ts',
        'src/plugin/build-exception-report.ts',
        'src/plugin/build-exception-report.spec.ts',
        'src/plugin/evaluate-exception-lifecycle.ts',
        'src/plugin/evaluate-exception-lifecycle.spec.ts',
      ])
    );
  });

  it('keeps active nx-governance implementation files free of local Core-like, CLI, and TypeScript adapter imports', () => {
    const activeImplementationFiles = collectImplementationFiles(sourceRoot);
    const disallowedPatterns = [
      /(?:^|\/)\.\.\/health-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/health-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/metric-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/metric-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/policy-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/policy-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/signal-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/signal-engine(?:\/|$)/,
      /(?:^|\/)\.\.\/inventory(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/inventory(?:\/|$)/,
      /(?:^|\/)\.\.\/ai-analysis(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/ai-analysis(?:\/|$)/,
      /(?:^|\/)\.\.\/delivery-impact(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/delivery-impact(?:\/|$)/,
      /(?:^|\/)\.\.\/core(?:\/|\.js|$)/,
      /(?:^|\/)\.\.\/\.\.\/core(?:\/|\.js|$)/,
      /(?:^|\/)\.\.\/standalone-cli(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/standalone-cli(?:\/|$)/,
      /(?:^|\/)\.\.\/manual-workspace(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/manual-workspace(?:\/|$)/,
      /(?:^|\/)\.\.\/typescript-adapter(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/typescript-adapter(?:\/|$)/,
      /^@anarchitects\/governance-cli(?:\/|$)/,
      /^@anarchitects\/governance-adapter-typescript(?:\/|$)/,
      /^@anarchitects\/governance-core\//,
    ];

    const offenders = activeImplementationFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const relativePath = path.relative(sourceRoot, filePath);

      return findImportSpecifiers(source)
        .filter((specifier) =>
          disallowedPatterns.some((pattern) => pattern.test(specifier))
        )
        .map((specifier) => `${relativePath}:${specifier}`);
    });

    expect(offenders).toEqual([]);
  });
});

function collectImplementationFiles(directory: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (
      entry.isDirectory() &&
      quarantinedDirectories.includes(
        entry.name as (typeof quarantinedDirectories)[number]
      )
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      collected.push(...collectImplementationFiles(resolved));
      continue;
    }

    if (
      !quarantinedFiles.has(resolved) &&
      entry.isFile() &&
      resolved.endsWith('.ts') &&
      !resolved.endsWith('.spec.ts') &&
      !resolved.endsWith('.test.ts') &&
      !resolved.endsWith('.fixtures.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}

function findImportSpecifiers(source: string): string[] {
  return [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(
    (match) => match[1]
  );
}
