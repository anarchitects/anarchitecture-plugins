import {
  parseGovernanceExtensionConfig,
  validateGovernanceExtensionConfig,
} from './config.js';

describe('governance extension config parser', () => {
  it('normalizes missing config to an empty extension list', () => {
    expect(parseGovernanceExtensionConfig()).toEqual({
      extensions: [],
    });
  });

  it('parses valid governance extension registrations from raw config input', () => {
    expect(
      parseGovernanceExtensionConfig({
        legacyPluginProbing: true,
        extensions: [
          {
            package: '@anarchitects/governance-extension-angular',
            optional: true,
            options: {
              selectorPrefix: 'aa',
            },
          },
          {
            package: '@anarchitects/governance-extension-typescript',
          },
        ],
      })
    ).toEqual({
      legacyPluginProbing: true,
      extensions: [
        {
          package: '@anarchitects/governance-extension-angular',
          optional: true,
          options: {
            selectorPrefix: 'aa',
          },
        },
        {
          package: '@anarchitects/governance-extension-typescript',
        },
      ],
    });
  });

  it('returns deterministic diagnostics for invalid config input', () => {
    expect(
      validateGovernanceExtensionConfig({
        legacyPluginProbing: 'yes',
        extensions: [
          {
            package: '',
          },
          {
            package: 'plugin-a',
            optional: 'sometimes',
          },
        ],
      })
    ).toEqual({
      diagnostics: [
        {
          code: 'invalid-legacy-plugin-probing',
          path: 'governance.legacyPluginProbing',
          message:
            'Invalid governance extension config: governance.legacyPluginProbing must be a boolean when provided.',
        },
        {
          code: 'invalid-extension-package',
          path: 'governance.extensions[0].package',
          message:
            'Invalid governance extension config: governance.extensions[0].package must be a non-empty string.',
        },
        {
          code: 'invalid-extension-optional',
          path: 'governance.extensions[1].optional',
          message:
            'Invalid governance extension config: governance.extensions[1].optional must be a boolean when provided.',
        },
      ],
    });
  });

  it('fails on duplicate package names', () => {
    expect(() =>
      parseGovernanceExtensionConfig({
        extensions: [
          {
            package: '@anarchitects/governance-extension-angular',
          },
          {
            package: '@anarchitects/governance-extension-angular',
          },
        ],
      })
    ).toThrow(
      'Invalid governance extension config: duplicate extension package "@anarchitects/governance-extension-angular" is not allowed.'
    );
  });

  it('preserves insertion order', () => {
    const config = parseGovernanceExtensionConfig({
      extensions: [
        {
          package: 'plugin-c',
        },
        {
          package: 'plugin-a',
        },
        {
          package: 'plugin-b',
        },
      ],
    });

    expect(config.extensions.map((entry) => entry.package)).toEqual([
      'plugin-c',
      'plugin-a',
      'plugin-b',
    ]);
  });

  it('does not mutate the source config object', () => {
    const configInput = {
      legacyPluginProbing: true,
      extensions: [
        {
          package: 'plugin-a',
          optional: true,
          options: {
            selectorPrefix: 'aa',
          },
        },
      ],
    };

    const original = structuredClone(configInput);
    const parsed = parseGovernanceExtensionConfig(configInput);
    const firstExtension = parsed.extensions[0];

    expect(configInput).toEqual(original);
    expect(firstExtension).toBeDefined();

    if (!firstExtension) {
      throw new Error('Expected a parsed governance extension entry.');
    }

    firstExtension.options = {
      selectorPrefix: 'bb',
    };

    expect(configInput).toEqual(original);
  });
});
