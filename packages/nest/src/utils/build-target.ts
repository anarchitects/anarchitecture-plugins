// SPDX-License-Identifier: MIT
import type { NxJsonConfiguration, TargetConfiguration } from '@nx/devkit';

/** Build inference uses public target configuration rather than a custom executor. */
export function createNestBuildTarget(
  projectRoot: string,
  namedInputs: NxJsonConfiguration['namedInputs'],
  buildTargetName = 'build'
): TargetConfiguration {
  if (typeof buildTargetName !== 'string' || buildTargetName.trim() === '') {
    throw new Error('Nest plugin buildTargetName must be a non-empty string.');
  }

  const inputName = Object.prototype.hasOwnProperty.call(
    namedInputs ?? {},
    'production'
  )
    ? 'production'
    : 'default';

  return {
    command: 'nest build',
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      inputName,
      `^${inputName}`,
      { externalDependencies: ['@nestjs/cli'] },
      // Hash shared TypeScript settings without depending on private Nx helpers.
      '{workspaceRoot}/tsconfig.json',
      '{workspaceRoot}/tsconfig.base.json',
    ],
    // Effective tsconfig/output resolution follows in #482.
    outputs: ['{projectRoot}/dist'],
    metadata: {
      technologies: ['nest'],
      description: 'Build the Nest project.',
    },
  };
}
