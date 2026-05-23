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

  it('keeps pure extension config parsing free of Nx, filesystem, and host imports', () => {
    const configSource = readGovernanceSource('extensions/config.ts');

    expect(configSource).not.toMatch(/@nx\/devkit/);
    expect(configSource).not.toMatch(/node:fs/);
    expect(configSource).not.toMatch(/node:path/);
    expect(configSource).not.toContain('workspaceRoot');
    expect(configSource).not.toMatch(/\.\.\/nx-host\//);
    expect(configSource).not.toMatch(/\.\.\/plugin\//);
    expect(configSource).not.toMatch(/\.\.\/executors\//);
    expect(configSource).not.toMatch(/\.\.\/generators\//);
  });

  it('keeps extension runtime registration free of Nx imports, filesystem access, and module loading', () => {
    const runtimeSource = readGovernanceSource('extensions/runtime.ts');

    expect(runtimeSource).not.toMatch(/@nx\/devkit/);
    expect(runtimeSource).not.toMatch(/node:fs/);
    expect(runtimeSource).not.toMatch(/node:path/);
    expect(runtimeSource).not.toContain('readFileSync(');
    expect(runtimeSource).not.toContain('import(specifier)');
    expect(runtimeSource).not.toMatch(/\.\.\/nx-host\//);
    expect(runtimeSource).not.toMatch(/\.\.\/plugin\//);
    expect(runtimeSource).not.toMatch(/\.\.\/executors\//);
    expect(runtimeSource).not.toMatch(/\.\.\/generators\//);
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

    expect(runtimeFilesWithNxCapabilityLiteral).toEqual([]);
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

  it('keeps Nx-specific extension discovery isolated under nx-host', () => {
    const nxHostExtensionConfigSource = readGovernanceSource(
      'nx-host/extensions/config.ts'
    );
    const nxHostExtensionLoaderSource = readGovernanceSource(
      'nx-host/extensions/loader.ts'
    );
    const nxHostExtensionHostSource = readGovernanceSource(
      'nx-host/extensions/host.ts'
    );

    expect(nxHostExtensionConfigSource).toMatch(/@nx\/devkit/);
    expect(nxHostExtensionHostSource).toMatch(/@nx\/devkit/);
    expect(nxHostExtensionConfigSource).toContain('nx.json');
    expect(nxHostExtensionHostSource).toContain('nx.json');
    expect(nxHostExtensionLoaderSource).toContain('import(specifier)');
  });
});
