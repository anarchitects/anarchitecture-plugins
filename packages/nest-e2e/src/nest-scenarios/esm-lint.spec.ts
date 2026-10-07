// SPDX-License-Identifier: MIT
import { join } from 'node:path';
import { usePackedPlugin } from '../packed-plugin';
import { assertLintConsumer } from '../lint-consumer';

describe('packed Nest esm-lint', () => {
  const suite = usePackedPlugin();
  it.each(['esm'])(
    'lints active native %s sources and tests with a real Yarn install',
    (type) =>
      assertLintConsumer(
        join(suite.root, `lint-yarn-${type}`),
        suite.tarball,
        type
      ),
    360_000
  );
});
