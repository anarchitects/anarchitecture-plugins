/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */

/// <reference path="registry.d.ts" />

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import { rmSync } from 'node:fs';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@anarchitecture-plugins/source:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

  rmSync(storage, { recursive: true, force: true });
  const version = `0.0.0-e2e.${Date.now()}`;

  global.stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: false,
  });

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
  await releasePublish({
    tag: 'e2e',
    firstRelease: true,
  });
};
