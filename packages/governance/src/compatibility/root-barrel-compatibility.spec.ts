import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { buildGovernanceWorkspace } from '@anarchitects/governance-core';
import * as governanceAdapterNx from '@anarchitects/governance-adapter-nx';

import * as governanceRoot from '../index.js';
import {
  LEGACY_ROOT_BARREL_EXPORT_INVENTORY,
  NX_GOVERNANCE_PACKAGE_EXPORT_KEYS,
  ROOT_COMPATIBILITY_SHELL_EXPORT_SOURCES,
  ROOT_COMPATIBILITY_SHELL_FORBIDDEN_EXPORT_SOURCES,
} from './root-barrel-inventory.js';
import {
  GOVERNANCE_EXECUTOR_IDS,
  GOVERNANCE_GENERATOR_IDS,
} from './public-workflows.js';

describe('nx-governance root package entrypoint compatibility shell', () => {
  const governanceRootPath = path.resolve(__dirname, '..', '..');
  const sourceRoot = path.join(governanceRootPath, 'src');

  it('keeps an explicit inventory of every legacy root export source', () => {
    expect(
      LEGACY_ROOT_BARREL_EXPORT_INVENTORY.map((entry) => entry.source)
    ).toEqual([
      './executors/repo-health/executor.js',
      './executors/repo-boundaries/executor.js',
      './executors/repo-ownership/executor.js',
      './executors/repo-architecture/executor.js',
      './executors/repo-snapshot/executor.js',
      './executors/repo-drift/executor.js',
      './executors/repo-management-insights/executor.js',
      './executors/repo-ai-management-insights/executor.js',
      './executors/repo-ai-root-cause/executor.js',
      './executors/repo-ai-drift/executor.js',
      './executors/repo-ai-pr-impact/executor.js',
      './executors/repo-ai-cognitive-load/executor.js',
      './executors/repo-ai-recommendations/executor.js',
      './executors/repo-ai-smell-clusters/executor.js',
      './executors/repo-ai-refactoring-suggestions/executor.js',
      './executors/repo-ai-scorecard/executor.js',
      './executors/repo-ai-onboarding/executor.js',
      './executors/workspace-graph/executor.js',
      './executors/workspace-conformance/executor.js',
      './executors/governance-graph/executor.js',
      './generators/init/generator.js',
      './generators/add-extension/generator.js',
      './plugin/index.js',
      './core/index.js',
      './plugin/run-governance.js',
      './snapshot-store/index.js',
      './drift-analysis/index.js',
      './ai-analysis/index.js',
      './ai-handoff/index.js',
      './delivery-impact/index.js',
      './reporting/render-management-report.js',
      './nx-adapter/graph-adapter.js',
      './nx-adapter/capability.js',
      './conformance-adapter/conformance-adapter.js',
      './signal-engine/index.js',
      './metric-engine/calculate-metrics.js',
      './extensions/contracts.js',
      './extensions/diagnostics.js',
      './core/exceptions.js',
      './graph-document/index.js',
      './manual-workspace/index.js',
      './profile/load-standalone-profile.js',
      './standalone-cli/index.js',
      './typescript-adapter/index.js',
    ]);
  });

  it('reduces the root barrel to the intended package entrypoint compatibility shell', () => {
    expect(collectExportSources(path.join(sourceRoot, 'index.ts'))).toEqual([
      ...ROOT_COMPATIBILITY_SHELL_EXPORT_SOURCES,
    ]);
  });

  it('keeps the explicit host barrel limited to host-owned executors, generators, and plugin exports', () => {
    expect(
      collectExportSources(path.join(sourceRoot, 'host-public-api.ts'))
    ).toEqual([
      ...GOVERNANCE_EXECUTOR_IDS.map(
        (executorId) => `./executors/${executorId}/executor.js`
      ),
      ...GOVERNANCE_GENERATOR_IDS.map(
        (generatorId) => `./generators/${generatorId}/generator.js`
      ),
      './plugin/index.js',
    ]);
  });

  it('keeps explicit package exports for root, host, and plugin entrypoints only', () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(governanceRootPath, 'package.json'), 'utf8')
    ) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageManifest.exports)).toEqual([
      ...NX_GOVERNANCE_PACKAGE_EXPORT_KEYS,
    ]);
  });

  it('retains compatibility aliases for published Core and adapter package roots', () => {
    expect(governanceRoot.createNxCapability).toBe(
      governanceAdapterNx.createNxCapability
    );
    expect(governanceRoot.readWorkspaceGraphSnapshotFromJson).toBe(
      governanceAdapterNx.readWorkspaceGraphSnapshotFromJson
    );
    expect(governanceRoot.buildGovernanceWorkspace).toBe(
      buildGovernanceWorkspace
    );
  });

  it('stops exporting monolithic internals from the root package entrypoint compatibility shell', () => {
    expect('runGovernance' in governanceRoot).toBe(false);
    expect('runGovernanceSnapshot' in governanceRoot).toBe(false);
    expect('runAgovCheck' in governanceRoot).toBe(false);
    expect('detectTypeScriptWorkspace' in governanceRoot).toBe(false);
  });

  it('keeps host implementation source free of root package entrypoint compatibility shell imports', () => {
    const implementationFiles = collectImplementationFiles(sourceRoot);
    const disallowedImports = new Set([
      '@anarchitects/nx-governance',
      '../index.js',
      '../../index.js',
      '../../../index.js',
    ]);

    const offenders = implementationFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const relativePath = path.relative(sourceRoot, filePath);

      return findImportSpecifiers(source)
        .filter((specifier) => disallowedImports.has(specifier))
        .map((specifier) => `${relativePath}:${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it('does not re-export forbidden legacy implementation paths from the root shell', () => {
    const rootExportSources = new Set(
      collectExportSources(path.join(sourceRoot, 'index.ts'))
    );

    for (const forbiddenSource of ROOT_COMPATIBILITY_SHELL_FORBIDDEN_EXPORT_SOURCES) {
      expect(rootExportSources.has(forbiddenSource)).toBe(false);
    }
  });
});

function collectExportSources(filePath: string): string[] {
  return [...new Set(findImportSpecifiers(readFileSync(filePath, 'utf8')))];
}

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
      !resolved.endsWith('.test.ts') &&
      !resolved.includes(`${path.sep}testing${path.sep}`) &&
      path.basename(resolved) !== 'index.ts'
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
