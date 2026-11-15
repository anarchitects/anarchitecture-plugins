// SPDX-License-Identifier: MIT
import type { NestMemberOptions } from '../../utils/generate-nest-member';
import type { MemberHttpPlatform } from '../../utils/http-platform';
export interface SubAppGeneratorSchema extends NestMemberOptions {
  platform?: MemberHttpPlatform;
}
