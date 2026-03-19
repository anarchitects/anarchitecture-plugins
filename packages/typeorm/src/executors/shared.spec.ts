import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { resolveTypeormCliRunner } from '../utils/shared.js';

describe('resolveTypeormCliRunner', () => {
  let workspaceRoot: string;
  let context: ExecutorContext;
  let absoluteProjectRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-typeorm-shared-'));
    absoluteProjectRoot = join(workspaceRoot, 'apps/api');
    mkdirSync(absoluteProjectRoot, { recursive: true });

    ensureRunnerPackage(workspaceRoot, 'typeorm-ts-node-commonjs');
    ensureRunnerPackage(workspaceRoot, 'typeorm-ts-node-esm');

    context = {
      root: workspaceRoot,
      projectName: 'api',
      projectsConfigurations: {
        version: 2,
        projects: {
          api: {
            root: 'apps/api',
            projectType: 'application',
            targets: {},
          },
        },
      },
    } as unknown as ExecutorContext;
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('detects ESM from nearest package.json type module', () => {
    writeFileSync(
      join(absoluteProjectRoot, 'package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    const runner = resolveTypeormCliRunner(
      { moduleSystem: 'auto' },
      context,
      absoluteProjectRoot
    );

    expect(runner).toBe('typeorm-ts-node-esm');
  });

  it('uses CommonJS when package.json is commonjs and tsconfig has no ESM hints', () => {
    writeFileSync(
      join(absoluteProjectRoot, 'package.json'),
      `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`
    );

    const runner = resolveTypeormCliRunner(
      { moduleSystem: 'auto' },
      context,
      absoluteProjectRoot
    );

    expect(runner).toBe('typeorm-ts-node-commonjs');
  });

  it('uses tsconfig fallback when package.json is inconclusive', () => {
    writeFileSync(
      join(absoluteProjectRoot, 'tsconfig.app.json'),
      `{
  "compilerOptions": {
    "module": "NodeNext"
  }
}
`
    );

    const runner = resolveTypeormCliRunner(
      { moduleSystem: 'auto' },
      context,
      absoluteProjectRoot
    );

    expect(runner).toBe('typeorm-ts-node-esm');
  });

  it('defaults to CommonJS when no signal is present', () => {
    const runner = resolveTypeormCliRunner(
      { moduleSystem: 'auto' },
      context,
      absoluteProjectRoot
    );

    expect(runner).toBe('typeorm-ts-node-commonjs');
  });

  it('honors explicit override over auto detection', () => {
    writeFileSync(
      join(absoluteProjectRoot, 'package.json'),
      `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`
    );

    const runner = resolveTypeormCliRunner(
      { moduleSystem: 'esm' },
      context,
      absoluteProjectRoot
    );

    expect(runner).toBe('typeorm-ts-node-esm');
  });

  it('throws actionable error when selected runner is missing', () => {
    rmSync(join(workspaceRoot, 'node_modules/typeorm-ts-node-esm'), {
      recursive: true,
      force: true,
    });

    expect(() =>
      resolveTypeormCliRunner(
        { moduleSystem: 'esm' },
        context,
        absoluteProjectRoot
      )
    ).toThrow('typeorm-ts-node-esm');
  });
});

function ensureRunnerPackage(workspaceRoot: string, packageName: string) {
  const packageDirectory = join(workspaceRoot, 'node_modules', packageName);
  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify({ name: packageName, version: '0.0.0-test' }, null, 2)}\n`
  );
}
