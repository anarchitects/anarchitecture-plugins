import {
  createNodesFromFiles,
  type CreateNodesContextV2,
  type CreateNodesResult,
  type CreateNodesV2,
} from '@nx/devkit';
import { minimatch } from 'minimatch';
import { posix } from 'node:path';

const DEFAULT_PROFILE_GLOB = 'tools/governance/profiles/*.json';
const DEFAULT_PROFILE_NAME = 'frontend-layered';
const INFERRED_TARGET_INPUTS = [
  'default',
  '{workspaceRoot}/tools/governance/**/*',
  '{workspaceRoot}/nx.json',
] as const;
const INFERRED_TARGET_NAMES = [
  'repo-health',
  'repo-boundaries',
  'repo-ownership',
  'repo-architecture',
] as const;

export interface GovernancePluginOptions {
  profileGlob?: string;
}

export const createNodesV2: CreateNodesV2<GovernancePluginOptions> = [
  DEFAULT_PROFILE_GLOB,
  async (profileFiles, options, context) => {
    const filteredProfileFiles = filterProfileFiles(profileFiles, options);

    if (filteredProfileFiles.length === 0) {
      return [];
    }

    const selectedProfileFile = resolveDefaultProfileFile(filteredProfileFiles);

    return createNodesFromFiles(
      (profileFilePath, pluginOptions, pluginContext) =>
        createGovernanceNodesFromProfile(
          profileFilePath,
          selectedProfileFile,
          pluginOptions,
          pluginContext
        ),
      filteredProfileFiles,
      options,
      context
    );
  },
];

export default {
  name: '@anarchitects/nx-governance/inference',
  createNodesV2,
};

function createGovernanceNodesFromProfile(
  profileFilePath: string,
  selectedProfileFile: string,
  _options: GovernancePluginOptions | undefined,
  _context: CreateNodesContextV2 & { configFiles: readonly string[] }
): CreateNodesResult {
  if (normalizeRelativePath(profileFilePath) !== selectedProfileFile) {
    return {};
  }

  const selectedProfileName = profileNameFromFilePath(selectedProfileFile);

  return {
    projects: {
      '.': {
        targets: Object.fromEntries(
          INFERRED_TARGET_NAMES.map((targetName) => [
            targetName,
            {
              executor: `@anarchitects/nx-governance:${targetName}`,
              cache: true,
              inputs: [...INFERRED_TARGET_INPUTS],
              outputs: [],
              options: {
                profile: selectedProfileName,
                output: 'cli',
              },
            },
          ])
        ),
      },
    },
  };
}

function filterProfileFiles(
  profileFiles: readonly string[],
  options: GovernancePluginOptions | undefined
): string[] {
  const normalizedProfileGlob =
    typeof options?.profileGlob === 'string' &&
    options.profileGlob.trim() !== ''
      ? normalizeRelativePath(options.profileGlob.trim())
      : DEFAULT_PROFILE_GLOB;

  return profileFiles
    .map(normalizeRelativePath)
    .filter((profileFile) => minimatch(profileFile, normalizedProfileGlob))
    .sort((left, right) => left.localeCompare(right));
}

function resolveDefaultProfileFile(profileFiles: readonly string[]): string {
  const preferredDefault = profileFiles.find(
    (profileFile) =>
      profileNameFromFilePath(profileFile) === DEFAULT_PROFILE_NAME
  );

  return (
    preferredDefault ?? [...profileFiles].sort((a, b) => a.localeCompare(b))[0]
  );
}

function profileNameFromFilePath(profileFilePath: string): string {
  return posix.basename(normalizeRelativePath(profileFilePath), '.json');
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
