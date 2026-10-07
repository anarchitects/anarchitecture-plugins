// SPDX-License-Identifier: MIT
import { join } from 'node:path';
import { usePackedPlugin } from '../packed-plugin';
import { assertVitestConsumer } from '../vitest-consumer';

describe('packed Nest vitest', () => {
  const suite = usePackedPlugin();
  it('runs standalone and converted Vitest tests with a real Yarn install', () => {
    assertVitestConsumer(
      join(suite.root, 'vitest-yarn-consumer'),
      suite.tarball
    );
  }, 360_000);
});
