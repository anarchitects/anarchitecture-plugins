// SPDX-License-Identifier: MIT
import type { Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { InterceptorGeneratorSchema } from './schema';
export async function interceptorGenerator(
  tree: Tree,
  options: InterceptorGeneratorSchema
): Promise<void> {
  await generateNestArtifact(tree, 'interceptor', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default interceptorGenerator;
