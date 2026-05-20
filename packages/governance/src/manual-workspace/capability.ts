import type { GovernanceCapability } from '../extensions/capabilities.js';

export interface GovernanceManualWorkspaceCapabilityData {
  format: 'json' | 'yaml';
  schemaVersion: number;
}

export function createManualWorkspaceCapability(input: {
  format: 'json' | 'yaml';
  schemaVersion: number;
}): GovernanceCapability<GovernanceManualWorkspaceCapabilityData> {
  return {
    id: 'capability:manual-workspace',
    data: {
      format: input.format,
      schemaVersion: input.schemaVersion,
    },
  };
}
