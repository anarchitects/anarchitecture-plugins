import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Resolve the directory both for CommonJS (tsc) and ESM (Jest runtime).
function resolveCurrentDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }

  const importMetaUrl = new Function('return import.meta.url')() as string;
  return dirname(fileURLToPath(importMetaUrl));
}

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(join(resolveCurrentDir(), '.spec.swcrc'), 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

export default {
  displayName: 'nx-js',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
