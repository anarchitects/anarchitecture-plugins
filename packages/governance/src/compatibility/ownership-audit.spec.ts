import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const governanceRoot = path.resolve(__dirname, '..', '..');
const sourceRoot = path.join(governanceRoot, 'src');
const quarantinedDirectories = [
  'core',
  'standalone-cli',
  'typescript-adapter',
  'manual-workspace',
] as const;

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

  it('keeps leaked Core, CLI, manual-workspace, and TypeScript adapter trees out of the build surface, and CLI/manual-workspace/TypeScript adapter trees out of the test program surface', () => {
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
        'src/core/**',
        'src/standalone-cli/**',
        'src/typescript-adapter/**',
        'src/manual-workspace/**',
      ])
    );
    expect(tsconfigSpec.exclude).toEqual(
      expect.arrayContaining([
        'src/standalone-cli/**',
        'src/typescript-adapter/**',
        'src/manual-workspace/**',
      ])
    );
  });

  it('keeps active nx-governance implementation files free of local Core, CLI, and TypeScript adapter imports', () => {
    const activeImplementationFiles = collectImplementationFiles(sourceRoot);
    const disallowedPatterns = [
      /(?:^|\/)\.\.\/core(?:\/|\.js|$)/,
      /(?:^|\/)\.\.\/\.\.\/core(?:\/|\.js|$)/,
      /(?:^|\/)\.\.\/standalone-cli(?:\/|$)/,
      /(?:^|\/)\.\.\/\.\.\/standalone-cli(?:\/|$)/,
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
