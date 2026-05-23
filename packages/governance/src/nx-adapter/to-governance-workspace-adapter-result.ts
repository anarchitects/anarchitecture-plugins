import type { GovernanceWorkspaceAdapterResult } from '@anarchitects/governance-core';

import { createNxWorkspaceAdapterResult } from '@anarchitects/governance-adapter-nx';
import type { AdapterWorkspaceSnapshot } from './types.js';

export function toGovernanceWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  return createNxWorkspaceAdapterResult(snapshot);
}
