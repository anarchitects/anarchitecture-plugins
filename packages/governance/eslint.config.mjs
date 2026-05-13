import baseConfig from '../../eslint.config.mjs';

const governanceCoreCandidateFiles = [
  'src/core/**/*.ts',
  'src/policy-engine/**/*.ts',
  'src/signal-engine/**/*.ts',
  'src/metric-engine/**/*.ts',
  'src/health-engine/**/*.ts',
  'src/inventory/**/*.ts',
];

const governanceCoreCandidateIgnores = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.fixtures.ts',
];

const governanceCoreHostForbiddenImports = [
  'nx',
  '@nx/*',
  '../plugin',
  '../plugin/*',
  '../executors',
  '../executors/*',
  '../generators',
  '../generators/*',
];

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
    files: governanceCoreCandidateFiles,
    ignores: governanceCoreCandidateIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: governanceCoreHostForbiddenImports,
              message:
                'Internal Governance Core candidates must not depend on Nx packages or Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/core/**/*.ts',
      'src/policy-engine/**/*.ts',
      'src/metric-engine/**/*.ts',
      'src/health-engine/**/*.ts',
    ],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...governanceCoreHostForbiddenImports,
                '../nx-adapter',
                '../nx-adapter/*',
                '../conformance-adapter',
                '../conformance-adapter/*',
              ],
              message:
                'Core-facing governance modules must not depend on Nx adapter or conformance adapter modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...governanceCoreHostForbiddenImports,
                '../nx-adapter',
                '../nx-adapter/*',
                '../conformance-adapter',
                '../conformance-adapter/*',
                '../signal-engine',
                '../signal-engine/*',
              ],
              message:
                'Core contracts must not depend on signal-engine, adapter, or Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/models.ts'],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      // Temporary exception for #242. Core contracts still depend on signal
      // types defined outside src/core.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...governanceCoreHostForbiddenImports,
                '../nx-adapter',
                '../nx-adapter/*',
                '../conformance-adapter',
                '../conformance-adapter/*',
              ],
              message:
                'Core contracts must not depend on adapter or Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/exceptions.ts'],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      // Temporary exception for #242. Core exception contracts still depend on
      // conformance categories defined outside src/core.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...governanceCoreHostForbiddenImports,
                '../nx-adapter',
                '../nx-adapter/*',
                '../signal-engine',
                '../signal-engine/*',
              ],
              message:
                'Core contracts must not depend on adapter, signal-engine, or Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/signal-engine/builders.ts', 'src/signal-engine/types.ts'],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      // Temporary exceptions for #242 and #248. Signal contracts/builders still
      // consume conformance and Nx adapter shapes directly.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: governanceCoreHostForbiddenImports,
              message:
                'Signal engine modules must not depend on Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/inventory/build-inventory.ts'],
    ignores: governanceCoreCandidateIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...governanceCoreHostForbiddenImports,
                '../nx-adapter',
                '../nx-adapter/*',
              ],
              message:
                'Inventory normalization must not depend on Nx adapter or Nx host modules. See docs/governance/internal-core-boundary.md.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
