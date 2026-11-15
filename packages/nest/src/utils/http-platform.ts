// SPDX-License-Identifier: MIT
/** Only independently implemented and verified selections are exposed. */
export const httpPlatforms = {
  node: {
    packageName: '@nestjs/platform-node',
    adapter: 'NodeAdapter',
    application: 'NestNodeApplication',
    label: 'Node',
  },
  express: {
    packageName: '@nestjs/platform-express',
    adapter: 'ExpressAdapter',
    application: 'NestExpressApplication',
    label: 'Express',
  },
} as const;

export type HttpPlatform = keyof typeof httpPlatforms;

export function isHttpPlatform(value: unknown): value is HttpPlatform {
  return value === 'node' || value === 'express';
}

/** Exact audited runtime set; rebaseline separately from adding a selection. */
export const httpRuntimeVersion = '12.3.0';
