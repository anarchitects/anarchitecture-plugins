import type { GovernanceWorkspaceAdapterResult } from '../core/index.js';

import { createNxWorkspaceAdapterResult } from '@anarchitects/governance-adapter-nx';
import type { AdapterWorkspaceSnapshot } from './types.js';

export function toGovernanceWorkspaceAdapterResult(
  snapshot: AdapterWorkspaceSnapshot
): GovernanceWorkspaceAdapterResult {
  return createNxWorkspaceAdapterResult(snapshot);
}
