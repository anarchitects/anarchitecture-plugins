import type { CreateNodesV2 } from '@nx/devkit';

const FILE_PATTERN = 'tools/governance/profiles/*.json';

const createNodesV2: CreateNodesV2 = [
  FILE_PATTERN,
  async () => {
    // Governance MVP exposes explicit root targets; inference hook stays no-op but valid.
    return [];
  },
];

export default {
  name: '@anarchitects/nx-governance/inference',
  createNodesV2,
};
