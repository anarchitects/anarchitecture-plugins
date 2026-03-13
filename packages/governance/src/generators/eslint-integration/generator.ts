import { formatFiles, logger, Tree } from '@nx/devkit';

interface EslintIntegrationSchema {
  skipFormat?: boolean;
}

const ESLINT_CONFIG_PATH = 'eslint.config.mjs';
const HELPER_PATH = 'tools/governance/eslint/dependency-constraints.mjs';

const HELPER_CONTENT = `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function toDomainTag(domain) {
  return domain.startsWith('domain:') ? domain : \`domain:\${domain}\`;
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
`;

// ---------------------------------------------------------------------------
// Migration: read inline ESLint depConstraints → governance profile JSON
// ---------------------------------------------------------------------------

const PROFILE_PATH = 'tools/governance/profiles/angular-cleanup.json';

interface RawDepConstraint {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
}

function extractInlineDepConstraints(eslintContent: string): RawDepConstraint[] {
  // Already integrated — nothing to migrate.
  if (eslintContent.includes('governanceDepConstraints')) {
    return [];
  }

  const depMatch = eslintContent.match(/depConstraints:\s*(\[[\s\S]*?\])\s*,/);
  if (!depMatch) {
    return [];
  }

  const block = depMatch[1];
  const results: RawDepConstraint[] = [];
  const constraintRegex =
    /\{\s*sourceTag:\s*['"](([^'"])+)['"]\s*,\s*onlyDependOnLibsWithTags:\s*\[([^\]]*)\]\s*\}/g;

  let m: RegExpExecArray | null;
  while ((m = constraintRegex.exec(block)) !== null) {
    const sourceTag = m[1];
    const tagsStr = m[3];
    const tags: string[] = [];
    const tagRegex = /['"](([^'"])+)['"]/g;
    let tm: RegExpExecArray | null;
    while ((tm = tagRegex.exec(tagsStr)) !== null) {
      tags.push(tm[1]);
    }
    results.push({ sourceTag, onlyDependOnLibsWithTags: tags });
  }

  return results;
}

function buildAllowedDomainMapFromConstraints(
  constraints: RawDepConstraint[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  for (const { sourceTag, onlyDependOnLibsWithTags } of constraints) {
    if (sourceTag === '*' || !sourceTag.startsWith('domain:')) {
      continue;
    }

    const sourceDomain = sourceTag.slice('domain:'.length);
    const allowed = onlyDependOnLibsWithTags
      .filter((t) => t.startsWith('domain:'))
      .map((t) => t.slice('domain:'.length))
      .filter((d) => d !== '*' && d !== sourceDomain);

    map[sourceDomain] = Array.from(
      new Set([...(map[sourceDomain] ?? []), ...allowed])
    );
  }

  return map;
}

function migrateConstraintsToProfile(tree: Tree): void {
  if (!tree.exists(ESLINT_CONFIG_PATH) || !tree.exists(PROFILE_PATH)) {
    return;
  }

  const eslintContent = tree.read(ESLINT_CONFIG_PATH, 'utf8') ?? '';
  const constraints = extractInlineDepConstraints(eslintContent);

  if (constraints.length === 0) {
    return;
  }

  const migrated = buildAllowedDomainMapFromConstraints(constraints);
  if (Object.keys(migrated).length === 0) {
    return;
  }

  const profile = JSON.parse(
    tree.read(PROFILE_PATH, 'utf8') ?? '{}'
  ) as {
    allowedDomainDependencies?: Record<string, string[]>;
    [key: string]: unknown;
  };

  // Merge: existing profile entries take precedence (they were explicitly authored).
  const existing = profile.allowedDomainDependencies ?? {};
  const merged: Record<string, string[]> = { ...migrated };

  for (const [domain, targets] of Object.entries(existing) as [string, string[]][]) {
    merged[domain] = Array.from(new Set([...(merged[domain] ?? []), ...targets]));
  }

  profile.allowedDomainDependencies = merged;
  tree.write(PROFILE_PATH, JSON.stringify(profile, null, 2) + '\n');

  logger.info(
    `Nx Governance: Migrated ${constraints.length} ESLint depConstraints rules into governance profile.`
  );
}

export async function eslintIntegrationGenerator(
  tree: Tree,
  options: EslintIntegrationSchema
): Promise<void> {
  migrateConstraintsToProfile(tree);
  tree.write(HELPER_PATH, HELPER_CONTENT);
  ensureEslintConfigIntegration(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function ensureEslintConfigIntegration(tree: Tree): void {
  if (!tree.exists(ESLINT_CONFIG_PATH)) {
    logger.warn(
      'Nx Governance: eslint.config.mjs was not found. Skipping ESLint integration generation.'
    );
    return;
  }

  let content = tree.read(ESLINT_CONFIG_PATH, 'utf8') ?? '';

  content = content.replace(/import\s+\{\s*readFileSync\s*\}\s+from\s+'node:fs';\n?/g, '');

  content = content.replace(
    /function readGovernanceProfile\([\s\S]*?const governanceDepConstraints = buildDepConstraintsFromGovernance\([\s\S]*?\);\n\n/g,
    ''
  );

  const integrationImport =
    "import { governanceDepConstraints } from './tools/governance/eslint/dependency-constraints.mjs';\n";

  if (!content.includes(integrationImport.trim())) {
    content = content.replace(
      "import nx from '@nx/eslint-plugin';\n",
      `import nx from '@nx/eslint-plugin';\n${integrationImport}`
    );
  }

  if (!content.includes('depConstraints: governanceDepConstraints')) {
    content = content.replace(
      /depConstraints:\s*(\[[\s\S]*?\]|[A-Za-z_$][\w$]*)\s*,/m,
      'depConstraints: governanceDepConstraints,'
    );
  }

  tree.write(ESLINT_CONFIG_PATH, content);
}

export default eslintIntegrationGenerator;
