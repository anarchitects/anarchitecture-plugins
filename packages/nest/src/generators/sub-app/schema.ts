// SPDX-License-Identifier: MIT
import type { NestMemberOptions } from '../../utils/generate-nest-member';
export interface SubAppGeneratorSchema extends NestMemberOptions {
  platform?: 'node';
}
