import { readFileSync } from 'node:fs';
import {
  NEST_CLI_PACKAGE_NAME,
  NEST_CLI_VERSION,
  NEST_COMMON_PACKAGE,
  NEST_CORE_PACKAGE,
  NEST_PLATFORM_EXPRESS_PACKAGE,
  NEST_SCHEMATICS_PACKAGE_NAME,
  NEST_SCHEMATICS_VERSION,
  NEST_TESTING_PACKAGE,
  NEST_VERSION,
} from './nest-version.js';
import {
  REFLECT_METADATA_PACKAGE,
  REFLECT_METADATA_VERSION,
  RXJS_PACKAGE,
  RXJS_VERSION,
  nestDevDependencies,
  nestRuntimeDependencies,
} from './nest-dependencies.js';

describe('nest dependencies', () => {
  it('defines the expected runtime dependency group', () => {
    expect(nestRuntimeDependencies).toEqual({
      [NEST_COMMON_PACKAGE]: NEST_VERSION,
      [NEST_CORE_PACKAGE]: NEST_VERSION,
      [NEST_PLATFORM_EXPRESS_PACKAGE]: NEST_VERSION,
      [REFLECT_METADATA_PACKAGE]: REFLECT_METADATA_VERSION,
      [RXJS_PACKAGE]: RXJS_VERSION,
    });
  });

  it('uses the centralized Nest runtime version value', () => {
    expect(nestRuntimeDependencies[NEST_COMMON_PACKAGE]).toBe(NEST_VERSION);
    expect(nestRuntimeDependencies[NEST_CORE_PACKAGE]).toBe(NEST_VERSION);
    expect(nestRuntimeDependencies[NEST_PLATFORM_EXPRESS_PACKAGE]).toBe(
      NEST_VERSION
    );
  });

  it('defines the expected dev dependency group', () => {
    expect(nestDevDependencies).toEqual({
      [NEST_CLI_PACKAGE_NAME]: NEST_CLI_VERSION,
      [NEST_SCHEMATICS_PACKAGE_NAME]: NEST_SCHEMATICS_VERSION,
      [NEST_TESTING_PACKAGE]: NEST_VERSION,
    });
  });

  it('does not include optional add-on dependencies', () => {
    const dependencyKeys = [
      ...Object.keys(nestRuntimeDependencies),
      ...Object.keys(nestDevDependencies),
    ];

    expect(dependencyKeys).not.toEqual(
      expect.arrayContaining([
        '@nestjs/platform-fastify',
        '@nestjs/swagger',
        '@swc/core',
        '@swc-node/register',
        'zod',
      ])
    );
  });

  it('exports stable reusable dependency objects', () => {
    expect(Object.isFrozen(nestRuntimeDependencies)).toBe(true);
    expect(Object.isFrozen(nestDevDependencies)).toBe(true);
    expect(Object.keys(nestRuntimeDependencies)).toHaveLength(5);
    expect(Object.keys(nestDevDependencies)).toHaveLength(3);
  });

  it('imports Nest package identifiers and version values from nest-version.ts', () => {
    const source = readFileSync(
      new URL('./nest-dependencies.ts', import.meta.url),
      'utf-8'
    );

    expect(source).toContain('./nest-version.js');
    expect(source).not.toContain("'@nestjs/common'");
    expect(source).not.toContain("'@nestjs/core'");
    expect(source).not.toContain("'@nestjs/platform-express'");
    expect(source).not.toContain("'@nestjs/testing'");
    expect(source).not.toContain("'@nestjs/cli'");
    expect(source).not.toContain("'@nestjs/schematics'");
    expect(source).not.toContain("'next'");
  });
});
