/**
 * Central Nest package/version alignment for the Nx Nest plugin.
 *
 * Epic #116 targets Nest v12 prerelease behavior. Until Nest v12 is stable,
 * generation-adapter code should use these constants instead of hardcoding
 * `@nestjs/schematics@next` or `@nestjs/cli@next`.
 */

export const ANARCHITECTS_NEST_PLUGIN_PACKAGE = '@anarchitects/nest';

export const NEST_VERSION = 'next';

export const NEST_COMMON_PACKAGE = '@nestjs/common';
export const NEST_CORE_PACKAGE = '@nestjs/core';
export const NEST_PLATFORM_EXPRESS_PACKAGE = '@nestjs/platform-express';
export const NEST_TESTING_PACKAGE = '@nestjs/testing';

export const NEST_SCHEMATICS_PACKAGE_NAME = '@nestjs/schematics';
export const NEST_SCHEMATICS_VERSION = NEST_VERSION;
export const NEST_SCHEMATICS_PACKAGE = `${NEST_SCHEMATICS_PACKAGE_NAME}@${NEST_SCHEMATICS_VERSION}`;

export const NEST_CLI_PACKAGE_NAME = '@nestjs/cli';
export const NEST_CLI_VERSION = NEST_VERSION;
export const NEST_CLI_PACKAGE = `${NEST_CLI_PACKAGE_NAME}@${NEST_CLI_VERSION}`;
export const NEST_CLI_BIN = 'nest';
