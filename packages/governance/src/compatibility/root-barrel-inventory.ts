// This inventory tracks root package entrypoint compatibility only.
// It does not represent legacy governance model compatibility.
export type RootBarrelExportCategory =
  | 'host-owned-public-api'
  | 'adapter-owned-public-api'
  | 'community-owned-public-api'
  | 'internal-implementation-detail'
  | 'legacy-package-entrypoint-export';

export interface RootBarrelExportInventoryEntry {
  source: string;
  category: RootBarrelExportCategory;
  canonicalEntrypoint:
    | '@anarchitects/nx-governance/host'
    | '@anarchitects/governance-adapter-nx'
    | '@anarchitects/governance-core'
    | '@anarchitects/governance-cli'
    | '@anarchitects/governance-adapter-typescript'
    | 'none';
  compatibilityStatus:
    | 'retained-via-root-shell'
    | 'retained-via-host-barrel'
    | 'removed-from-root-shell';
}

export const LEGACY_ROOT_BARREL_EXPORT_INVENTORY = [
  {
    source: './executors/repo-health/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-boundaries/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ownership/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-architecture/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-snapshot/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-drift/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-management-insights/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-management-insights/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-root-cause/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-drift/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-pr-impact/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-cognitive-load/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-recommendations/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-smell-clusters/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-refactoring-suggestions/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-scorecard/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/repo-ai-onboarding/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/workspace-graph/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/workspace-conformance/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './executors/governance-graph/executor.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './generators/init/generator.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './generators/add-extension/generator.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './plugin/index.js',
    category: 'host-owned-public-api',
    canonicalEntrypoint: '@anarchitects/nx-governance/host',
    compatibilityStatus: 'retained-via-host-barrel',
  },
  {
    source: './core/index.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-core',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './plugin/run-governance.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './snapshot-store/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './drift-analysis/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './ai-analysis/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './ai-handoff/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './delivery-impact/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './reporting/render-management-report.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './nx-adapter/graph-adapter.js',
    category: 'adapter-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-adapter-nx',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './nx-adapter/capability.js',
    category: 'adapter-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-adapter-nx',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './conformance-adapter/conformance-adapter.js',
    category: 'legacy-package-entrypoint-export',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './signal-engine/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './metric-engine/calculate-metrics.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './extensions/contracts.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-core',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './extensions/diagnostics.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-core',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './core/exceptions.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-core',
    compatibilityStatus: 'retained-via-root-shell',
  },
  {
    source: './graph-document/index.js',
    category: 'internal-implementation-detail',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './manual-workspace/index.js',
    category: 'legacy-package-entrypoint-export',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './profile/load-standalone-profile.js',
    category: 'legacy-package-entrypoint-export',
    canonicalEntrypoint: 'none',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './standalone-cli/index.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-cli',
    compatibilityStatus: 'removed-from-root-shell',
  },
  {
    source: './typescript-adapter/index.js',
    category: 'community-owned-public-api',
    canonicalEntrypoint: '@anarchitects/governance-adapter-typescript',
    compatibilityStatus: 'removed-from-root-shell',
  },
] as const satisfies readonly RootBarrelExportInventoryEntry[];

export const ROOT_COMPATIBILITY_SHELL_EXPORT_SOURCES = [
  './host-public-api.js',
  '@anarchitects/governance-adapter-nx',
  '@anarchitects/governance-core',
] as const;

export const NX_GOVERNANCE_PACKAGE_EXPORT_KEYS = [
  './package.json',
  '.',
  './host',
  './plugin',
] as const;

export const ROOT_COMPATIBILITY_SHELL_FORBIDDEN_EXPORT_SOURCES = [
  './plugin/run-governance.js',
  './snapshot-store/index.js',
  './drift-analysis/index.js',
  './ai-analysis/index.js',
  './ai-handoff/index.js',
  './delivery-impact/index.js',
  './reporting/render-management-report.js',
  './conformance-adapter/conformance-adapter.js',
  './signal-engine/index.js',
  './metric-engine/calculate-metrics.js',
  './graph-document/index.js',
  './manual-workspace/index.js',
  './profile/load-standalone-profile.js',
  './standalone-cli/index.js',
  './typescript-adapter/index.js',
] as const;
