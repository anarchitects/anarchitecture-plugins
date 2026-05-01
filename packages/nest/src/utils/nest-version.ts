/**
 * Central Nest package/version alignment for the Nx Nest plugin.
 *
 * Epic #116 targets Nest v12 prerelease behavior. Until Nest v12 is stable,
 * generation-adapter code should use these constants instead of hardcoding
 * `@nestjs/schematics@next` or `@nestjs/cli@next`.
 */

export const NEST_SCHEMATICS_PACKAGE_NAME = '@nestjs/schematics';
export const NEST_SCHEMATICS_PACKAGE = `${NEST_SCHEMATICS_PACKAGE_NAME}@next`;

export const NEST_CLI_PACKAGE_NAME = '@nestjs/cli';
export const NEST_CLI_PACKAGE = `${NEST_CLI_PACKAGE_NAME}@next`;
