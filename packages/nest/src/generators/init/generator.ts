import type { Tree } from '@nx/devkit';
import type { InitGeneratorSchema } from './schema.js';

export async function initGenerator(
  _tree: Tree,
  options: InitGeneratorSchema = {}
): Promise<void> {
  void options;
  // TODO(#160): Implement Nest plugin initialization in later subissues.
}

export default initGenerator;
