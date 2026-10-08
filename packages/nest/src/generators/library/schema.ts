// SPDX-License-Identifier: MIT
import type { NestMemberOptions } from '../../utils/generate-nest-member';
export type LibraryGeneratorSchema = NestMemberOptions & {
  /** Workspace-relative destination for an independent Nx library/package. */
  directory?: string;
  prefix?: string;
};
