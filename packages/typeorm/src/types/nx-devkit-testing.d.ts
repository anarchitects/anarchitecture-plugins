declare module '@nx/devkit/testing' {
  import type { Tree } from '@nx/devkit';

  export function createTreeWithEmptyWorkspace(): Tree;
}
