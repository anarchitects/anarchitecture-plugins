// SPDX-License-Identifier: MIT
import type { NxJsonConfiguration, TargetConfiguration } from '@nx/devkit';
import type { NestBuildOutputs } from './read-build-outputs';

/** Build inference uses public target configuration rather than a custom executor. */
export function createNestBuildTarget(
  projectRoot: string,
  namedInputs: NxJsonConfiguration['namedInputs'],
  buildTargetName = 'build',
  buildOutputs: NestBuildOutputs = {
    outputs: ['{projectRoot}/dist'],
    configInputs: [],
  }
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
      // Without an explicit filter Nx hashes all external dependencies, including
      // installed tsconfig packages and their transitive base configurations.
      ...(buildOutputs.usesPackageConfigs
        ? []
        : [{ externalDependencies: ['@nestjs/cli'] }]),
      // Hash shared TypeScript settings without depending on private Nx helpers.
      ...new Set([
        '{workspaceRoot}/tsconfig.json',
        '{workspaceRoot}/tsconfig.base.json',
        ...buildOutputs.configInputs,
      ]),
    ],
    outputs: buildOutputs.outputs,
    metadata: {
      technologies: ['nest'],
      description: 'Build the Nest project.',
    },
  };
}
