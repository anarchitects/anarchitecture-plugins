// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { consumerEnvironment } from '../consumer-environment';

it('starts consumers without outer cache, task, or debugger state', () => {
  const root = join(tmpdir(), 'nest-env-consumer');
  const inherited = {
    ...process.env,
    NX_SKIP_NX_CACHE: 'true',
    NX_DISABLE_NX_CACHE: 'true',
    NX_TASK_TARGET_PROJECT: 'nx-nest-e2e',
    NX_WORKSPACE_ROOT: '/outer/workspace',
    NODE_OPTIONS: '--require=/outer/editor/debugger-only.cjs',
    VSCODE_INSPECTOR_OPTIONS: '{"inspectorIpc":"outer-debugger"}',
    TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs"}',
    NODE_ENV: 'test',
    NEST_CONSUMER_SENTINEL: 'preserved',
  };
  const output = execFileSync(
    process.execPath,
    ['-e', 'console.log(JSON.stringify(process.env))'],
    { env: consumerEnvironment(root, inherited), encoding: 'utf8' }
  );
  const child = JSON.parse(output);
  for (const key of [
    'NX_SKIP_NX_CACHE',
    'NX_DISABLE_NX_CACHE',
    'NX_TASK_TARGET_PROJECT',
    'NX_WORKSPACE_ROOT',
    'NODE_OPTIONS',
    'VSCODE_INSPECTOR_OPTIONS',
    'TS_NODE_COMPILER_OPTIONS',
    'NODE_ENV',
  ])
    expect(child[key]).toBeUndefined();
  expect(child.NEST_CONSUMER_SENTINEL).toBe('preserved');
  expect(child.NX_CACHE_DIRECTORY).toBe(join(root, '.nx/cache'));
  expect(child.NX_WORKSPACE_DATA_DIRECTORY).toBe(
    join(root, '.nx/workspace-data')
  );
  expect(child.NX_DAEMON).toBe('false');
  expect(inherited.NX_SKIP_NX_CACHE).toBe('true');
});
