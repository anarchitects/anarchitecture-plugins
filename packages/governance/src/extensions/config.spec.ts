import {
  loadGovernanceExtensionConfig,
  parseGovernanceExtensionConfig,
} from './config.js';

describe('governance extension config', () => {
  it('normalizes missing config to an empty extension list', () => {
    expect(loadGovernanceExtensionConfig({ nxJson: {} })).toEqual({
      extensions: [],
    });
  });

  it('parses valid governance extension registrations', () => {
    expect(
      parseGovernanceExtensionConfig({
        governance: {
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
        },
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

  it('fails on duplicate package names', () => {
    expect(() =>
      parseGovernanceExtensionConfig({
        governance: {
          extensions: [
            {
              package: '@anarchitects/governance-extension-angular',
            },
            {
              package: '@anarchitects/governance-extension-angular',
            },
          ],
        },
      })
    ).toThrow(
      'Invalid governance extension config: duplicate extension package "@anarchitects/governance-extension-angular" is not allowed.'
    );
  });

  it('fails on invalid package values', () => {
    expect(() =>
      parseGovernanceExtensionConfig({
        governance: {
          extensions: [
            {
              package: '',
            },
          ],
        },
      })
    ).toThrow(
      'Invalid governance extension config: governance.extensions[0].package must be a non-empty string.'
    );
  });

  it('preserves insertion order', () => {
    const config = parseGovernanceExtensionConfig({
      governance: {
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
      },
    });

    expect(config.extensions.map((entry) => entry.package)).toEqual([
      'plugin-c',
      'plugin-a',
      'plugin-b',
    ]);
  });

  it('fails on invalid legacyPluginProbing values', () => {
    expect(() =>
      parseGovernanceExtensionConfig({
        governance: {
          legacyPluginProbing: 'yes',
        } as unknown as {
          legacyPluginProbing: boolean;
        },
      })
    ).toThrow(
      'Invalid governance extension config: nx.json governance.legacyPluginProbing must be a boolean when provided.'
    );
  });

  it('ignores unrelated nx.json fields', () => {
    expect(
      parseGovernanceExtensionConfig({
        plugins: ['@nx/jest/plugin'],
        governance: {
          extensions: [
            {
              package: 'plugin-a',
            },
          ],
        },
      } as {
        plugins: string[];
        governance: {
          extensions: Array<{ package: string }>;
        };
      })
    ).toEqual({
      extensions: [
        {
          package: 'plugin-a',
        },
      ],
    });
  });
});
