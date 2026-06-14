import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadGovernanceExtensionConfig } from './config.js';

describe('governance extension config loader', () => {
  it('loads governance extension config from a provided nxJson object', () => {
    expect(
      loadGovernanceExtensionConfig({
        nxJson: {
          governance: {
            legacyPluginProbing: false,
            extensions: [
              {
                package: 'plugin-a',
                optional: true,
              },
            ],
          },
        },
      })
    ).toEqual({
      legacyPluginProbing: false,
      extensions: [
        {
          package: 'plugin-a',
          optional: true,
        },
      ],
    });
  });

  it('reads extension activation only from nx.json.governance', () => {
    expect(
      loadGovernanceExtensionConfig({
        nxJson: {
          governance: {
            legacyPluginProbing: false,
            extensions: [
              {
                package: 'plugin-a',
              },
            ],
          },
        },
      })
    ).toEqual({
      legacyPluginProbing: false,
      extensions: [
        {
          package: 'plugin-a',
        },
      ],
    });
  });

  it('loads governance extension config from nx.json at an explicit workspace root', () => {
    const workspaceRoot = mkdtempSync(
      path.join(tmpdir(), 'governance-extension-config-')
    );

    writeFileSync(
      path.join(workspaceRoot, 'nx.json'),
      JSON.stringify(
        {
          governance: {
            legacyPluginProbing: false,
            extensions: [
              {
                package: 'plugin-a',
                optional: true,
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    expect(loadGovernanceExtensionConfig({ workspaceRoot })).toEqual({
      legacyPluginProbing: false,
      extensions: [
        {
          package: 'plugin-a',
          optional: true,
        },
      ],
    });
  });

  it('preserves parser validation errors when host-loaded config is invalid', () => {
    expect(() =>
      loadGovernanceExtensionConfig({
        nxJson: {
          governance: {
            extensions: 'plugin-a',
          },
        },
      })
    ).toThrow(
      'Invalid governance extension config: governance.extensions must be an array.'
    );
  });
});
