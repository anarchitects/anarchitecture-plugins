// SPDX-License-Identifier: MIT
import { join } from 'node:path';
import { usePackedPlugin } from '../packed-plugin';
import { assertRspackConsumer } from '../rspack-consumer';

describe('packed Nest cjs-rspack', () => {
  const suite = usePackedPlugin();
  it.each(['cjs'])(
    'builds and starts native %s members with real Yarn Rspack setup',
    async (type) => {
      await assertRspackConsumer(
        join(suite.root, `rspack-yarn-${type}`),
        suite.tarball,
        type
      );
    },
    360_000
  );
});
