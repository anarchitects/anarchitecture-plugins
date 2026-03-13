import {
  formatFiles,
  logger,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { eslintIntegrationGenerator } from '../eslint-integration/generator.js';

interface InitSchema {
  configureEslint?: boolean;
  skipFormat?: boolean;
}

interface RootPackageJson {
  nx?: {
    targets?: Record<string, unknown>;
  };
}

interface NxJson {
  plugins?: Array<string | { plugin: string; options?: Record<string, unknown> }>;
}

const GOVERNANCE_PLUGIN_NAME = '@anarchitects/nx-governance';

const GOVERNANCE_TARGETS = {
  'repo-health': {
    executor: '@anarchitects/nx-governance:repo-health',
    options: {
      profile: 'angular-cleanup',
      output: 'cli',
    },
    metadata: {
      description: 'Run governance health assessment for the workspace.',
    },
  },
  'repo-boundaries': {
    executor: '@anarchitects/nx-governance:repo-boundaries',
    options: {
      profile: 'angular-cleanup',
      output: 'cli',
    },
    metadata: {
      description: 'Run governance boundary checks for the workspace.',
    },
  },
  'repo-ownership': {
    executor: '@anarchitects/nx-governance:repo-ownership',
    options: {
      profile: 'angular-cleanup',
      output: 'cli',
    },
    metadata: {
      description: 'Run governance ownership checks for the workspace.',
    },
  },
  'repo-architecture': {
    executor: '@anarchitects/nx-governance:repo-architecture',
    options: {
      profile: 'angular-cleanup',
      output: 'cli',
    },
    metadata: {
      description: 'Run governance architecture checks for the workspace.',
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
    await eslintIntegrationGenerator(tree, { skipFormat: true });
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

    for (const [targetName, targetConfig] of Object.entries(GOVERNANCE_TARGETS)) {
      json.nx.targets[targetName] = {
        ...(json.nx.targets[targetName] as Record<string, unknown>),
        ...targetConfig,
      };
    }

    return json;
  });
}

function ensureProfileConfig(tree: Tree): void {
  const filePath = 'tools/governance/profiles/angular-cleanup.json';

  if (tree.exists(filePath)) {
    return;
  }

  writeJson(tree, filePath, {
    boundaryPolicySource: 'eslint',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': ['shared'],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
    },
    metrics: {
      architecturalEntropyWeight: 0.2,
      dependencyComplexityWeight: 0.2,
      domainIntegrityWeight: 0.2,
      ownershipCoverageWeight: 0.2,
      documentationCompletenessWeight: 0.2,
    },
    projectOverrides: {},
  });
}

export default initGenerator;
