import { formatFiles, logger, Tree, updateJson, writeJson } from '@nx/devkit';
import {
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  resolveGovernanceProfileRelativePath,
} from '../../profile/runtime-profile.js';
import { createAngularCleanupStarterProfile } from '../../presets/angular-cleanup/profile.js';
import { eslintIntegrationGenerator } from '../eslint-integration/generator.js';

interface InitSchema {
  configureEslint?: boolean;
  eslintConfigPath?: string;
  governanceHelperPath?: string;
  profile?: string;
  profilePath?: string;
  skipFormat?: boolean;
}

interface RootPackageJson {
  nx?: {
    targets?: Record<string, unknown>;
  };
}

interface RootTargetConfig {
  executor?: string;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface NxJson {
  plugins?: Array<
    string | { plugin: string; options?: Record<string, unknown> }
  >;
}

const GOVERNANCE_PLUGIN_NAME = '@anarchitects/nx-governance';

const GOVERNANCE_TARGETS = {
  'repo-health': {
    executor: '@anarchitects/nx-governance:repo-health',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'cli',
    },
    metadata: {
      description: 'Run governance health assessment for the workspace.',
    },
  },
  'repo-boundaries': {
    executor: '@anarchitects/nx-governance:repo-boundaries',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'cli',
    },
    metadata: {
      description: 'Run governance boundary checks for the workspace.',
    },
  },
  'repo-ownership': {
    executor: '@anarchitects/nx-governance:repo-ownership',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'cli',
    },
    metadata: {
      description: 'Run governance ownership checks for the workspace.',
    },
  },
  'repo-architecture': {
    executor: '@anarchitects/nx-governance:repo-architecture',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'cli',
    },
    metadata: {
      description: 'Run governance architecture checks for the workspace.',
    },
  },
  'repo-snapshot': {
    executor: '@anarchitects/nx-governance:repo-snapshot',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'cli',
    },
    metadata: {
      description:
        'Persist governance metric snapshots for drift and AI analysis.',
    },
  },
  'repo-drift': {
    executor: '@anarchitects/nx-governance:repo-drift',
    options: {
      output: 'cli',
    },
    metadata: {
      description:
        'Compare recent governance snapshots and report drift signals.',
    },
  },
  'workspace-graph': {
    executor: '@anarchitects/nx-governance:workspace-graph',
    metadata: {
      description:
        'Print workspace project/dependency counts from the Nx graph for diagnostic baselining.',
    },
  },
  'workspace-conformance': {
    executor: '@anarchitects/nx-governance:workspace-conformance',
    options: {
      conformanceJson: 'dist/conformance-result.json',
    },
    metadata: {
      description:
        'Print Nx Conformance finding/error/warning counts from conformance JSON output.',
    },
  },
  'governance-graph': {
    executor: '@anarchitects/nx-governance:governance-graph',
    options: {
      format: 'html',
      outputPath: 'dist/governance/graph.html',
    },
    metadata: {
      description:
        'Generate a governance-enriched graph artifact and static HTML viewer from the Nx Project Graph.',
    },
  },
  'repo-ai-root-cause': {
    executor: '@anarchitects/nx-governance:repo-ai-root-cause',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topViolations: 10,
    },
    metadata: {
      description:
        'Prepare deterministic root-cause payloads for AI interpretation based on governance snapshots.',
    },
  },
  'repo-ai-drift': {
    executor: '@anarchitects/nx-governance:repo-ai-drift',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
    },
    metadata: {
      description:
        'Prepare deterministic drift interpretation payloads from snapshot deltas and trend signals.',
    },
  },
  'repo-ai-pr-impact': {
    executor: '@anarchitects/nx-governance:repo-ai-pr-impact',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      baseRef: 'main',
      headRef: 'HEAD',
    },
    metadata: {
      description:
        'Prepare deterministic PR architectural impact payloads for AI interpretation.',
    },
  },
  'repo-ai-cognitive-load': {
    executor: '@anarchitects/nx-governance:repo-ai-cognitive-load',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topProjects: 10,
    },
    metadata: {
      description:
        'Prepare deterministic cognitive-load analysis payloads from dependency and domain coupling signals.',
    },
  },
  'repo-ai-recommendations': {
    executor: '@anarchitects/nx-governance:repo-ai-recommendations',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topViolations: 10,
    },
    metadata: {
      description:
        'Prepare deterministic architecture recommendations from violations, dependencies, and trend signals.',
    },
  },
  'repo-ai-smell-clusters': {
    executor: '@anarchitects/nx-governance:repo-ai-smell-clusters',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topViolations: 10,
    },
    metadata: {
      description:
        'Prepare deterministic architecture smell cluster analysis from prioritized violations and snapshot persistence signals.',
    },
  },
  'repo-ai-refactoring-suggestions': {
    executor: '@anarchitects/nx-governance:repo-ai-refactoring-suggestions',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topViolations: 10,
      topProjects: 5,
    },
    metadata: {
      description:
        'Prepare deterministic AI refactoring suggestions from hotspot, fanout, and persistent smell signals.',
    },
  },
  'repo-ai-scorecard': {
    executor: '@anarchitects/nx-governance:repo-ai-scorecard',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
    },
    metadata: {
      description:
        'Prepare deterministic AI governance scorecards from health, violations, and drift trend signals.',
    },
  },
  'repo-ai-onboarding': {
    executor: '@anarchitects/nx-governance:repo-ai-onboarding',
    options: {
      profile: GOVERNANCE_DEFAULT_PROFILE_NAME,
      output: 'json',
      topViolations: 10,
      topProjects: 5,
    },
    metadata: {
      description:
        'Prepare deterministic AI onboarding briefs from inventory, dependency, and governance hotspot signals.',
    },
  },
};

