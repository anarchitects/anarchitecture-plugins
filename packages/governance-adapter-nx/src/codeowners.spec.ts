import { ownersForProjectRoot } from './codeowners.js';

describe('CODEOWNERS matching', () => {
  it('matches anchored directory patterns', () => {
    const owners = ownersForProjectRoot('packages/governance', [
      { pattern: '/packages/governance/', owners: ['@team/governance'] },
    ]);

    expect(owners).toEqual(['@team/governance']);
  });

  it('matches wildcard segment patterns', () => {
    const owners = ownersForProjectRoot('packages/governance-e2e', [
      { pattern: '/packages/*-e2e/', owners: ['@team/e2e'] },
    ]);

    expect(owners).toEqual(['@team/e2e']);
  });

  it('uses the last matching rule', () => {
    const owners = ownersForProjectRoot('packages/governance/src', [
      { pattern: '/packages/governance/', owners: ['@team/base'] },
      { pattern: '/packages/governance/src/', owners: ['@team/src'] },
    ]);

    expect(owners).toEqual(['@team/src']);
  });

  it('matches slashless patterns anywhere', () => {
    const owners = ownersForProjectRoot('packages/governance', [
      { pattern: 'governance', owners: ['@team/name'] },
    ]);

    expect(owners).toEqual(['@team/name']);
  });
});
