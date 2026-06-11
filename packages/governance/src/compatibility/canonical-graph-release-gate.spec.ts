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
    const forbiddenPatterns = [
      /GovernanceProjectInput|GovernanceDependencyInput|GovernanceProject|GovernanceDependency|GovernanceCompatibilityWorkspace/,
      /workspace\.projects|workspace\.dependencies|inventory\.projects|inventory\.dependencies|assessment\.workspace\.projects|assessment\.workspace\.dependencies/,
      /projectId|sourceProjectId|targetProjectId|relatedProjectIds|affectedProjects|Violation\.project/,
      /Omit<GovernanceWorkspace, 'projects' \| 'dependencies'>|Omit<GovernanceWorkspace, "projects" \| "dependencies">/,
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
