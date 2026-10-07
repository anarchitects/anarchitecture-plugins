// SPDX-License-Identifier: MIT
import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateNestArtifact } from '../../utils/generate-nest-artifact';
import type { InterceptorGeneratorSchema } from './schema';
export async function interceptorGenerator(
  tree: Tree,
  options: InterceptorGeneratorSchema
): Promise<GeneratorCallback | undefined> {
  return generateNestArtifact(tree, 'interceptor', options, {
    flat: true,
    spec: true,
    specFileSuffix: 'spec',
    language: 'ts',
  });
}
export default interceptorGenerator;
