import type { GovernanceProject, Violation } from './models.js';
import {
  deriveAllowedLayerDependenciesFromLayerOrder,
  normalizeGovernanceProfile,
  type GovernanceDomainBoundaryRuleOptions,
  type GovernanceLayerBoundaryRuleOptions,
  type GovernanceOwnershipPresenceRuleOptions,
} from './profile.js';
import type { GovernanceRule, GovernanceRuleContext } from './rules.js';

export const domainBoundaryRule: GovernanceRule = {
  id: 'domain-boundary',
  name: 'Domain Boundary',
  description:
    'Enforces allowed dependencies between projects in different domains.',
  category: 'boundary',
  defaultSeverity: 'error',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[domainBoundaryRule.id];
    const options = ruleConfig?.options as
      | GovernanceDomainBoundaryRuleOptions
      | undefined;
    const severity = ruleConfig?.severity ?? domainBoundaryRule.defaultSeverity;
    const projectByName = projectByNameMap(workspace.projects);
    const violations = workspace.dependencies.flatMap((dependency) => {
      const source = projectByName.get(dependency.source);
      const target = projectByName.get(dependency.target);

      return evaluateDomainBoundaryDependency(
        source,
        target,
        dependency,
        options ?? {
          allowedDependencies: profile.allowedDomainDependencies,
        },
        severity
      );
    });

    return { violations };
  },
};

export const layerBoundaryRule: GovernanceRule = {
  id: 'layer-boundary',
  name: 'Layer Boundary',
  description:
    'Enforces allowed dependencies between declared architectural layers.',
  category: 'boundary',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[layerBoundaryRule.id];
    const options = ruleConfig?.options as
      | GovernanceLayerBoundaryRuleOptions
      | undefined;
    const normalizedOptions = options ?? {
      allowedDependencies:
        profile.allowedLayerDependencies ??
        deriveAllowedLayerDependenciesFromLayerOrder(profile.layers),
      layers: [...profile.layers],
      usesExplicitDependencies: profile.allowedLayerDependencies !== undefined,
    };
    const severity = ruleConfig?.severity ?? layerBoundaryRule.defaultSeverity;
    const projectByName = projectByNameMap(workspace.projects);
    const declaredLayers = new Set(normalizedOptions.layers);

    const violations = workspace.dependencies.flatMap((dependency) => {
      const source = projectByName.get(dependency.source);
      const target = projectByName.get(dependency.target);

      return evaluateLayerBoundaryDependency(
        source,
        target,
        dependency,
        declaredLayers,
        normalizedOptions,
        severity
      );
    });

    return { violations };
  },
};

export const ownershipPresenceRule: GovernanceRule = {
  id: 'ownership-presence',
  name: 'Ownership Presence',
  description:
    'Requires ownership metadata or CODEOWNERS coverage when profiles demand it.',
  category: 'ownership',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[ownershipPresenceRule.id];
    const options = ruleConfig?.options as
      | GovernanceOwnershipPresenceRuleOptions
      | undefined;
    const normalizedOptions = options ?? {
      required: profile.ownership.required,
      metadataField: profile.ownership.metadataField,
    };
    const severity =
      ruleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;

    if (!normalizedOptions.required) {
      return {};
    }

    const violations = workspace.projects.flatMap((project) =>
      evaluateOwnershipPresence(project, severity)
    );

    return { violations };
  },
};

export const coreBuiltInPolicyRules: GovernanceRule[] = [
  domainBoundaryRule,
  layerBoundaryRule,
  ownershipPresenceRule,
];

export function evaluateCoreBuiltInPolicyViolations(
  context: GovernanceRuleContext
): Violation[] {
  if (!context.profile) {
    return [];
  }

  const { workspace, profile } = context;
  const normalizedProfile = normalizeGovernanceProfile(profile);
  const domainRuleConfig = normalizedProfile.rules[domainBoundaryRule.id];
  const domainOptions = (domainRuleConfig?.options as
    | GovernanceDomainBoundaryRuleOptions
    | undefined) ?? {
    allowedDependencies: profile.allowedDomainDependencies,
  };
  const domainSeverity =
    domainRuleConfig?.severity ?? domainBoundaryRule.defaultSeverity;
  const layerRuleConfig = normalizedProfile.rules[layerBoundaryRule.id];
  const layerOptions = (layerRuleConfig?.options as
    | GovernanceLayerBoundaryRuleOptions
    | undefined) ?? {
    allowedDependencies:
      profile.allowedLayerDependencies ??
      deriveAllowedLayerDependenciesFromLayerOrder(profile.layers),
    layers: [...profile.layers],
    usesExplicitDependencies: profile.allowedLayerDependencies !== undefined,
  };
  const layerSeverity =
    layerRuleConfig?.severity ?? layerBoundaryRule.defaultSeverity;
  const ownershipRuleConfig = normalizedProfile.rules[ownershipPresenceRule.id];
  const ownershipOptions = (ownershipRuleConfig?.options as
    | GovernanceOwnershipPresenceRuleOptions
    | undefined) ?? {
    required: profile.ownership.required,
    metadataField: profile.ownership.metadataField,
  };
  const ownershipSeverity =
    ownershipRuleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;
  const projectByName = projectByNameMap(workspace.projects);
  const declaredLayers = new Set(layerOptions.layers);
  const violations: Violation[] = [];

  for (const dependency of workspace.dependencies) {
    const source = projectByName.get(dependency.source);
    const target = projectByName.get(dependency.target);

    violations.push(
      ...evaluateDomainBoundaryDependency(
        source,
        target,
        dependency,
        domainOptions,
        domainSeverity
      )
    );
    violations.push(
      ...evaluateLayerBoundaryDependency(
        source,
        target,
        dependency,
        declaredLayers,
        layerOptions,
        layerSeverity
      )
    );
  }

  if (ownershipOptions.required) {
    for (const project of workspace.projects) {
      violations.push(...evaluateOwnershipPresence(project, ownershipSeverity));
    }
  }

  return violations;
}

