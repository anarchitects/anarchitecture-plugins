import baseConfig from '../../eslint.config.mjs';

const adapterImplementationFiles = ['src/**/*.ts'];
const adapterImplementationIgnores = ['**/*.spec.ts', '**/*.test.ts'];

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredDependencies: ['nx'],
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
  {
    files: adapterImplementationFiles,
    ignores: adapterImplementationIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@anarchitects/nx-governance',
              message:
                'The Nx adapter package must not depend on Nx host package internals.',
            },
          ],
          patterns: [
            {
              group: [
                '@anarchitects/nx-governance/*',
                '@anarchitects/governance-core/*',
                '**/governance/src/core/**',
                '**/governance/src/plugin/**',
                '**/governance/src/executors/**',
                '**/governance/src/generators/**',
                '**/governance/src/nx-host/**',
                '**/governance/src/standalone-cli/**',
                '**/governance/src/typescript-adapter/**',
                '**/governance/src/manual-workspace/**',
                '**/anarchitecture-community/**',
              ],
              message:
                'The Nx adapter package must depend on published Governance Core and stay isolated from monolithic host internals.',
            },
          ],
        },
      ],
    },
  },
];
