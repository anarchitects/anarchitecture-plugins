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
  testPathIgnorePatterns: [
    '/src/health-engine/',
    '/src/metric-engine/',
    '/src/policy-engine/',
    '/src/signal-engine/',
    '/src/inventory/',
    '/src/ai-analysis/',
    '/src/delivery-impact/',
    '/src/core/',
    '/src/standalone-cli/',
    '/src/typescript-adapter/',
    '/src/manual-workspace/',
    '/src/plugin/apply-governance-exceptions.spec.ts',
    '/src/plugin/build-exception-report.spec.ts',
    '/src/plugin/evaluate-exception-lifecycle.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
