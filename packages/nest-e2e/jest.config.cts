// SPDX-License-Identifier: MIT
const { readFileSync } = require('node:fs');
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf8')
);
swcJestConfig.swcrc = false;
module.exports = {
  displayName: 'nx-nest-e2e',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: { '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig] },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: 'test-output/jest/coverage',
  testTimeout: 120_000,
};
