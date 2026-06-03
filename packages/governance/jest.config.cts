import { readFileSync } from 'fs';

const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

swcJestConfig.swcrc = false;

export default {
  displayName: 'nx-governance',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:@anarchitects/governance-core|@anarchitects/governance-adapter-nx)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
