// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { consumerEnvironment } from './consumer-environment';

/** Install the packed plugin into a separate, real Yarn consumer. */
export function createInstalledConsumer(
  root: string,
  tarball: string,
  options: { workspaces?: string[] } = { workspaces: ['packages/*'] }
) {
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
    const trace =
      process.env.CI === 'true' || process.env.NEST_E2E_TRACE === 'true';
    const started = Date.now();
    const command = `yarn ${args.join(' ')}`;
    // Write directly to stderr so a blocked command still has a start record.
    // Log only fixture commands and result metadata, never the environment.
    if (trace)
      process.stderr.write(
        `[nest-consumer] ${new Date(started).toISOString()} START ${command}\n`
      );
    const result = spawnSync('yarn', args, {
      cwd: root,
      env: { ...env, ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}) },
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (trace)
      process.stderr.write(
        `[nest-consumer] ${new Date().toISOString()} END ${command} durationMs=${
          Date.now() - started
        } status=${result.status} signal=${result.signal ?? '-'} error=${
          (result.error as NodeJS.ErrnoException | undefined)?.code ?? '-'
        }\n`
      );
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
      ...(options.workspaces ? { workspaces: options.workspaces } : {}),
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
