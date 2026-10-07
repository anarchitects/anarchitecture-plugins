// SPDX-License-Identifier: MIT
import { createNestBuildTarget } from './build-target';

describe('Nest build target', () => {
  it.each([undefined, {}])(
    'falls back to default inputs with %j named inputs',
    (inputs) => {
      expect(createNestBuildTarget('.', inputs)).toEqual({
        command: 'nest build',
        options: { cwd: '.' },
        cache: true,
        dependsOn: ['^build'],
        inputs: [
          'default',
          '^default',
          { externalDependencies: ['@nestjs/cli'] },
          '{workspaceRoot}/tsconfig.json',
          '{workspaceRoot}/tsconfig.base.json',
        ],
        outputs: ['{projectRoot}/dist'],
        metadata: {
          technologies: ['nest'],
          description: 'Build the Nest project.',
        },
      });
    }
  );

  it('uses production inputs and matches dependency targets to a custom name', () => {
    const inputs = Object.freeze({ production: [] });
    expect(createNestBuildTarget('apps/api', inputs, 'compile')).toMatchObject({
      options: { cwd: 'apps/api' },
      dependsOn: ['^compile'],
      inputs: [
        'production',
        '^production',
        { externalDependencies: ['@nestjs/cli'] },
        '{workspaceRoot}/tsconfig.json',
        '{workspaceRoot}/tsconfig.base.json',
      ],
    });
    expect(inputs).toEqual({ production: [] });
  });

  it.each(['', '  '])('rejects an empty custom target name %j', (name) => {
    expect(() => createNestBuildTarget('.', {}, name)).toThrow(
      'buildTargetName must be a non-empty string'
    );
  });

  it('uses resolved outputs and config inputs, hashing all dependencies for package configs', () => {
    const target = createNestBuildTarget('apps/api', {}, 'build', {
      outputs: ['{workspaceRoot}/dist/api'],
      configInputs: [
        '{workspaceRoot}/tsconfig.base.json',
        '{workspaceRoot}/config/shared.json',
      ],
      usesPackageConfigs: true,
    });
    expect(target.outputs).toEqual(['{workspaceRoot}/dist/api']);
    expect(target.inputs).toEqual([
      'default',
      '^default',
      '{workspaceRoot}/tsconfig.json',
      '{workspaceRoot}/tsconfig.base.json',
      '{workspaceRoot}/config/shared.json',
    ]);
  });
});
