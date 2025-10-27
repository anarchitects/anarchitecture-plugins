/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */

/// <reference path="registry.d.ts" />

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@anarchitecture-plugins/source:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';
  const manifestPath = 'packages/js/package.json';
  const originalManifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    version: string;
    publishConfig?: { provenance?: boolean };
  };
  const originalVersion = originalManifest.version;
  const originalProvenance = originalManifest.publishConfig?.provenance;

  if (originalManifest.publishConfig) {
    originalManifest.publishConfig.provenance = false;
    writeFileSync(
      manifestPath,
      `${JSON.stringify(originalManifest, null, 2)}\n`
    );
  }

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
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      version: string;
      publishConfig?: { provenance?: boolean };
    };
    manifest.version = originalVersion;
    if (manifest.publishConfig) {
      if (typeof originalProvenance === 'undefined') {
        delete manifest.publishConfig.provenance;
      } else {
        manifest.publishConfig.provenance = originalProvenance;
      }
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
};
