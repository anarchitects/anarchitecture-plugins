// SPDX-License-Identifier: MIT
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { runNativeSchematic } from './run-native-schematic';
import type { TreeSnapshot } from './tree-snapshot';

/** Native host-read shims are confined to a worker, never the Nx process. */
export function runIsolatedSchematic(
  before: TreeSnapshot,
  options: { schematic: string; options: Record<string, unknown> }
): ReturnType<typeof runNativeSchematic> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'schematic-worker.js'), {
      workerData: {
        before,
        options: { schematic: options.schematic, options: options.options },
      },
      // Nest skips the standalone source move under NODE_ENV=test. Generation
      // must behave like the CLI even when its caller happens to be a test runner.
      env: { ...process.env, NODE_ENV: 'production' },
      execArgv: [],
    });
    let received = false;
    worker.once('message', (result) => {
      received = true;
      resolve(result);
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (!received)
        reject(
          new Error(
            `Native Nest schematic worker exited without a result (code ${code}).`
          )
        );
    });
  });
}
