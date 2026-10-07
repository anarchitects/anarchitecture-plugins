// SPDX-License-Identifier: MIT
import { join } from 'node:path';
import { usePackedPlugin } from '../packed-plugin';
import { assertCjsJestConsumer } from '../cjs-jest-consumer';

describe('packed Nest cjs-jest', () => {
  const suite = usePackedPlugin();
  it('runs CJS Jest with real Yarn hoisting and explicit consumer configuration', () => {
    assertCjsJestConsumer(join(suite.root, 'cjs-yarn-consumer'), suite.tarball);
  }, 360_000);
});
