import { isAbsolute, join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { runTypeormCommand } from '../../utils/cli.js';
import { resolveProjectRoot } from '../../utils/shared.js';
import type { SubscriberCreateExecutorOptions } from './schema.js';

export default async function createSubscriber(
  options: SubscriberCreateExecutorOptions,
  context: ExecutorContext
) {
  const path = options.path?.trim();
  if (!path) {
    throw new Error('Provide a subscriber path via the path option.');
  }

  const { projectRoot } = resolveProjectRoot(options.projectRoot, context);
  const targetPath = isAbsolute(path) ? path : join(projectRoot, path);
  const exitCode = await runTypeormCommand(
    'subscriber:create',
    options,
    context,
    [targetPath]
  );

  return { success: exitCode === 0 };
}
