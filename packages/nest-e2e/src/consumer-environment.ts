// SPDX-License-Identifier: MIT
import { delimiter, join } from 'node:path';

/** Consumers are independent workspaces, not children of the outer Nx task. */
export function consumerEnvironment(
  root: string,
  inherited: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(inherited).filter(([key]) => !key.startsWith('NX_'))
    ),
    PATH: `${join(root, 'node_modules/.bin')}${delimiter}${
      inherited.PATH ?? ''
    }`,
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    NX_INTERACTIVE: 'false',
    NX_TUI: 'false',
    FORCE_COLOR: '0',
    NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
    NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
  };
  // Editor auto-attach and outer Jest/ts-node options must not alter consumers
  // or keep a synchronous child alive waiting for its debugger to disconnect.
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
  delete env.TS_NODE_COMPILER_OPTIONS;
  delete env.NODE_ENV;
  return env;
}
