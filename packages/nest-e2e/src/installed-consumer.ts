// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { consumerEnvironment } from './consumer-environment';
import { NX_VERSION } from '@nx/devkit';
import { registryRecords, npmRegistryRecords } from './consumer-locks';

export interface InstalledConsumerOptions {
  workspaces?: string[];
  node?: string;
  nx?: string;
  cli?: string;
  manager?: 'yarn' | 'npm';
  npmBinDirectory?: string;
  resolutionLock?: string;
}

/** Install the packed plugin into a separate, real package-manager consumer. */
export function createInstalledConsumer(
  root: string,
  tarball: string,
  options: InstalledConsumerOptions = { workspaces: ['packages/*'] }
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
  if (options.npmBinDirectory)
    env.PATH = `${options.npmBinDirectory}${delimiter}${env.PATH}`;
  if (options.node)
    env.PATH = `${dirname(options.node)}${delimiter}${env.PATH}`;
  const manager = options.manager ?? 'yarn';
  const lockName = manager === 'yarn' ? 'yarn.lock' : 'package-lock.json';
  const fixture =
    options.resolutionLock && readFileSync(options.resolutionLock, 'utf8');
  const records = manager === 'yarn' ? registryRecords : npmRegistryRecords;

  function yarn(
    args: string[],
    nodeOptions?: string,
    stdoutOnly = false,
    cwd = root
  ) {
    const installing = args[0] === 'install';
    if (installing && fixture) {
      let seed = fixture;
      if (manager === 'npm') {
        const lock = JSON.parse(seed);
        for (const [path, entry] of Object.entries(lock.packages) as [
          string,
          { resolved?: string; integrity?: string }
        ][]) {
          if (path.endsWith('node_modules/@anarchitects/nest')) {
            entry.resolved = `file:${tarball}`;
            delete entry.integrity; // This run's local artifact, never a registry package.
          }
        }
        seed = JSON.stringify(lock, null, 2);
      }
      writeFileSync(join(root, lockName), seed);
    }
    // Nx 24 summarizes task failures by default; assertions need diagnostics.
    if (args[0] === 'nx' && args[1] === 'run') {
      args = [...args, '--output-style=static'];
    }
    const trace =
      process.env.CI === 'true' || process.env.NEST_E2E_TRACE === 'true';
    const started = Date.now();
    const command = `${manager} ${args.join(' ')}`;
    // Write directly to stderr so a blocked command still has a start record.
    // Log only fixture commands and result metadata, never the environment.
    if (trace)
      process.stderr.write(
        `[nest-consumer] ${new Date(started).toISOString()} START ${command}\n`
      );
    const executable =
      args[0] === 'node'
        ? options.node ?? 'node'
        : manager === 'yarn'
        ? 'corepack'
        : 'npm';
    const commandArgs =
      args[0] === 'node'
        ? args.slice(1)
        : manager === 'yarn'
        ? ['yarn', ...args]
        : installing
        ? [
            'install',
            '--ignore-scripts',
            '--strict-peer-deps',
            '--no-audit',
            '--no-fund',
          ]
        : ['exec', '--', ...args];
    const result = spawnSync(executable, commandArgs, {
      cwd,
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
        `${manager} ${args.join(' ')} failed (${
          result.status ?? result.signal
        }):\n${result.error?.message ?? ''}\n${output}`
      );
    }
    if (installing && fixture) {
      if (/YN0060|YN0002|ERESOLVE|EBADENGINE/.test(output))
        throw new Error(`Consumer dependency/engine conflict:\n${output}`);
      const expected = records(fixture);
      const actual = records(readFileSync(join(root, lockName), 'utf8'));
      if (!actual.size)
        throw new Error('Consumer lock contains no registry packages');
      for (const [resolution, metadata] of actual) {
        if (expected.get(resolution) !== metadata)
          throw new Error(`Unpinned consumer resolution: ${resolution}`);
      }
      const verified = spawnSync(
        manager === 'yarn' ? 'corepack' : 'npm',
        manager === 'yarn'
          ? ['yarn', 'install', '--immutable']
          : [
              'ci',
              '--ignore-scripts',
              '--strict-peer-deps',
              '--no-audit',
              '--no-fund',
            ],
        {
          cwd: root,
          env,
          encoding: 'utf8',
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      if (verified.error || verified.status !== 0)
        throw new Error(
          `Locked consumer installation failed:\n${verified.stdout}\n${verified.stderr}`
        );
    }
    return stdoutOnly ? stripVTControlCharacters(result.stdout ?? '') : output;
  }

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'nest-consumer',
      private: true,
      packageManager: manager === 'yarn' ? packageManager : 'npm@11.19.1',
      ...(options.workspaces ? { workspaces: options.workspaces } : {}),
      devDependencies: {
        '@anarchitects/nest': `file:${tarball}`,
        '@nestjs/cli': options.cli ?? '12.0.0',
        '@nx/devkit': options.nx ?? NX_VERSION,
        nx: options.nx ?? NX_VERSION,
        typescript: '6.0.3',
      },
    })
  );
  writeFileSync(join(root, 'nx.json'), JSON.stringify({ plugins: [] }));
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.nx\n');
  const yarnConfig = 'nodeLinker: node-modules\nenableScripts: false\n';
  if (manager === 'yarn') writeFileSync(join(root, '.yarnrc.yml'), yarnConfig);
  else
    writeFileSync(
      join(root, '.npmrc'),
      'ignore-scripts=true\nstrict-peer-deps=true\naudit=false\nfund=false\n'
    );
  yarn(['install']);
  yarn(['nx', 'g', '@anarchitects/nest:init', '--no-interactive']);
  return { yarn, env, yarnConfig, manager, lockName };
}
