import type {
  GovernanceCapabilityRequirement,
  GovernanceExtensionDefinition,
} from '@anarchitects/governance-core';

export const GOVERNANCE_EXTENSION_NX_ID = 'governance-extension-nx';
export const GOVERNANCE_EXTENSION_NX_NAME = 'Nx Governance Extension';
export const GOVERNANCE_EXTENSION_NX_VERSION = '0.0.1';

export const GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES: readonly GovernanceCapabilityRequirement[] =
  [
    {
      id: 'nx.project-graph',
      description: 'Nx projects discovered by the Nx governance adapter.',
    },
    {
      id: 'nx.dependency-graph',
      description:
        'Nx project dependencies discovered by the Nx governance adapter.',
    },
    {
      id: 'nx.project-metadata',
      description:
        'Nx project metadata extracted by the Nx governance adapter.',
    },
    {
      id: 'nx.project-tags',
      description: 'Nx project tags extracted by the Nx governance adapter.',
    },
    {
      id: 'nx.targets',
      description: 'Nx target names extracted by the Nx governance adapter.',
    },
    {
      id: 'nx.inferred-targets',
      description:
        'Project Crystal inference inputs reported by the Nx governance adapter.',
    },
    {
      id: 'nx.governance-profiles',
      description:
        'Governance profile files discovered by the Nx governance adapter.',
    },
    {
      id: 'nx.ownership-evidence',
      description:
        'Ownership evidence discovered by the Nx governance adapter.',
    },
  ];

export const governanceExtensionNx: GovernanceExtensionDefinition = {
  id: GOVERNANCE_EXTENSION_NX_ID,
  name: GOVERNANCE_EXTENSION_NX_NAME,
  version: GOVERNANCE_EXTENSION_NX_VERSION,
  optionalCapabilities: [...GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES],
  register(): void {
    // #408 and #409 found no existing Nx-specific contributions to register.
    // Future Nx-specific rules and intelligence providers belong here.
  },
};

export function createGovernanceExtensionNx(): GovernanceExtensionDefinition {
  return governanceExtensionNx;
}

export default governanceExtensionNx;
