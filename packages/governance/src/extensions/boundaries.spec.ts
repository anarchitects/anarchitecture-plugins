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

  it('keeps host composition pointed at adapter-owned Nx capability creation and assessment diagnostics flow', () => {
    const runGovernanceSource = readGovernanceSource(
      'plugin/run-governance.ts'
    );
    const compositionSource = readGovernanceSource(
      'plugin/compose-governance-runtime.ts'
    );
    const assessmentArtifactsSource = readGovernanceSource(
      'plugin/build-assessment-artifacts.ts'
    );

    expect(runGovernanceSource).toContain('composeNxGovernanceRuntime');
    expect(compositionSource).toContain(
      "from '@anarchitects/governance-adapter-nx';"
    );
    expect(compositionSource).toContain(
      "from '@anarchitects/governance-core';"
    );
    expect(compositionSource).toContain(
      'const adapterCapabilities = adapterResult.capabilities ?? [];'
    );
    expect(compositionSource).toContain('capabilities: adapterCapabilities');
    expect(compositionSource).toContain(
      'extensionDiagnostics: extensionRegistration.diagnostics'
    );
    expect(assessmentArtifactsSource).toContain(
      'extensionDiagnostics: GovernanceExtensionDiagnostic[];'
    );
  });

  it('keeps run-governance focused on orchestration by delegating host helpers to focused modules', () => {
    const runGovernanceSource = readGovernanceSource(
      'plugin/run-governance.ts'
    );
    const prImpactHostContextSource = readGovernanceSource(
      'plugin/pr-impact-host-context.ts'
    );
    const snapshotRuntimeSource = readGovernanceSource(
      'plugin/snapshot-runtime.ts'
    );

    expect(runGovernanceSource).toContain(
      "from './governance-run-renderers.js';"
    );
    expect(runGovernanceSource).toContain("from './snapshot-runtime.js';");
    expect(runGovernanceSource).toContain(
      "from './pr-impact-host-context.js';"
    );
    expect(runGovernanceSource).toContain("from './ai-payload-limits.js';");
    expect(runGovernanceSource).not.toContain("from './ai-payload-scope.js';");
    expect(runGovernanceSource).not.toContain("from './drift-ai-analysis.js';");
    expect(runGovernanceSource).toMatch(
      /summarizeDriftInterpretation[\s\S]*from '@anarchitects\/governance-core';/
    );
    expect(runGovernanceSource).toMatch(
      /buildSnapshotDeliveryImpactSummary[\s\S]*from '@anarchitects\/governance-core';/
    );

    expect(runGovernanceSource).not.toMatch(/const AI_PAYLOAD_LIMITS =/);
    expect(runGovernanceSource).not.toMatch(
      /function renderDriftCliReport|function renderAiRootCauseCliReport|function renderAiDriftCliReport|function renderAiPrImpactCliReport|function renderAiCognitiveLoadCliReport|function renderAiRecommendationsCliReport|function renderAiSmellClustersCliReport|function renderAiRefactoringSuggestionsCliReport|function renderAiScorecardCliReport|function renderAiOnboardingCliReport/
    );
    expect(runGovernanceSource).not.toMatch(
      /function resolveSnapshotPath|function resolveOptionalSnapshotComparison|function toSnapshotDeliveryImpactSummary/
    );
    expect(runGovernanceSource).not.toMatch(
      /function readChangedFiles|function resolveAffectedProjects/
    );
    expect(runGovernanceSource).not.toMatch(
      /function summarizeDriftInterpretation|function sliceDependenciesForProjectScope|function buildTruncationMetadata|function sliceTopItems|function compareViolationsForPriority|function asString/
    );
    expect(runGovernanceSource).toContain('function collectAffectedNodeIds');
    expect(runGovernanceSource).toContain(
      'function collectAffectedRelationIds'
    );
    expect(runGovernanceSource).not.toContain('rootCauseProjectScope');

    expect(prImpactHostContextSource).toContain(
      'export function readChangedFiles'
    );
    expect(prImpactHostContextSource).not.toContain(
      'export function resolveAffectedProjects'
    );
    expect(prImpactHostContextSource).not.toContain(
      ['Governance', 'Project'].join('')
    );

    expect(snapshotRuntimeSource).toContain(
      'export function resolveSnapshotPath'
    );
    expect(snapshotRuntimeSource).toContain(
      'export async function resolveOptionalSnapshotComparison'
    );
    expect(snapshotRuntimeSource).not.toContain(
      'export function toSnapshotDeliveryImpactSummary'
    );
  });

  it('keeps run-governance imports constrained to Community package roots and focused host modules', () => {
    const runGovernanceSource = readGovernanceSource(
      'plugin/run-governance.ts'
    );
    const specifiers = [
      ...runGovernanceSource.matchAll(/from ['"]([^'"]+)['"]/g),
    ]
      .map((match) => match[1])
      .sort((left, right) => left.localeCompare(right));

    const disallowed = specifiers.filter(
      (specifier) =>
        ![
          '@nx/devkit',
          '@anarchitects/governance-core',
          '@anarchitects/governance-adapter-nx',
          'node:path',
        ].includes(specifier) &&
        !specifier.startsWith('../presets/') &&
        !specifier.startsWith('../profile/') &&
        !specifier.startsWith('../reporting/') &&
        !specifier.startsWith('../snapshot-store/') &&
        !specifier.startsWith('../conformance-adapter/') &&
        !specifier.startsWith('../ai-handoff/') &&
        !specifier.startsWith('../nx-host/extensions/') &&
        !specifier.startsWith('./')
    );

    expect(disallowed).toEqual([]);
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
