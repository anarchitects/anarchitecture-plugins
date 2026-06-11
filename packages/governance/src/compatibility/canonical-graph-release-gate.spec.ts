import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('canonical graph epic release gate', () => {
  const governanceRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(governanceRoot, '..', '..');
  const guardedSourceFiles = [
    path.join(governanceRoot, 'src', 'plugin', 'compose-governance-runtime.ts'),
    path.join(governanceRoot, 'src', 'index.ts'),
    path.join(
      governanceRoot,
      'src',
      'compatibility',
      'root-barrel-inventory.ts'
    ),
  ];

  it('keeps the canonical runtime and root shell sources free of legacy governance model contracts', () => {
    const legacyCoreContracts = [
      ['Governance', 'ProjectInput'].join(''),
      ['Governance', 'DependencyInput'].join(''),
      ['Governance', 'Project'].join(''),
      ['Governance', 'Dependency'].join(''),
      ['Governance', 'CompatibilityWorkspace'].join(''),
    ];
    const legacyWorkspaceFields = [
      ['workspace', '.projects'].join(''),
      ['workspace', '.dependencies'].join(''),
      ['inventory', '.projects'].join(''),
      ['inventory', '.dependencies'].join(''),
      ['assessment', '.workspace', '.projects'].join(''),
      ['assessment', '.workspace', '.dependencies'].join(''),
    ];
    const legacyReferenceFields = [
      ['project', 'Id'].join(''),
      ['source', 'ProjectId'].join(''),
      ['target', 'ProjectId'].join(''),
      ['related', 'ProjectIds'].join(''),
      ['affected', 'Projects'].join(''),
      ['Violation', '.project'].join(''),
    ];
    const staleWorkspaceOmitVariants = [
      `Omit<GovernanceWorkspace, ${"'projects' | 'dependencies'"}>`,
      `Omit<GovernanceWorkspace, ${'"projects" | "dependencies"'}>`,
    ];
    const forbiddenPatterns = [
      new RegExp(legacyCoreContracts.join('|')),
      new RegExp(
        legacyWorkspaceFields
          .map((field) => field.replaceAll('.', '\\.'))
          .join('|')
      ),
      new RegExp(
        legacyReferenceFields
          .map((field) => field.replaceAll('.', '\\.'))
          .join('|')
      ),
      new RegExp(
        staleWorkspaceOmitVariants
          .map((variant) =>
            variant
              .replaceAll('|', '\\|')
              .replaceAll('.', '\\.')
              .replaceAll('<', '\\<')
              .replaceAll('>', '\\>')
          )
          .join('|')
      ),
    ];

    for (const filePath of guardedSourceFiles) {
      const source = readFileSync(filePath, 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it('pins governance-core to the current canonical plugin-side version', () => {
    const packagePaths = [
      path.join(repoRoot, 'packages', 'governance', 'package.json'),
      path.join(repoRoot, 'packages', 'governance-adapter-nx', 'package.json'),
      path.join(
        repoRoot,
        'packages',
        'governance-extension-nx',
        'package.json'
      ),
    ];

    for (const packagePath of packagePaths) {
      const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };

      expect(manifest.dependencies?.['@anarchitects/governance-core']).toBe(
        '0.2.0'
      );
    }
  });
});
