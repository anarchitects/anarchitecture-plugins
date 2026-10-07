// SPDX-License-Identifier: MIT
import fs = require('node:fs');
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { runNativeSchematic } from './run-native-schematic';
import type { TreeSnapshot } from './tree-snapshot';

// Nest sub-app reads './package.json'; library reads cwd's Nest config for its
// default prefix. Bridge these host lookups to the Tree; module/template reads
// still use the real filesystem. No cwd changes, temporary files, or CLI.
const before: TreeSnapshot = new Map(
  [...workerData.before].map(([path, content]: [string, Uint8Array]) => [
    path,
    Buffer.from(content),
  ])
);
const exists = fs.existsSync;
const read = fs.readFileSync;
const hostPaths = new Map<string, string>([
  ['./package.json', 'package.json'],
  ...['nest-cli.json', '.nestcli.json', '.nest-cli.json', 'nest.json'].map(
    (name): [string, string] => [join(process.cwd(), name), name]
  ),
]);
fs.existsSync = (path) =>
  typeof path === 'string' && hostPaths.has(path)
    ? before.has(hostPaths.get(path)!)
    : exists(path);
fs.readFileSync = ((
  path: Parameters<typeof read>[0],
  options?: Parameters<typeof read>[1]
) => {
  const virtualPath =
    typeof path === 'string' ? hostPaths.get(path) : undefined;
  if (!virtualPath) return read(path, options);
  const content = before.get(virtualPath);
  if (!content)
    throw new Error(`Selected Nest workspace has no ${virtualPath}.`);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? content.toString(encoding) : Buffer.from(content);
}) as typeof read;
syncBuiltinESMExports();
runNativeSchematic(before, workerData.options)
  .then((result) => parentPort!.postMessage(result))
  .catch((error) => {
    throw error;
  });
