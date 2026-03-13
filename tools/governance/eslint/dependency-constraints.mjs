import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function toDomainTag(domain) {
  return domain.startsWith('domain:') ? domain : `domain:${domain}`;
}

function listGovernanceProfiles() {
  const profilesDir = join(process.cwd(), 'tools/governance/profiles');
  if (!existsSync(profilesDir)) {
    return [];
  }

  return readdirSync(profilesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(profilesDir, name));
}

function readProfiles() {
  return listGovernanceProfiles().flatMap((filePath) => {
    try {
      return [JSON.parse(readFileSync(filePath, 'utf8'))];
    } catch {
      return [];
    }
  });
}

function mergeAllowedDomainDependencies(profiles) {
  const merged = {};

  for (const profile of profiles) {
    const allowed =
      profile &&
      profile.allowedDomainDependencies &&
      typeof profile.allowedDomainDependencies === 'object'
        ? profile.allowedDomainDependencies
        : {};

    for (const [sourceDomain, targets] of Object.entries(allowed)) {
      if (!Array.isArray(targets)) {
        continue;
      }

      if (!merged[sourceDomain]) {
        merged[sourceDomain] = [];
      }

      for (const target of targets) {
        if (typeof target === 'string') {
          merged[sourceDomain].push(target);
        }
      }
    }
  }

  for (const [sourceDomain, targets] of Object.entries(merged)) {
    merged[sourceDomain] = Array.from(new Set(targets));
  }

  return merged;
}

function buildDepConstraintsFromGovernanceProfiles() {
  const profiles = readProfiles();
  const allowedDomainDependencies = mergeAllowedDomainDependencies(profiles);

  const wildcardAllowed = Array.isArray(allowedDomainDependencies['*'])
    ? allowedDomainDependencies['*']
    : [];

  const constraints = [
    {
      // Safe fallback for projects without domain tags.
      sourceTag: '*',
      onlyDependOnLibsWithTags: ['*'],
    },
  ];

  for (const [sourceDomain, allowedDomains] of Object.entries(
    allowedDomainDependencies
  )) {
    if (sourceDomain === '*') {
      continue;
    }

    if (!Array.isArray(allowedDomains)) {
      continue;
    }

    const allowedDomainTags = [
      ...allowedDomains,
      ...wildcardAllowed,
      sourceDomain,
    ]
      .filter((entry) => entry !== '*')
      .map(toDomainTag);

    constraints.push({
      sourceTag: toDomainTag(sourceDomain),
      onlyDependOnLibsWithTags: Array.from(new Set(allowedDomainTags)),
    });
  }

  return constraints;
}

export const governanceDepConstraints =
  buildDepConstraintsFromGovernanceProfiles();
