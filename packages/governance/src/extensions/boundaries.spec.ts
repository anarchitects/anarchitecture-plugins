import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

describe('governance extension architecture boundaries', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../..');
  const governanceSourceRoot = path.join(
    workspaceRoot,
    'packages/governance/src'
  );

  function readGovernanceSource(relativePath: string): string {
    return readFileSync(path.join(governanceSourceRoot, relativePath), 'utf8');
  }

  function listGovernanceSourceFiles(rootDirectory: string): string[] {
    return readdirSync(rootDirectory).flatMap((entry) => {
      const absolutePath = path.join(rootDirectory, entry);
      const relativePath = path.relative(governanceSourceRoot, absolutePath);

      if (statSync(absolutePath).isDirectory()) {
        return listGovernanceSourceFiles(absolutePath);
      }

      return [relativePath.replace(/\\/g, '/')];
    });
  }

  it('keeps extension-facing contracts Nx-free', () => {
    const contractsSource = readGovernanceSource('extensions/contracts.ts');

    expect(contractsSource).not.toMatch(/@nx\/devkit/);
    expect(contractsSource).not.toMatch(/\.\.\/nx-adapter\//);
  });

  it('keeps the generic capability registry free of Nx imports and Nx-specific capability ids', () => {
    const capabilitiesSource = readGovernanceSource(
      'extensions/capabilities.ts'
    );

    expect(capabilitiesSource).not.toMatch(/@nx\/devkit/);
    expect(capabilitiesSource).not.toMatch(/\.\.\/nx-adapter\//);
    expect(capabilitiesSource).not.toContain('capability:nx');
  });

  it('keeps extension diagnostics contracts free of Nx imports', () => {
    const diagnosticsSource = readGovernanceSource('extensions/diagnostics.ts');

    expect(diagnosticsSource).not.toMatch(/@nx\/devkit/);
    expect(diagnosticsSource).not.toMatch(/\.\.\/nx-adapter\//);
  });

  it('produces capability:nx from the adapter layer only', () => {
    const runtimeFilesWithNxCapabilityLiteral = listGovernanceSourceFiles(
      governanceSourceRoot
    )
      .filter(
        (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts')
      )
      .filter((filePath) =>
        readGovernanceSource(filePath).includes('capability:nx')
      );

    expect(runtimeFilesWithNxCapabilityLiteral).toEqual([
      'nx-adapter/capability.ts',
    ]);
  });

  it('keeps run-governance wiring pointed at adapter-owned Nx capability creation and assessment diagnostics flow', () => {
    const runGovernanceSource = readGovernanceSource(
      'plugin/run-governance.ts'
    );
    const assessmentArtifactsSource = readGovernanceSource(
      'plugin/build-assessment-artifacts.ts'
    );

    expect(runGovernanceSource).toContain(
      "import { createNxCapability } from '../nx-adapter/capability.js';"
    );
    expect(runGovernanceSource).toContain('createNxCapability({');
    expect(runGovernanceSource).toContain(
      'extensionDiagnostics: extensionRegistration.diagnostics'
    );
    expect(assessmentArtifactsSource).toContain(
      'extensionDiagnostics: GovernanceExtensionDiagnostic[];'
    );
  });
});