function evaluateDomainBoundaryDependency(
  source: GovernanceProject | undefined,
  target: GovernanceProject | undefined,
  dependency: GovernanceRuleContext['workspace']['dependencies'][number],
  options: GovernanceDomainBoundaryRuleOptions,
  severity: Violation['severity']
): Violation[] {
  if (!source || !target) {
    return [];
  }

  if (
    !source.domain ||
    !target.domain ||
    source.domain === target.domain ||
    isDomainDependencyAllowed(
      options.allowedDependencies,
      source.domain,
      target.domain
    )
  ) {
    return [];
  }

  return [
    {
      id: `${source.name}-${target.name}-domain`,
      ruleId: 'domain-boundary',
      project: source.name,
      severity,
      category: 'boundary',
      message: `Project ${source.name} in domain ${source.domain} depends on ${target.name} in domain ${target.domain}.`,
      details: {
        targetProject: target.name,
        sourceDomain: source.domain,
        targetDomain: target.domain,
        dependencyType: dependency.type,
      },
      recommendation:
        'Move the dependency behind an API or adjust domain boundaries in the governance profile.',
    },
  ];
}

function evaluateLayerBoundaryDependency(
  source: GovernanceProject | undefined,
  target: GovernanceProject | undefined,
  _dependency: GovernanceRuleContext['workspace']['dependencies'][number],
  declaredLayers: Set<string>,
  options: GovernanceLayerBoundaryRuleOptions,
  severity: Violation['severity']
): Violation[] {
  if (!source || !target) {
    return [];
  }

  if (
    !source.layer ||
    !target.layer ||
    !declaredLayers.has(source.layer) ||
    !declaredLayers.has(target.layer) ||
    isLayerDependencyAllowed(
      options.allowedDependencies,
      source.layer,
      target.layer
    )
  ) {
    return [];
  }

  return [
    {
      id: `${source.name}-${target.name}-layer`,
      ruleId: 'layer-boundary',
      project: source.name,
      severity,
      category: 'boundary',
      message: `Layer violation: ${source.name} (${source.layer}) depends on ${target.name} (${target.layer}).`,
      details: {
        targetProject: target.name,
        sourceLayer: source.layer,
        targetLayer: target.layer,
        ...(options.usesExplicitDependencies
          ? {
              allowedTargets: options.allowedDependencies[source.layer] ?? [],
            }
          : {
              order: options.layers,
            }),
      },
      recommendation: options.usesExplicitDependencies
        ? 'Refactor the dependency or update allowedLayerDependencies in the governance profile when the dependency is intentional.'
        : 'Refactor dependency direction so higher-level layers depend on same or lower-level layers only.',
    },
  ];
}

function evaluateOwnershipPresence(
  project: GovernanceProject,
  severity: Violation['severity']
): Violation[] {
  if (
    project.ownership?.team ||
    (project.ownership?.contacts?.length ?? 0) > 0
  ) {
    return [];
  }

  return [
    {
      id: `${project.name}-ownership`,
      ruleId: 'ownership-presence',
      project: project.name,
      severity,
      category: 'ownership',
      message: `Project ${project.name} has no ownership metadata or CODEOWNERS mapping.`,
      recommendation:
        'Add ownership metadata in project configuration or ensure CODEOWNERS covers the project root.',
    },
  ];
}

function projectByNameMap(
  projects: GovernanceProject[]
): Map<string, GovernanceProject> {
  return new Map(projects.map((project) => [project.name, project]));
}

function isDomainDependencyAllowed(
  allowedDependencies: Record<string, string[]>,
  sourceDomain: string,
  targetDomain: string
): boolean {
  const direct = allowedDependencies[sourceDomain];
  if (direct && (direct.includes(targetDomain) || direct.includes('*'))) {
    return true;
  }

  const wildcard = allowedDependencies['*'];
  if (wildcard && (wildcard.includes(targetDomain) || wildcard.includes('*'))) {
    return true;
  }

  return false;
}

function isLayerDependencyAllowed(
  allowedLayerDependencies: Record<string, string[]>,
  sourceLayer: string,
  targetLayer: string
): boolean {
  return (allowedLayerDependencies[sourceLayer] ?? []).includes(targetLayer);
}
