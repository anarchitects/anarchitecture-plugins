import type { GovernanceException } from '../core/index.js';
import { evaluateExceptionLifecycle } from './evaluate-exception-lifecycle.js';

describe('evaluateExceptionLifecycle', () => {
  const asOf = new Date('2026-04-17T00:00:00.000Z');

  it('classifies exceptions with future reviewBy as active', () => {
    expect(
      evaluateExceptionLifecycle(
        makeException({
          review: {
            reviewBy: '2026-05-01',
          },
        }),
        asOf
      )
    ).toMatchObject({
      status: 'active',
    });
  });

  it('classifies exceptions with past reviewBy as stale', () => {
    expect(
      evaluateExceptionLifecycle(
        makeException({
          review: {
            reviewBy: '2026-04-01',
          },
        }),
        asOf
      )
    ).toMatchObject({
      status: 'stale',
    });
  });

  it('classifies exceptions with past expiresAt as expired', () => {
    expect(
      evaluateExceptionLifecycle(
        makeException({
          review: {
            expiresAt: '2026-04-01',
          },
        }),
        asOf
      )
    ).toMatchObject({
      status: 'expired',
    });
  });

  it('prefers expired over stale when both dates are in the past', () => {
    expect(
      evaluateExceptionLifecycle(
        makeException({
          review: {
            reviewBy: '2026-04-01',
            expiresAt: '2026-04-10',
          },
        }),
        asOf
      )
    ).toMatchObject({
      status: 'expired',
    });
  });
});

function makeException(
  input: Partial<GovernanceException>
): GovernanceException {
  return {
    id: 'exception-id',
    source: 'policy',
    scope: {
      source: 'policy',
      ruleId: 'domain-boundary',
      projectId: 'orders-app',
    },
    reason: 'Test exception.',
    owner: '@org/architecture',
    review: {
      reviewBy: '2026-06-01',
    },
    ...input,
  };
}
