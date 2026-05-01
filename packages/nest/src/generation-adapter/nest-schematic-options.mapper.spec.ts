import { readFileSync } from 'node:fs';
import {
  mapApplicationOptionsToNestSchematicOptions,
  mapLibraryOptionsToNestSchematicOptions,
  mapResourceOptionsToNestSchematicOptions,
} from './nest-schematic-options.mapper.js';

describe('nest schematic options mapper', () => {
  it('maps application name and module system to the v12 schema fields', () => {
    expect(
      mapApplicationOptionsToNestSchematicOptions({
        name: 'api',
        moduleSystem: 'esm',
      })
    ).toEqual({
      name: 'api',
      type: 'esm',
    });
  });

  it('maps application strict mode and supported flags only', () => {
    expect(
      mapApplicationOptionsToNestSchematicOptions({
        name: 'api',
        directory: 'apps/api',
        strict: true,
        packageManager: 'yarn',
        spec: false,
        skipInstall: true,
        skipGit: true,
      })
    ).toEqual({
      name: 'api',
      directory: 'apps/api',
      strict: true,
      packageManager: 'yarn',
      spec: false,
    });
  });

  it('maps library name and path fields to the v12 schema fields', () => {
    expect(
      mapLibraryOptionsToNestSchematicOptions({
        name: 'data-access',
        directory: 'libs',
        rootDir: 'packages',
        prefix: '@app',
      })
    ).toEqual({
      name: 'data-access',
      path: 'libs',
      rootDir: 'packages',
      prefix: '@app',
    });
  });

  it('maps resource fields to the v12 schema fields', () => {
    expect(
      mapResourceOptionsToNestSchematicOptions({
        name: 'users',
        path: 'apps/api/src',
        sourceRoot: 'apps/api/src',
        type: 'graphql-code-first',
        crud: false,
        spec: false,
        flat: true,
      })
    ).toEqual({
      name: 'users',
      path: 'apps/api/src',
      sourceRoot: 'apps/api/src',
      type: 'graphql-code-first',
      crud: false,
      spec: false,
      flat: true,
    });
  });

  it('omits unsupported Nx-facing options instead of inventing Nest options', () => {
    expect(
      mapLibraryOptionsToNestSchematicOptions({
        name: 'shared',
        strict: true,
      })
    ).toEqual({
      name: 'shared',
    });
  });

  it('throws a clear error for an empty name', () => {
    expect(() =>
      mapResourceOptionsToNestSchematicOptions({
        name: '   ',
      })
    ).toThrow(/require a non-empty "name"/i);
  });

  it('keeps mapping functions pure and does not mutate inputs', () => {
    const options = {
      name: 'users',
      path: 'apps/api/src',
      sourceRoot: 'apps/api/src',
      type: 'rest' as const,
      crud: true,
      spec: true,
      flat: false,
    };
    const snapshot = structuredClone(options);

    mapResourceOptionsToNestSchematicOptions(options);

    expect(options).toEqual(snapshot);
  });

  it('does not execute schematics, use Tree operations, or duplicate Nest package identifiers', () => {
    const source = readFileSync(
      new URL('./nest-schematic-options.mapper.ts', import.meta.url),
      'utf-8'
    );

    expect(source).not.toContain('runNestSchematic');
    expect(source).not.toContain('tree.write');
    expect(source).not.toContain('@nestjs/schematics');
    expect(source).not.toContain('nest-version');
  });
});
