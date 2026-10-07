// SPDX-License-Identifier: MIT
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { createInstalledConsumer } from './installed-consumer';

function snapshot(root: string, directory = ''): Record<string, string> {
  return Object.fromEntries(
    readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
      (entry) => {
        if (entry.name === 'node_modules') return [];
        const file = join(directory, entry.name);
        return entry.isDirectory()
          ? Object.entries(snapshot(root, file))
          : [[file, readFileSync(join(root, file), 'utf8')]];
      }
    )
  );
}

async function freePort(): Promise<number> {
  const server = createServer();
  return new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Expected an ephemeral TCP port'));
        return;
      }
      server.close((error) => (error ? reject(error) : accept(address.port)));
    });
  });
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

async function assertHttp(
  root: string,
  env: NodeJS.ProcessEnv,
  target: string,
  path: string,
  expected: string
) {
  const port = String(await freePort());
  const child = spawn('yarn', ['nx', 'run', target, '--output-style=stream'], {
    cwd: root,
    // Native application and sub-app templates currently use different casing.
    env: { ...env, PORT: port, port },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    await new Promise<void>((accept, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Startup timed out:\n${output}`)),
        45_000
      );
      const capture = (data: Buffer) => {
        output += data.toString();
        if (output.includes('Nest application successfully started')) {
          clearTimeout(timer);
          accept();
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
    // Nest logs initialization before app.listen has necessarily bound its port.
    const deadline = Date.now() + 10_000;
    let response;
    for (;;) {
      try {
        response = await fetch(`http://127.0.0.1:${port}${path}`, {
          signal: AbortSignal.timeout(5_000),
        });
        break;
      } catch (error) {
        if (
          Date.now() >= deadline ||
          child.exitCode !== null ||
          child.signalCode !== null
        ) {
          throw new Error(`HTTP startup failed: ${String(error)}\n${output}`);
        }
        await new Promise((done) => setTimeout(done, 100));
      }
    }
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(expected);
  } finally {
    await stop(child);
  }
}

export async function assertRspackConsumer(
  root: string,
  tarball: string,
  type: string
) {
  const { yarn, env, yarnConfig } = createInstalledConsumer(root, tarball);
  const owner = join(root, 'packages/api');
  for (const options of [
    [
      'application',
      'api',
      '--directory=packages/api',
      `--type=${type}`,
      '--packageManager=yarn',
    ],
    ['resource', 'users', '--project=api', '--type=rest', '--crud=true'],
    ['sub-app', 'worker', '--project=api'],
    ['library', 'shared', '--project=api'],
  ]) {
    const [schematic, ...args] = options;
    const generate = [
      'nx',
      'g',
      `@anarchitects/nest:${schematic}`,
      ...args,
      '--no-interactive',
    ];
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
    yarn([...generate, '--dry-run']);
    expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
    yarn(generate);
    expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
    if (schematic === 'sub-app') {
      expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).not.toBe(lock);
      expect(
        existsSync(join(root, 'node_modules/@rspack/core/package.json'))
      ).toBe(true);
    }
  }
  const native = snapshot(owner);
  const manifest = JSON.parse(native['package.json']);
  const members = ['api', 'worker', 'shared'];
  for (const member of members) {
    const project = JSON.parse(
      yarn(
        ['nx', 'show', 'project', `api-${member}`, '--json'],
        undefined,
        true
      )
    );
    expect(project.targets.build.options).toEqual({
      cwd: 'packages/api',
      command: `nest build '${member}'`,
    });
    if (member === 'shared') expect(project.targets.start).toBeUndefined();
  }
  expect(manifest.devDependencies).toMatchObject({
    '@rspack/core': '^2.1.10',
    'webpack-node-externals': '^3.0.0',
    'tsconfig-paths-webpack-plugin': '^4.2.0',
  });
  expect(manifest.installConfig).toBeUndefined();
  // Default hoisting remains enabled; generation installs everything required.
  expect(existsSync(join(root, 'node_modules/@nestjs/core/package.json'))).toBe(
    true
  );
  expect(
    existsSync(join(owner, 'node_modules/@nestjs/core/package.json'))
  ).toBe(false);
  for (const member of members) {
    yarn([
      'nx',
      'run',
      `api-${member}:build`,
      '--skipNxCache',
      '--output-style=static',
    ]);
    const output =
      member === 'shared' ? 'libs/shared/index.js' : `apps/${member}/main.js`;
    expect(existsSync(join(owner, 'dist', output))).toBe(true);
  }
  await assertHttp(
    root,
    env,
    'api-api:start',
    '/users',
    'This action returns all users'
  );
  await assertHttp(root, env, 'api-worker:start', '/', 'Hello World!');
  expect(
    JSON.parse(readFileSync(join(owner, 'package.json'), 'utf8')).scripts
  ).toEqual(manifest.scripts);
  expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
  for (const [file, content] of Object.entries(native)) {
    if (file !== 'package.json')
      expect(readFileSync(join(owner, file), 'utf8')).toBe(content);
  }
}
