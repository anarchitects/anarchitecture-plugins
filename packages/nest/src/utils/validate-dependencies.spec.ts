// SPDX-License-Identifier: MIT
import { validateNestDependencies } from './validate-dependencies';

describe('Nest dependency validation', () => {
  it.each([
    '12.0.0',
    '^12.0.0',
    '~12.1.0',
    '12.x',
    '>=12 <13',
    '^12.0.0 || ~12.2.0',
  ])('accepts stable v12 range %s', (range) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': range } },
      })
    ).not.toThrow();
  });
  it.each([
    '^11',
    '^13',
    '12.0.0-alpha.5',
    '^12.1.0-beta.1',
    '*',
    '>=11 <13',
    '^11 || ^12',
    'latest',
    'next',
    'workspace:*',
    'file:../nest',
    'npm:@nestjs/cli@12.0.0',
    '<0.0.0',
  ])('rejects unsupported or unprovable CLI range %s', (range) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': range } },
      })
    ).toThrow('not a stable Nest v12 range');
  });
  it.each([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ])('validates framework declarations in %s', (section) => {
    expect(() =>
      validateNestDependencies({
        'package.json': { devDependencies: { '@nestjs/cli': '^12' } },
        'libs/shared/package.json': { [section]: { '@nestjs/core': '^11' } },
      })
    ).toThrow('libs/shared/package.json');
  });
  it('does not confuse independently versioned Nest integrations with the framework', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': {
          devDependencies: { '@nestjs/cli': '^12' },
          dependencies: { '@nestjs/swagger': '^11', '@nestjs/typeorm': '^12' },
        },
      })
    ).not.toThrow();
  });
  it('reports conflicting declarations instead of letting one dependency section hide another', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': {
          devDependencies: { '@nestjs/cli': '^12' },
          dependencies: { '@nestjs/cli': '^11' },
        },
      })
    ).toThrow('(dependencies): @nestjs/cli@^11');
  });
  it('does not count a CLI peer declaration as a workspace install', () => {
    expect(() =>
      validateNestDependencies({
        'package.json': { peerDependencies: { '@nestjs/cli': '^12' } },
      })
    ).toThrow('peer-only declaration');
  });
});
