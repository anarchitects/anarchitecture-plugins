import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';
import { resolveProjectRoot, type BaseExecutorOptions } from '../shared.js';

export interface SeedExecutorOptions
  extends Pick<BaseExecutorOptions, 'projectRoot'> {
  file: string;
  export?: string;
  tsconfig?: string;
  args?: unknown[];
}

export default async function seedDatabase(
  options: SeedExecutorOptions,
  context: ExecutorContext
) {
  if (!options.file) {
    throw new Error('Provide a seed file using the file option.');
  }

  const { absoluteProjectRoot } = resolveProjectRoot(
    options.projectRoot,
    context
  );
  const scriptPath = isAbsolute(options.file)
    ? options.file
    : resolve(absoluteProjectRoot, options.file);

  if (!existsSync(scriptPath)) {
    throw new Error(`Seed file not found at ${scriptPath}`);
  }

  if (scriptPath.endsWith('.ts')) {
    await registerTsNode(options, absoluteProjectRoot);
  }

  const moduleUrl = pathToFileURL(scriptPath).href;
  const imported = await import(moduleUrl);
  const exportName = options.export ?? 'default';
  const runner =
    exportName === 'default' ? imported.default : imported[exportName];

  if (typeof runner !== 'function') {
    throw new Error(
      `Export "${exportName}" is not a function in ${scriptPath}.`
    );
  }

  const result = await runner(options.args ?? []);
  logger.info(`Executed seed from ${scriptPath} using export ${exportName}.`);

  return { success: result !== false };
}

async function registerTsNode(
  options: SeedExecutorOptions,
  absoluteProjectRoot: string
) {
  const tsconfigPath = options.tsconfig
    ? resolve(absoluteProjectRoot, options.tsconfig)
    : undefined;

  if (tsconfigPath) {
    process.env.TS_NODE_PROJECT = tsconfigPath;
  }

  try {
    await import('ts-node/register');
  } catch (error) {
    throw new Error(
      'ts-node is required to execute TypeScript seeds. Install it in your workspace.'
    );
  }
}
