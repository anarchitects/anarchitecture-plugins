/**
 * This script stops the local registry for e2e testing purposes.
 * It is meant to be called in jest's globalTeardown.
 */

/// <reference path="registry.d.ts" />

export default async () => {
  if (global.stopLocalRegistry) {
    try {
      await global.stopLocalRegistry();
      console.log('Successfully stopped local registry');
    } catch (error) {
      console.warn('Failed to stop local registry:', error);
      // Don't throw to avoid failing the teardown
    }
  }
};
