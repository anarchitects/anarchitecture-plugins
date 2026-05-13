import type { GovernanceProject, Violation } from './models.js';
import {
  deriveAllowedLayerDependenciesFromLayerOrder,
  type GovernanceProfile,
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

    const projectByName = projectByNameMap(workspace.projects);
    const violations = workspace.dependencies.flatMap((dependency) => {
      const source = projectByName.get(dependency.source);
      const target = projectByName.get(dependency.target);

      return evaluateDomainBoundaryDependency(
        source,
        target,
        dependency,
        profile
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

    const projectByName = projectByNameMap(workspace.projects);
    const declaredLayers = new Set(profile.layers);
    const usesExplicitLayerDependencies =
      profile.allowedLayerDependencies !== undefined;
    const allowedLayerDependencies =
      profile.allowedLayerDependencies ??
      deriveAllowedLayerDependenciesFromLayerOrder(profile.layers);

    const violations = workspace.dependencies.flatMap((dependency) => {
      const source = projectByName.get(dependency.source);
      const target = projectByName.get(dependency.target);

      return evaluateLayerBoundaryDependency(
        source,
        target,
        dependency,
        declaredLayers,
        usesExplicitLayerDependencies,
        allowedLayerDependencies,
        profile
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
    if (!profile?.ownership.required) {
      return {};
    }

    const violations = workspace.projects.flatMap((project) =>
      evaluateOwnershipPresence(project)
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
  const projectByName = projectByNameMap(workspace.projects);
  const declaredLayers = new Set(profile.layers);
  const usesExplicitLayerDependencies =
    profile.allowedLayerDependencies !== undefined;
  const allowedLayerDependencies =
    profile.allowedLayerDependencies ??
    deriveAllowedLayerDependenciesFromLayerOrder(profile.layers);
  const violations: Violation[] = [];

  for (const dependency of workspace.dependencies) {
    const source = projectByName.get(dependency.source);
    const target = projectByName.get(dependency.target);

    violations.push(
      ...evaluateDomainBoundaryDependency(source, target, dependency, profile)
    );
    violations.push(
      ...evaluateLayerBoundaryDependency(
        source,
        target,
        dependency,
        declaredLayers,
        usesExplicitLayerDependencies,
        allowedLayerDependencies,
        profile
      )
    );
  }

  if (profile.ownership.required) {
    for (const project of workspace.projects) {
      violations.push(...evaluateOwnershipPresence(project));
    }
  }

  return violations;
}

function evaluateDomainBoundaryDependency(
  source: GovernanceProject | undefined,
  target: GovernanceProject | undefined,
  dependency: GovernanceRuleContext['workspace']['dependencies'][number],
  profile: GovernanceProfile
): Violation[] {
  if (!source || !target) {
    return [];
  }

  if (
    !source.domain ||
    !target.domain ||
    source.domain === target.domain ||
    isDomainDependencyAllowed(profile, source.domain, target.domain)
  ) {
    return [];
  }

  return [
    {
      id: `${source.name}-${target.name}-domain`,
      ruleId: 'domain-boundary',
      project: source.name,
      severity: 'error',
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
  usesExplicitLayerDependencies: boolean,
  allowedLayerDependencies: Record<string, string[]>,
  profile: GovernanceProfile
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
      allowedLayerDependencies,
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
      severity: 'warning',
      category: 'boundary',
      message: `Layer violation: ${source.name} (${source.layer}) depends on ${target.name} (${target.layer}).`,
      details: {
        targetProject: target.name,
        sourceLayer: source.layer,
        targetLayer: target.layer,
        ...(usesExplicitLayerDependencies
          ? {
              allowedTargets: allowedLayerDependencies[source.layer] ?? [],
            }
          : {
              order: profile.layers,
            }),
      },
      recommendation: usesExplicitLayerDependencies
        ? 'Refactor the dependency or update allowedLayerDependencies in the governance profile when the dependency is intentional.'
        : 'Refactor dependency direction so higher-level layers depend on same or lower-level layers only.',
    },
  ];
}

function evaluateOwnershipPresence(project: GovernanceProject): Violation[] {
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
      severity: 'warning',
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
  profile: GovernanceProfile,
  sourceDomain: string,
  targetDomain: string
): boolean {
  const direct = profile.allowedDomainDependencies[sourceDomain];
  if (direct && (direct.includes(targetDomain) || direct.includes('*'))) {
    return true;
  }

  const wildcard = profile.allowedDomainDependencies['*'];
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
