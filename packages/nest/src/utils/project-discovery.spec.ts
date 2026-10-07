// SPDX-License-Identifier: MIT
import { getNestProjectRoot, hasProjectManifest } from './project-discovery';

describe('Nest project discovery rules', () => {
  it.each([
    ['nest-cli.json', '.'],
    ['./nest-cli.json', '.'],
    ['apps/api/nest-cli.json', 'apps/api'],
    ['services/backend/apps/api/nest-cli.json', 'services/backend/apps/api'],
    ['apps\\api\\nest-cli.json', 'apps/api'],
    ['apps/api/tsconfig.json', undefined],
    ['apps/api/nest-cli.json.backup', undefined],
  ])('resolves %s to %s', (configFile, expected) => {
    expect(getNestProjectRoot(configFile)).toBe(expected);
  });

  it.each([
    [['package.json'], true],
    [['project.json'], true],
    [['package.json', 'project.json'], true],
    [['nest-cli.json', 'tsconfig.json'], false],
    [[], false],
  ])('recognizes sibling project manifests in %j', (files, expected) => {
    expect(hasProjectManifest(files as string[])).toBe(expected);
  });
});
