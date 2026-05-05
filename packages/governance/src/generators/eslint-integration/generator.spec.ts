import { logger, readJson, Tree } from '@nx/devkit';

import { GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH } from '../../profile/runtime-profile.js';
import eslintIntegrationGenerator from './generator.js';

let createTreeWithEmptyWorkspace:
  | typeof import('@nx/devkit/testing')['createTreeWithEmptyWorkspace']
  | undefined;

describe('eslintIntegrationGenerator', () => {
  let tree: Tree;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    if (!createTreeWithEmptyWorkspace) {
      throw new Error('createTreeWithEmptyWorkspace was not loaded.');
    }

    tree = createTreeWithEmptyWorkspace();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves existing default behavior with default options', async () => {
    tree.write(
      'eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify({ projectOverrides: {} }, null, 2)}\n`
    );

    await eslintIntegrationGenerator(tree, { skipFormat: true });

    expect(tree.exists(GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH)).toBe(true);
    expect(tree.read('eslint.config.mjs', 'utf8')).toContain(
      "import { governanceDepConstraints } from './tools/governance/eslint/dependency-constraints.mjs';"
    );
    expect(tree.read('eslint.config.mjs', 'utf8')).toContain(
      'depConstraints: governanceDepConstraints,'
    );
    expect(
      readJson(tree, 'tools/governance/profiles/angular-cleanup.json')
    ).toMatchObject({
      allowedDomainDependencies: {
        billing: ['shared'],
      },
      projectOverrides: {},
    });
  });

  it('autodetects eslint.config.cjs when no eslintConfigPath override is provided', async () => {
    tree.write(
      'eslint.config.cjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify({}, null, 2)}\n`
    );

    await eslintIntegrationGenerator(tree, { skipFormat: true });

    expect(tree.read('eslint.config.cjs', 'utf8')).toContain(
      "import { governanceDepConstraints } from './tools/governance/eslint/dependency-constraints.mjs';"
    );
    expect(tree.exists('eslint.config.mjs')).toBe(false);
  });

  it('uses a custom eslintConfigPath without falling back to the default file', async () => {
    tree.write(
      'config/eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify({}, null, 2)}\n`
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: 'config/eslint.config.mjs',
    });

    expect(tree.read('config/eslint.config.mjs', 'utf8')).toContain(
      "import { governanceDepConstraints } from '../tools/governance/eslint/dependency-constraints.mjs';"
    );
    expect(tree.exists('eslint.config.mjs')).toBe(false);
  });

  it('uses a custom governanceHelperPath and writes a correct relative import', async () => {
    tree.write(
      'config/eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify({}, null, 2)}\n`
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: 'config/eslint.config.mjs',
      governanceHelperPath: 'tools/custom/governance-helper.mjs',
    });

    expect(tree.exists('tools/custom/governance-helper.mjs')).toBe(true);
    expect(tree.read('config/eslint.config.mjs', 'utf8')).toContain(
      "import { governanceDepConstraints } from '../tools/custom/governance-helper.mjs';"
    );
    expect(
      readJson(tree, 'tools/governance/profiles/angular-cleanup.json')
    ).toMatchObject({
      eslint: {
        helperPath: 'tools/custom/governance-helper.mjs',
      },
    });
  });

  it('resolves a custom profile name to the expected profile path', async () => {
    tree.write(
      'eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      profile: 'workspace-policy',
    });

    expect(
      readJson(tree, 'tools/governance/profiles/workspace-policy.json')
    ).toMatchObject({
      boundaryPolicySource: 'eslint',
      allowedDomainDependencies: {
        billing: ['shared'],
      },
    });
  });

  it('uses profilePath directly when provided', async () => {
    tree.write(
      'eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      profilePath: 'tools/governance/profiles/custom/runtime.json',
    });

    expect(
      readJson(tree, 'tools/governance/profiles/custom/runtime.json')
    ).toMatchObject({
      boundaryPolicySource: 'eslint',
      allowedDomainDependencies: {
        billing: ['shared'],
      },
    });
    const helperContent =
      tree.read(GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH, 'utf8') ?? '';
    expect(helperContent).toContain('join(process.cwd(), ');
    expect(helperContent).toContain('tools/governance/profiles/custom');
  });

  it('warns and skips patching when a custom eslint config path is missing', async () => {
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify({}, null, 2)}\n`
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: 'config/eslint.config.mjs',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Nx Governance: config/eslint.config.mjs was not found. Skipping ESLint integration generation.'
    );
    expect(tree.exists(GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH)).toBe(true);
  });

  it('warns clearly when no supported flat eslint config can be autodetected', async () => {
    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Nx Governance: No supported flat ESLint config was found. Checked eslint.config.mjs, eslint.config.cjs, eslint.config.js. Legacy .eslintrc* config detection is intentionally out of scope; use eslintConfigPath for an explicit flat config path.'
    );
    expect(tree.exists(GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH)).toBe(true);
  });

  it('preserves and merges existing profile content when migrating constraints', async () => {
    tree.write(
      'eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );
    tree.write(
      'tools/governance/profiles/angular-cleanup.json',
      `${JSON.stringify(
        {
          allowedDomainDependencies: {
            billing: ['reporting'],
            shared: ['platform'],
          },
          ownership: {
            required: false,
            metadataField: 'ownership',
          },
        },
        null,
        2
      )}\n`
    );

    await eslintIntegrationGenerator(tree, { skipFormat: true });

    expect(
      readJson(tree, 'tools/governance/profiles/angular-cleanup.json')
    ).toMatchObject({
      allowedDomainDependencies: {
        billing: ['shared', 'reporting'],
        shared: ['platform'],
      },
      ownership: {
        required: false,
        metadataField: 'ownership',
      },
    });
  });

  it('is idempotent for custom eslint and helper paths', async () => {
    tree.write(
      'config/eslint.config.mjs',
      buildFlatConfigWithInlineConstraints('depConstraints')
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: 'config/eslint.config.mjs',
      governanceHelperPath: 'tools/custom/governance-helper.mjs',
      profile: 'workspace-policy',
    });

    const firstConfig = tree.read('config/eslint.config.mjs', 'utf8');
    const firstHelper = tree.read('tools/custom/governance-helper.mjs', 'utf8');
    const firstProfile = tree.read(
      'tools/governance/profiles/workspace-policy.json',
      'utf8'
    );

    await eslintIntegrationGenerator(tree, {
      skipFormat: true,
      eslintConfigPath: 'config/eslint.config.mjs',
      governanceHelperPath: 'tools/custom/governance-helper.mjs',
      profile: 'workspace-policy',
    });

    expect(tree.read('config/eslint.config.mjs', 'utf8')).toBe(firstConfig);
    expect(tree.read('tools/custom/governance-helper.mjs', 'utf8')).toBe(
      firstHelper
    );
    expect(
      tree.read('tools/governance/profiles/workspace-policy.json', 'utf8')
    ).toBe(firstProfile);
  });
});

function buildFlatConfigWithInlineConstraints(_: string) {
  return `import nx from '@nx/eslint-plugin';

export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          depConstraints: [{ sourceTag: 'domain:billing', onlyDependOnLibsWithTags: ['domain:shared'] }],
        },
      ],
    },
  },
];
`;
}

beforeAll(async () => {
  ({ createTreeWithEmptyWorkspace } = await import('@nx/devkit/testing'));
});
