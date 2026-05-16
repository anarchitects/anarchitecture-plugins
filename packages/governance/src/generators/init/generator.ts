import { formatFiles, logger, Tree, updateJson, writeJson } from '@nx/devkit';
import {
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_LEGACY_PROFILE_NAME,
  resolveGovernanceProfileRelativePath,
  resolveGovernanceSelectedProfileRelativePath,
} from '../../profile/runtime-profile.js';
import {
  BACKEND_LAYERED_3TIER_PRESET_NAME,
  BACKEND_LAYERED_DDD_PRESET_NAME,
  createBuiltInGovernanceStarterProfile,
  type GovernanceStarterPresetName,
  resolveGovernanceStarterPresetName,
} from '../../presets/registry.js';
import { eslintIntegrationGenerator } from '../eslint-integration/generator.js';

interface InitSchema {
  configureEslint?: boolean;
  eslintConfigPath?: string;
  governanceHelperPath?: string;
  preset?: GovernanceStarterPresetName | GovernanceStarterPresetName[];
  profile?: string;
  profilePath?: string;
  targetPreset?: 'minimal' | 'full';
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

interface ResolvedInitOptions {
  configureEslint: boolean;
  profilePath?: string;
  selectedProfileName: string;
  selectedProfilePath: string;
  starterProfileSeeds: StarterProfileSeed[];
  targetPreset: 'minimal' | 'full';
}

interface StarterProfileSeed {
  profileName: string;
  profilePath: string;
  starterPreset: GovernanceStarterPresetName;
}

const GOVERNANCE_GRAPH_TARGET = {
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
} satisfies Record<string, RootTargetConfig>;

const STATIC_GOVERNANCE_TARGETS = {
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
} satisfies Record<string, RootTargetConfig>;

function createGovernanceProfileTarget(
  executorName: string,
  profileName: string,
  description: string,
  options: Record<string, unknown> = {}
): RootTargetConfig {
  return {
    executor: `@anarchitects/nx-governance:${executorName}`,
    options: {
      profile: profileName,
      ...options,
    },
    metadata: {
      description,
    },
  };
}

function createGovernanceTargets(
  profileName: string,
  targetPreset: 'minimal' | 'full'
): Record<string, RootTargetConfig> {
  const minimalTargets = {
    'repo-health': createGovernanceProfileTarget(
      'repo-health',
      profileName,
      'Run governance health assessment for the workspace.',
      {
        output: 'cli',
      }
    ),
    ...GOVERNANCE_GRAPH_TARGET,
  } satisfies Record<string, RootTargetConfig>;

  if (targetPreset === 'minimal') {
    return minimalTargets;
  }

  return {
    ...minimalTargets,
    'repo-boundaries': createGovernanceProfileTarget(
      'repo-boundaries',
      profileName,
      'Run governance boundary checks for the workspace.',
      {
        output: 'cli',
      }
    ),
    'repo-ownership': createGovernanceProfileTarget(
      'repo-ownership',
      profileName,
      'Run governance ownership checks for the workspace.',
      {
        output: 'cli',
      }
    ),
    'repo-architecture': createGovernanceProfileTarget(
      'repo-architecture',
      profileName,
      'Run governance architecture checks for the workspace.',
      {
        output: 'cli',
      }
    ),
    'repo-snapshot': createGovernanceProfileTarget(
      'repo-snapshot',
      profileName,
      'Persist governance metric snapshots for drift and AI analysis.',
      {
        output: 'cli',
      }
    ),
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
    'repo-management-insights': createGovernanceProfileTarget(
      'repo-management-insights',
      profileName,
      'Render management-facing delivery-impact insights derived from governance signals.',
      {
        output: 'cli',
      }
    ),
    ...STATIC_GOVERNANCE_TARGETS,
    'repo-ai-root-cause': createGovernanceProfileTarget(
      'repo-ai-root-cause',
      profileName,
      'Prepare deterministic root-cause payloads for AI interpretation based on governance snapshots.',
      {
        output: 'json',
        topViolations: 10,
      }
    ),
    'repo-ai-drift': createGovernanceProfileTarget(
      'repo-ai-drift',
      profileName,
      'Prepare deterministic drift interpretation payloads from snapshot deltas and trend signals.',
      {
        output: 'json',
      }
    ),
    'repo-ai-pr-impact': createGovernanceProfileTarget(
      'repo-ai-pr-impact',
      profileName,
      'Prepare deterministic PR architectural impact payloads for AI interpretation.',
      {
        output: 'json',
        baseRef: 'main',
        headRef: 'HEAD',
      }
    ),
    'repo-ai-cognitive-load': createGovernanceProfileTarget(
      'repo-ai-cognitive-load',
      profileName,
      'Prepare deterministic cognitive-load analysis payloads from dependency and domain coupling signals.',
      {
        output: 'json',
        topProjects: 10,
      }
    ),
    'repo-ai-recommendations': createGovernanceProfileTarget(
      'repo-ai-recommendations',
      profileName,
      'Prepare deterministic architecture recommendations from violations, dependencies, and trend signals.',
      {
        output: 'json',
        topViolations: 10,
      }
    ),
    'repo-ai-smell-clusters': createGovernanceProfileTarget(
      'repo-ai-smell-clusters',
      profileName,
      'Prepare deterministic architecture smell cluster analysis from prioritized violations and snapshot persistence signals.',
      {
        output: 'json',
        topViolations: 10,
      }
    ),
    'repo-ai-refactoring-suggestions': createGovernanceProfileTarget(
      'repo-ai-refactoring-suggestions',
      profileName,
      'Prepare deterministic AI refactoring suggestions from hotspot, fanout, and persistent smell signals.',
      {
        output: 'json',
        topViolations: 10,
        topProjects: 5,
      }
    ),
    'repo-ai-scorecard': createGovernanceProfileTarget(
      'repo-ai-scorecard',
      profileName,
      'Prepare deterministic AI governance scorecards from health, violations, and drift trend signals.',
      {
        output: 'json',
      }
    ),
    'repo-ai-onboarding': createGovernanceProfileTarget(
      'repo-ai-onboarding',
      profileName,
      'Prepare deterministic AI onboarding briefs from inventory, dependency, and governance hotspot signals.',
      {
        output: 'json',
        topViolations: 10,
        topProjects: 5,
      }
    ),
  };
}

export async function initGenerator(
  tree: Tree,
  options: InitSchema
): Promise<void> {
  const resolved = resolveInitOptions(options);

  ensureNxPluginRegistration(tree);
  ensureRootPackageJsonFile(tree);
  ensureRootTargets(tree, resolved);
  ensureProfileConfig(tree, resolved);

  if (resolved.configureEslint) {
    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: options.eslintConfigPath,
      governanceHelperPath: options.governanceHelperPath,
      profile: resolved.selectedProfileName,
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

function resolveInitOptions(options: InitSchema): ResolvedInitOptions {
  const builtInProfilePreset = resolveGovernanceStarterPresetName(
    options.profile
  );
  const starterPresets = resolveStarterPresetSelections(
    options.preset,
    builtInProfilePreset
  );
  const selectedProfileName =
    options.profile ?? starterPresets[0] ?? GOVERNANCE_DEFAULT_PROFILE_NAME;
  const selectedProfilePath = resolveGovernanceSelectedProfileRelativePath({
    profile: selectedProfileName,
    profilePath: options.profilePath,
  });
  const selectedProfilePreset =
    builtInProfilePreset ??
    starterPresets[0] ??
    GOVERNANCE_DEFAULT_PROFILE_NAME;

  return {
    configureEslint: options.configureEslint ?? true,
    profilePath: options.profilePath,
    selectedProfileName,
    selectedProfilePath,
    starterProfileSeeds: buildStarterProfileSeeds(
      selectedProfileName,
      selectedProfilePath,
      selectedProfilePreset,
      starterPresets
    ),
    targetPreset: options.targetPreset ?? 'minimal',
  };
}

function resolveStarterPresetSelections(
  presetOption: InitSchema['preset'],
  builtInProfilePreset: GovernanceStarterPresetName | null
): GovernanceStarterPresetName[] {
  const rawSelections = Array.isArray(presetOption)
    ? presetOption
    : presetOption
    ? [presetOption]
    : [];
  const normalizedSelections = dedupeStarterPresets(
    rawSelections.map((selection) => {
      const normalized = resolveGovernanceStarterPresetName(selection);

      if (!normalized) {
        throw new Error(`Unsupported governance starter preset: ${selection}.`);
      }

      return normalized;
    })
  );
  const activatedPresets = builtInProfilePreset
    ? dedupeStarterPresets([...normalizedSelections, builtInProfilePreset])
    : normalizedSelections;

  validateStarterPresetSelections(activatedPresets);

  if (normalizedSelections.length > 0) {
    return normalizedSelections;
  }

  return [builtInProfilePreset ?? GOVERNANCE_DEFAULT_PROFILE_NAME];
}

function dedupeStarterPresets(
  presets: GovernanceStarterPresetName[]
): GovernanceStarterPresetName[] {
  return Array.from(new Set(presets));
}

function validateStarterPresetSelections(
  presets: GovernanceStarterPresetName[]
): void {
  if (
    presets.includes(BACKEND_LAYERED_3TIER_PRESET_NAME) &&
    presets.includes(BACKEND_LAYERED_DDD_PRESET_NAME)
  ) {
    throw new Error(
      `${BACKEND_LAYERED_3TIER_PRESET_NAME} and ${BACKEND_LAYERED_DDD_PRESET_NAME} are mutually exclusive. Choose one backend architecture preset.`
    );
  }
}

function buildStarterProfileSeeds(
  selectedProfileName: string,
  selectedProfilePath: string,
  selectedProfilePreset: GovernanceStarterPresetName,
  starterPresets: GovernanceStarterPresetName[]
): StarterProfileSeed[] {
  const seeds: StarterProfileSeed[] = [
    {
      profileName: selectedProfileName,
      profilePath: selectedProfilePath,
      starterPreset: selectedProfilePreset,
    },
  ];

  for (const preset of starterPresets) {
    const profilePath = resolveGovernanceProfileRelativePath(preset);

    if (profilePath === selectedProfilePath) {
      continue;
    }

    seeds.push({
      profileName: preset,
      profilePath,
      starterPreset: preset,
    });
  }

  return seeds;
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

function ensureRootPackageJsonFile(tree: Tree): void {
  if (!tree.exists('package.json')) {
    writeJson(tree, 'package.json', {});
  }
}

function ensureRootTargets(tree: Tree, options: ResolvedInitOptions): void {
  updateJson<RootPackageJson>(tree, 'package.json', (json) => {
    if (!json.nx) {
      json.nx = {};
    }

    if (!json.nx.targets) {
      json.nx.targets = {};
    }

    for (const [targetName, targetConfig] of Object.entries(
      createGovernanceTargets(options.selectedProfileName, options.targetPreset)
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

function ensureProfileConfig(tree: Tree, options: ResolvedInitOptions): void {
  const defaultProfilePath = resolveGovernanceProfileRelativePath(
    GOVERNANCE_DEFAULT_PROFILE_NAME
  );
  const legacyProfilePath = resolveGovernanceProfileRelativePath(
    GOVERNANCE_LEGACY_PROFILE_NAME
  );

  for (const seed of options.starterProfileSeeds) {
    if (tree.exists(seed.profilePath)) {
      continue;
    }

    if (
      !options.profilePath &&
      ((seed.profileName === GOVERNANCE_DEFAULT_PROFILE_NAME &&
        tree.exists(legacyProfilePath)) ||
        (seed.profileName === GOVERNANCE_LEGACY_PROFILE_NAME &&
          tree.exists(defaultProfilePath)))
    ) {
      continue;
    }

    writeJson(
      tree,
      seed.profilePath,
      createBuiltInGovernanceStarterProfile(seed.starterPreset)
    );
  }
}

export default initGenerator;
