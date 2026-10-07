// SPDX-License-Identifier: MIT
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { consumerEnvironment as environment } from './consumer-environment';
import { type NestFixture } from './fixtures';

const e2eRoot = resolve(__dirname, '..');
const pluginRoot = resolve(e2eRoot, '../nest');
export const dependencies: Record<string, string> = JSON.parse(
  readFileSync(join(e2eRoot, 'package.json'), 'utf8')
).devDependencies;
const nxBin = require.resolve('nx/bin/nx.js');

export function packageRoot(name: string, from = e2eRoot): string {
  try {
    return dirname(require.resolve(`${name}/package.json`, { paths: [from] }));
  } catch {
    let directory = dirname(require.resolve(name, { paths: [from] }));
    while (dirname(directory) !== directory) {
      const manifest = join(directory, 'package.json');
      if (
        existsSync(manifest) &&
        JSON.parse(readFileSync(manifest, 'utf8')).name === name
      )
        return directory;
      directory = dirname(directory);
    }
    throw new Error(`Cannot locate installed package ${name}`);
  }
}

export function write(root: string, path: string, value: unknown) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  );
}

/** Snapshot a generated owner to detect writes escaping project selection. */
export function snapshotFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function visit(directory: string) {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else files[path] = readFileSync(join(root, path)).toString('base64');
    }
  }
  visit('');
  return files;
}

export function nx(root: string, args: string[]) {
  // Linked fixtures test CLI behavior without network installs. Real consumers
  // exercise the default installation callback through their own Yarn runner.
  if (
    ['g', 'generate'].includes(args[0]) &&
    args[1]?.startsWith('@anarchitects/nest:') &&
    !['init', 'configuration', 'config'].includes(args[1].split(':')[1])
  ) {
    args = [...args, '--skipInstall'];
  }
  try {
    return execFileSync(process.execPath, [nxBin, ...args], {
      cwd: root,
      env: environment(root),
      encoding: 'utf8',
      timeout: 60_000,
      stdio: 'pipe',
    });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`
    );
  }
}

function createWorkspace(
  suiteRoot: string,
  tarball: string,
  fixture: NestFixture
) {
  const root = join(suiteRoot, fixture.name);
  mkdirSync(root, { recursive: true });
  const installedPackage = join(root, 'node_modules/@anarchitects/nest');
  mkdirSync(installedPackage, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    tarball,
    '-C',
    installedPackage,
    '--strip-components=1',
  ]);
  const pluginDependencies = JSON.parse(
    readFileSync(join(installedPackage, 'package.json'), 'utf8')
  ).dependencies;
  const fixtureDependencies = Object.fromEntries(
    Object.entries(dependencies).filter(
      ([name]) => name !== '@anarchitects/nest'
    )
  );
  for (const name of Object.keys({
    ...fixtureDependencies,
    ...pluginDependencies,
    '@types/node': '*',
  })) {
    const destination = join(root, 'node_modules', name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(
      packageRoot(name, name in pluginDependencies ? pluginRoot : e2eRoot),
      destination,
      'junction'
    );
  }
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
  symlinkSync(
    require.resolve('@nestjs/cli/bin/nest.js'),
    join(root, 'node_modules/.bin/nest')
  );
  symlinkSync(
    require.resolve('typescript/bin/tsc'),
    join(root, 'node_modules/.bin/tsc')
  );
  write(root, 'package.json', {
    name: fixture.root === '.' ? fixture.name : 'fixture-workspace',
    private: true,
    type: fixture.moduleType,
    dependencies: fixtureDependencies,
  });
  if (fixture.root !== '.')
    write(root, `${fixture.root}/package.json`, {
      name: fixture.name,
      private: true,
      type: fixture.moduleType,
    });
  write(root, 'nx.json', {
    plugins: [],
    namedInputs: { default: ['{projectRoot}/**/*'], production: ['default'] },
  });
  // Nx uses the real dependency lock to create external nodes for task hashing.
  // Dependencies are linked from this same immutable workspace install.
  write(
    root,
    'yarn.lock',
    readFileSync(resolve(e2eRoot, '../../yarn.lock'), 'utf8')
  );
  for (const [path, value] of Object.entries(fixture.files))
    write(root, path, value);
  // These configurations must not cause this plugin to infer unrelated targets.
  write(root, join(fixture.root, 'jest.config.cjs'), 'module.exports = {};\n');
  write(root, join(fixture.root, 'eslint.config.mjs'), 'export default [];\n');
  write(root, '.gitignore', 'node_modules\n.nx\ndist\nartifacts\n');
  return root;
}

async function stop(child: ChildProcess) {
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      } else if (child.pid) process.kill(-child.pid, value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  signal('SIGTERM');
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done) => {
    const timer = setTimeout(() => {
      signal('SIGKILL');
      done();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      done();
    });
  });
}

export async function assertStarts(root: string, target: string) {
  const child = spawn(
    process.execPath,
    [nxBin, 'run', target, '--outputStyle=stream'],
    {
      cwd: root,
      env: environment(root),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let output = '';
  try {
    const url = await new Promise<string>((accept, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Startup timed out:\n${output}`)),
        45_000
      );
      const capture = (data: Buffer) => {
        output += data.toString();
        const match = output.match(/NEST_E2E_URL=(http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timer);
          accept(match[1]);
        }
      };
      child.stdout?.on('data', capture);
      child.stderr?.on('data', capture);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        reject(new Error(`Start exited (${code ?? signal}):\n${output}`));
      });
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Nest v12 fixture' });
    expect(child.exitCode).toBeNull();
  } finally {
    await stop(child);
  }
}

/** Each spec owns its tarball and temporary workspaces on its assigned agent. */
export function usePackedPlugin() {
  let suiteRoot: string;
  let tarball: string;
  beforeAll(() => {
    suiteRoot = mkdtempSync(join(tmpdir(), 'nx-nest-e2e-'));
    const [pack] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', suiteRoot],
        {
          cwd: pluginRoot,
          encoding: 'utf8',
          env: {
            ...environment(suiteRoot),
            npm_config_cache: join(suiteRoot, '.npm'),
          },
          timeout: 30_000,
        }
      )
    );
    tarball = join(suiteRoot, pack.filename);
  });
  afterAll(() => {
    if (suiteRoot) rmSync(suiteRoot, { recursive: true, force: true });
  });
  return {
    get root() {
      return suiteRoot;
    },
    get tarball() {
      return tarball;
    },
    createWorkspace: (fixture: NestFixture) =>
      createWorkspace(suiteRoot, tarball, fixture),
  };
}
