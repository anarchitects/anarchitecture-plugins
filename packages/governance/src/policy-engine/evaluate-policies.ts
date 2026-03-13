import {
  GovernanceProfile,
  GovernanceWorkspace,
  Violation,
} from '../core/index.js';

export function evaluatePolicies(
  workspace: GovernanceWorkspace,
  profile: GovernanceProfile
): Violation[] {
  const violations: Violation[] = [];
  const projectByName = new Map(workspace.projects.map((project) => [project.name, project]));
  const layerIndex = new Map(profile.layers.map((layer, index) => [layer, index]));

  for (const dependency of workspace.dependencies) {
    const source = projectByName.get(dependency.source);
    const target = projectByName.get(dependency.target);

    if (!source || !target) {
      continue;
    }

    if (
      source.domain &&
      target.domain &&
      source.domain !== target.domain &&
      !isDomainDependencyAllowed(profile, source.domain, target.domain)
    ) {
      violations.push({
        id: `${source.name}-${target.name}-domain`,
        ruleId: 'domain-boundary',
        project: source.name,
        severity: 'error',
        message: `Project ${source.name} in domain ${source.domain} depends on ${target.name} in domain ${target.domain}.`,
        details: {
          sourceDomain: source.domain,
          targetDomain: target.domain,
          dependencyType: dependency.type,
        },
        recommendation:
          'Move the dependency behind an API or adjust domain boundaries in the governance profile.',
      });
    }

    const sourceLayer = source.layer ? layerIndex.get(source.layer) : undefined;
    const targetLayer = target.layer ? layerIndex.get(target.layer) : undefined;

    if (
      sourceLayer !== undefined &&
      targetLayer !== undefined &&
      sourceLayer > targetLayer
    ) {
      violations.push({
        id: `${source.name}-${target.name}-layer`,
        ruleId: 'layer-boundary',
        project: source.name,
        severity: 'warning',
        message: `Layer violation: ${source.name} (${source.layer}) depends on ${target.name} (${target.layer}).`,
        details: {
          sourceLayer: source.layer,
          targetLayer: target.layer,
          order: profile.layers,
        },
        recommendation:
          'Refactor dependency direction so higher-level layers depend on same or lower-level layers only.',
      });
    }
  }

  if (profile.ownership.required) {
    for (const project of workspace.projects) {
      if (!project.ownership?.team && !(project.ownership?.contacts?.length ?? 0)) {
        violations.push({
          id: `${project.name}-ownership`,
          ruleId: 'ownership-presence',
          project: project.name,
          severity: 'warning',
          message: `Project ${project.name} has no ownership metadata or CODEOWNERS mapping.`,
          recommendation:
            'Add ownership metadata in project configuration or ensure CODEOWNERS covers the project root.',
        });
      }
    }
  }

  return violations;
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
