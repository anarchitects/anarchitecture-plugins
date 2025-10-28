import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the SWC transformation config that Jest should use for specs.
const swcJestConfig = JSON.parse(
  readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);

// Disable SWC's own .swcrc lookup since we already provide the config.
swcJestConfig.swcrc = false;

const config = {
  displayName: 'nx-typeorm',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};

export default config;
