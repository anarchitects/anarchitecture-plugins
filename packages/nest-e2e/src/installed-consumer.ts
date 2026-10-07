// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { consumerEnvironment } from './consumer-environment';

/** Install the packed plugin into a separate, real Yarn consumer. */
export function createInstalledConsumer(root: string, tarball: string) {
  mkdirSync(root, { recursive: true });
  const repository = resolve(__dirname, '../../..');
  const { packageManager } = JSON.parse(
    readFileSync(join(repository, 'package.json'), 'utf8')
  );
  const env: NodeJS.ProcessEnv = {
    ...consumerEnvironment(root),
    CI: 'true',
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  };

  function yarn(args: string[], nodeOptions?: string, stdoutOnly = false) {
    const result = spawnSync('yarn', args, {
      cwd: root,
      env: { ...env, ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}) },
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = stripVTControlCharacters(
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `yarn ${args.join(' ')} failed (${result.status ?? result.signal}):\n${
          result.error?.message ?? ''
        }\n${output}`
      );
    }
    return stdoutOnly ? stripVTControlCharacters(result.stdout ?? '') : output;
  }

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'nest-consumer',
      private: true,
      packageManager,
      workspaces: ['packages/*'],
      devDependencies: {
        '@anarchitects/nest': `file:${tarball}`,
        '@nestjs/cli': '12.0.0',
        '@nx/devkit': '23.2.0',
        nx: '23.2.0',
        typescript: '6.0.3',
      },
    })
  );
  writeFileSync(join(root, 'nx.json'), JSON.stringify({ plugins: [] }));
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.nx\n');
  const yarnConfig = 'nodeLinker: node-modules\nenableScripts: false\n';
  writeFileSync(join(root, '.yarnrc.yml'), yarnConfig);
  yarn(['install']);
  yarn(['nx', 'g', '@anarchitects/nest:init', '--no-interactive']);
  return { yarn, env, yarnConfig };
}
