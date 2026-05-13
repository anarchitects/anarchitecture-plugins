import type { GovernanceRulePack } from './rules.js';

export const CORE_BUILT_IN_RULE_PACK_ID = 'core';

// #244 will migrate the current built-in policy behavior behind this pack.
export const coreBuiltInRulePack: GovernanceRulePack = {
  id: CORE_BUILT_IN_RULE_PACK_ID,
  name: 'Governance Core Built-in Rules',
  rules: [],
};

export const coreBuiltInRulePacks: GovernanceRulePack[] = [coreBuiltInRulePack];