export async function initGenerator(
  tree: Tree,
  options: InitSchema
): Promise<void> {
  const configureEslint = options.configureEslint ?? true;

  ensureNxPluginRegistration(tree);
  ensureRootTargets(tree);
  ensureProfileConfig(tree);

  if (configureEslint) {
    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: options.eslintConfigPath,
      governanceHelperPath: options.governanceHelperPath,
      profile: options.profile,
      profilePath: options.profilePath,
    });
  } else {
    logger.warn(
      'Nx Governance: ESLint integration generation was skipped. This makes ESLint the effective source of truth for boundaries and can drift from governance profiles, which is not recommended.'
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function ensureNxPluginRegistration(tree: Tree): void {
  updateJson<NxJson>(tree, 'nx.json', (json) => {
    const plugins = Array.isArray(json.plugins) ? [...json.plugins] : [];
    const alreadyRegistered = plugins.some((entry) =>
      typeof entry === 'string'
        ? entry === GOVERNANCE_PLUGIN_NAME
        : entry.plugin === GOVERNANCE_PLUGIN_NAME
    );

    if (!alreadyRegistered) {
      plugins.push({ plugin: GOVERNANCE_PLUGIN_NAME });
    }

    return {
      ...json,
      plugins,
    };
  });
}

function ensureRootTargets(tree: Tree): void {
  updateJson<RootPackageJson>(tree, 'package.json', (json) => {
    if (!json.nx) {
      json.nx = {};
    }

    if (!json.nx.targets) {
      json.nx.targets = {};
    }

    for (const [targetName, targetConfig] of Object.entries(
      GOVERNANCE_TARGETS
    )) {
      json.nx.targets[targetName] = mergeRootTarget(
        json.nx.targets[targetName] as RootTargetConfig | undefined,
        targetConfig
      );
    }

    return json;
  });
}

function mergeRootTarget(
  existingTarget: RootTargetConfig | undefined,
  defaultTarget: RootTargetConfig
): RootTargetConfig {
  const existingOptions = isRecord(existingTarget?.options)
    ? existingTarget.options
    : undefined;
  const defaultOptions = isRecord(defaultTarget.options)
    ? defaultTarget.options
    : undefined;
  const existingMetadata = isRecord(existingTarget?.metadata)
    ? existingTarget.metadata
    : undefined;
  const defaultMetadata = isRecord(defaultTarget.metadata)
    ? defaultTarget.metadata
    : undefined;

  return {
    ...defaultTarget,
    ...existingTarget,
    ...(defaultOptions || existingOptions
      ? {
          options: {
            ...(defaultOptions ?? {}),
            ...(existingOptions ?? {}),
          },
        }
      : {}),
    ...(defaultMetadata || existingMetadata
      ? {
          metadata: {
            ...(defaultMetadata ?? {}),
            ...(existingMetadata ?? {}),
          },
        }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureProfileConfig(tree: Tree): void {
  const filePath = resolveGovernanceProfileRelativePath(
    GOVERNANCE_DEFAULT_PROFILE_NAME
  );

  if (tree.exists(filePath)) {
    return;
  }

  writeJson(tree, filePath, createAngularCleanupStarterProfile());
}

export default initGenerator;
