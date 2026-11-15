// SPDX-License-Identifier: MIT
import type { NestMemberOptions } from '../../utils/generate-nest-member';
import type { HttpPlatform } from '../../utils/http-platform';
export interface SubAppGeneratorSchema extends NestMemberOptions {
  platform?: HttpPlatform;
}
