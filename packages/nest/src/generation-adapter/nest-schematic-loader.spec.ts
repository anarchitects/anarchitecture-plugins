import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import {
  NEST_SCHEMATICS_PACKAGE,
  NEST_SCHEMATICS_PACKAGE_NAME,
} from '../utils/nest-version.js';
import {
  assertRequiredNestSchematicsAvailable,
  loadNestSchematicsCollectionInfo,
  resolveNestSchematicsCollectionPath,
} from './nest-schematic-loader.js';

const require = createRequire(import.meta.url);

describe('nest schematic loader', () => {
  it('resolves the Nest schematics collection path', () => {
    const packageJsonPath = require.resolve(
      `${NEST_SCHEMATICS_PACKAGE_NAME}/package.json`
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      schematics: string;
    };

    expect(resolveNestSchematicsCollectionPath()).toBe(
      resolve(dirname(packageJsonPath), packageJson.schematics)
    );
  });

  it('loads Nest schematics collection info', () => {
    const info = loadNestSchematicsCollectionInfo();

    expect(info.collectionPath).toBe(resolveNestSchematicsCollectionPath());
    expect(info.availableSchematics).toContain('application');
    expect(info.availableSchematics.length).toBeGreaterThan(0);
  });

  it('discovers the required Nest schematics', () => {
    const info = loadNestSchematicsCollectionInfo();

    expect(info.availableSchematics).toEqual(
      expect.arrayContaining(['application', 'library', 'resource'])
    );
    expect(() =>
      assertRequiredNestSchematicsAvailable(info.availableSchematics)
    ).not.toThrow();
  });

  it('reports missing required schematics clearly', () => {
    expect(() =>
      assertRequiredNestSchematicsAvailable(['application', 'library'])
    ).toThrow(/missing required schematics: resource/i);
  });

  it('uses centralized Nest package constants', () => {
    const source = readFileSync(
      new URL('./nest-schematic-loader.ts', import.meta.url),
      'utf-8'
    );

    expect(source).toContain('NEST_SCHEMATICS_PACKAGE_NAME');
    expect(source).toContain('NEST_SCHEMATICS_PACKAGE');
    expect(source).toContain('../utils/nest-version.js');
    expect(source).not.toContain(`'${NEST_SCHEMATICS_PACKAGE_NAME}'`);
    expect(NEST_SCHEMATICS_PACKAGE).toContain('@next');
  });
});
