// SPDX-License-Identifier: MIT
import type { TargetConfiguration } from '@nx/devkit';

/** Nest owns startup; Nx schedules the long-running command without caching it. */
export function createNestStartTarget(
  projectRoot: string,
  startTargetName = 'start'
): TargetConfiguration {
  if (typeof startTargetName !== 'string' || startTargetName.trim() === '') {
    throw new Error('Nest plugin startTargetName must be a non-empty string.');
  }

  return {
    command: 'nest start',
    options: { cwd: projectRoot },
    continuous: true,
    cache: false,
    metadata: {
      technologies: ['nest'],
      description: 'Start the Nest project.',
    },
  };
}
