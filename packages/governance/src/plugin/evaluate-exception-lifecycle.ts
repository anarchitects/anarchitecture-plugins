import type { GovernanceException } from '../core/index.js';

export type GovernanceExceptionStatus = 'active' | 'stale' | 'expired';

export interface GovernanceExceptionLifecycle {
  exception: GovernanceException;
  status: GovernanceExceptionStatus;
}

export function evaluateExceptionLifecycle(
  exception: GovernanceException,
  asOf: Date
): GovernanceExceptionLifecycle {
  const asOfMs = asOf.getTime();

  const expiresAtMs = parseLifecycleDate(exception.review.expiresAt);
  if (expiresAtMs !== undefined && expiresAtMs < asOfMs) {
    return {
      exception,
      status: 'expired',
    };
  }

  const reviewByMs = parseLifecycleDate(exception.review.reviewBy);
  if (reviewByMs !== undefined && reviewByMs < asOfMs) {
    return {
      exception,
      status: 'stale',
    };
  }

  return {
    exception,
    status: 'active',
  };
}

function parseLifecycleDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  const timestamp = Date.parse(normalized);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid governance exception lifecycle date "${value}".`);
  }

  return timestamp;
}
