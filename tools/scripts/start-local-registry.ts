/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */

/// <reference path="registry.d.ts" />

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@anarchitecture-plugins/source:local-registry';
  // storage folder for the local registry
  const workspaceRoot = process.env.NX_WORKSPACE_ROOT ?? process.cwd();
  const storage = join(workspaceRoot, 'tmp/local-registry/storage');
  const manifestPaths = [
    join(workspaceRoot, 'packages/js/package.json'),
    join(workspaceRoot, 'packages/typeorm/package.json'),
  ];

  const manifestSnapshots = manifestPaths.map((manifestPath) => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      version: string;
      publishConfig?: { provenance?: boolean };
    };

    const snapshot = {
      path: manifestPath,
      version: manifest.version,
      publishConfig: manifest.publishConfig
        ? { ...manifest.publishConfig }
        : undefined,
    };

    if (manifest.publishConfig) {
      manifest.publishConfig.provenance = false;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }

    return snapshot;
  });

  rmSync(storage, { recursive: true, force: true });
  const version = `0.0.0-e2e.${Date.now()}`;

  global.stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: false,
  });

  try {
    await releaseVersion({
      specifier: version,
      stageChanges: false,
      gitCommit: false,
      gitTag: false,
      firstRelease: true,
      versionActionsOptionsOverrides: {
        skipLockFileUpdate: true,
      },
    });

    process.env.NPM_CONFIG_PROVENANCE = 'false';

    await releasePublish({
      tag: 'e2e',
      firstRelease: true,
    });
  } finally {
    for (const snapshot of manifestSnapshots) {
      const manifest = JSON.parse(readFileSync(snapshot.path, 'utf-8')) as {
        version: string;
        publishConfig?: { provenance?: boolean };
      };

      manifest.version = snapshot.version;

      if (snapshot.publishConfig) {
        manifest.publishConfig = { ...snapshot.publishConfig };
      } else if (manifest.publishConfig) {
        delete manifest.publishConfig;
      }

      writeFileSync(snapshot.path, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
};
