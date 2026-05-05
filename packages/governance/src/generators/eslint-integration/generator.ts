import { formatFiles, logger, Tree } from '@nx/devkit';
import {
  GOVERNANCE_DEFAULT_ESLINT_CONFIG_PATH,
  GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
  GOVERNANCE_DEFAULT_PROFILE_NAME,
  GOVERNANCE_SUPPORTED_FLAT_ESLINT_CONFIG_PATHS,
  GovernanceProfileFile,
  normalizeWorkspaceRelativePath,
  resolveGovernanceProfilesDirectoryFromPath,
  resolveGovernanceSelectedProfileRelativePath,
  toRelativeModuleSpecifier,
} from '../../profile/runtime-profile.js';
import { createAngularCleanupStarterProfile } from '../../presets/angular-cleanup/profile.js';

interface EslintIntegrationSchema {
  eslintConfigPath?: string;
  governanceHelperPath?: string;
  profile?: string;
  profilePath?: string;
  skipFormat?: boolean;
}

const DEFAULT_ESLINT_OPTIONS = {
  eslintConfigPath: GOVERNANCE_DEFAULT_ESLINT_CONFIG_PATH,
  governanceHelperPath: GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
};

function buildHelperContent(profilesDirectory: string): string {
  return `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function toDomainTag(domain) {
  return domain.startsWith('domain:') ? domain : \`domain:\${domain}\`;
}

function listGovernanceProfiles() {
  const profilesDir = join(process.cwd(), ${JSON.stringify(profilesDirectory)});
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
}

// ---------------------------------------------------------------------------
// Migration: read inline ESLint depConstraints → governance profile JSON
// ---------------------------------------------------------------------------

interface RawDepConstraint {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
}

function extractInlineDepConstraints(
  eslintContent: string
): RawDepConstraint[] {
  // Already integrated — nothing to migrate.
  if (eslintContent.includes('governanceDepConstraints')) {
    return [];
  }

  const block = extractDepConstraintsArrayLiteral(eslintContent);

  if (!block) {
    return [];
  }

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

function extractDepConstraintsArrayLiteral(
  eslintContent: string
): string | null {
  const depConstraintsIndex = eslintContent.indexOf('depConstraints:');

  if (depConstraintsIndex === -1) {
    return null;
  }

  const arrayStartIndex = eslintContent.indexOf('[', depConstraintsIndex);

  if (arrayStartIndex === -1) {
    return null;
  }

  let depth = 0;

  for (let index = arrayStartIndex; index < eslintContent.length; index += 1) {
    const character = eslintContent[index];

    if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;

      if (depth === 0) {
        return eslintContent.slice(arrayStartIndex, index + 1);
      }
    }
  }

  return null;
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

interface ResolvedEslintIntegrationOptions {
  eslintConfigPath: string;
  eslintConfigPathWasExplicit: boolean;
  governanceHelperPath: string;
  profilePath: string;
  profilesDirectory: string;
  helperImportPath: string;
  createsProfileIfMissing: boolean;
}

function resolveOptions(
  tree: Tree,
  options: EslintIntegrationSchema
): ResolvedEslintIntegrationOptions {
  const explicitEslintConfigPath =
    typeof options.eslintConfigPath === 'string'
      ? normalizeWorkspaceRelativePath(options.eslintConfigPath)
      : undefined;
  const eslintConfigPath =
    explicitEslintConfigPath ??
    detectFlatEslintConfigPath(tree) ??
    DEFAULT_ESLINT_OPTIONS.eslintConfigPath;
  const governanceHelperPath = normalizeWorkspaceRelativePath(
    options.governanceHelperPath ?? DEFAULT_ESLINT_OPTIONS.governanceHelperPath
  );
  const profilePath = resolveGovernanceSelectedProfileRelativePath({
    profile: options.profile ?? GOVERNANCE_DEFAULT_PROFILE_NAME,
    profilePath: options.profilePath,
  });

  return {
    eslintConfigPath,
    eslintConfigPathWasExplicit: explicitEslintConfigPath !== undefined,
    governanceHelperPath,
    profilePath,
    profilesDirectory: resolveGovernanceProfilesDirectoryFromPath(profilePath),
    helperImportPath: toRelativeModuleSpecifier(
      eslintConfigPath,
      governanceHelperPath
    ),
    createsProfileIfMissing:
      typeof options.profile === 'string' ||
      typeof options.profilePath === 'string' ||
      governanceHelperPath !== GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH,
  };
}

function detectFlatEslintConfigPath(tree: Tree): string | null {
  for (const candidate of GOVERNANCE_SUPPORTED_FLAT_ESLINT_CONFIG_PATHS) {
    if (tree.exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readOrCreateProfile(
  tree: Tree,
  profilePath: string,
  createsProfileIfMissing: boolean
): GovernanceProfileFile | null {
  if (!tree.exists(profilePath)) {
    if (!createsProfileIfMissing) {
      return null;
    }

    return {
      ...createAngularCleanupStarterProfile(),
      allowedDomainDependencies: {},
    };
  }

  return JSON.parse(
    tree.read(profilePath, 'utf8') ?? '{}'
  ) as GovernanceProfileFile;
}

function ensureProfileEslintSettings(
  tree: Tree,
  options: ResolvedEslintIntegrationOptions
): void {
  if (
    options.governanceHelperPath === GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH &&
    !options.createsProfileIfMissing
  ) {
    return;
  }

  const profile = readOrCreateProfile(
    tree,
    options.profilePath,
    options.createsProfileIfMissing
  );

  if (!profile) {
    return;
  }

  if (options.governanceHelperPath !== GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH) {
    profile.eslint = {
      ...(profile.eslint ?? {}),
      helperPath: options.governanceHelperPath,
    };
  }

  tree.write(options.profilePath, JSON.stringify(profile, null, 2) + '\n');
}

function migrateConstraintsToProfile(
  tree: Tree,
  options: ResolvedEslintIntegrationOptions
): void {
  if (!tree.exists(options.eslintConfigPath)) {
    return;
  }

  const eslintContent = tree.read(options.eslintConfigPath, 'utf8') ?? '';
  const constraints = extractInlineDepConstraints(eslintContent);

  if (constraints.length === 0) {
    return;
  }

  const migrated = buildAllowedDomainMapFromConstraints(constraints);
  if (Object.keys(migrated).length === 0) {
    return;
  }

  const profile = readOrCreateProfile(
    tree,
    options.profilePath,
    options.createsProfileIfMissing
  );

  if (!profile) {
    return;
  }

  // Merge: existing profile entries take precedence (they were explicitly authored).
  const existing = profile.allowedDomainDependencies ?? {};
  const merged: Record<string, string[]> = { ...migrated };

  for (const [domain, targets] of Object.entries(existing) as [
    string,
    string[]
  ][]) {
    merged[domain] = Array.from(
      new Set([...(merged[domain] ?? []), ...targets])
    );
  }

  if (
    options.governanceHelperPath !== GOVERNANCE_DEFAULT_ESLINT_HELPER_PATH ||
    profile.eslint?.helperPath
  ) {
    profile.eslint = {
      ...(profile.eslint ?? {}),
      helperPath: options.governanceHelperPath,
    };
  }

  profile.allowedDomainDependencies = merged;
  tree.write(options.profilePath, JSON.stringify(profile, null, 2) + '\n');

  logger.info(
    `Nx Governance: Migrated ${constraints.length} ESLint depConstraints rules into governance profile.`
  );
}

export async function eslintIntegrationGenerator(
  tree: Tree,
  options: EslintIntegrationSchema
): Promise<void> {
  const resolved = resolveOptions(tree, options);

  ensureProfileEslintSettings(tree, resolved);
  migrateConstraintsToProfile(tree, resolved);
  tree.write(
    resolved.governanceHelperPath,
    buildHelperContent(resolved.profilesDirectory)
  );
  ensureEslintConfigIntegration(tree, resolved);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function ensureEslintConfigIntegration(
  tree: Tree,
  options: ResolvedEslintIntegrationOptions
): void {
  if (!tree.exists(options.eslintConfigPath)) {
    if (options.eslintConfigPathWasExplicit) {
      logger.warn(
        `Nx Governance: ${options.eslintConfigPath} was not found. Skipping ESLint integration generation.`
      );
    } else {
      logger.warn(
        `Nx Governance: No supported flat ESLint config was found. Checked ${GOVERNANCE_SUPPORTED_FLAT_ESLINT_CONFIG_PATHS.join(
          ', '
        )}. Legacy .eslintrc* config detection is intentionally out of scope; use eslintConfigPath for an explicit flat config path.`
      );
    }
    return;
  }

  let content = tree.read(options.eslintConfigPath, 'utf8') ?? '';

  content = content.replace(
    /import\s+\{\s*readFileSync\s*\}\s+from\s+'node:fs';\n?/g,
    ''
  );
  content = content.replace(
    /import\s+\{\s*governanceDepConstraints\s*\}\s+from\s+['"][^'"]+['"];\n?/g,
    ''
  );

  content = content.replace(
    /function readGovernanceProfile\([\s\S]*?const governanceDepConstraints = buildDepConstraintsFromGovernance\([\s\S]*?\);\n\n/g,
    ''
  );

  const integrationImport = `import { governanceDepConstraints } from '${options.helperImportPath}';\n`;

  if (!content.includes(integrationImport.trim())) {
    if (content.includes("import nx from '@nx/eslint-plugin';\n")) {
      content = content.replace(
        "import nx from '@nx/eslint-plugin';\n",
        `import nx from '@nx/eslint-plugin';\n${integrationImport}`
      );
    } else {
      content = `${integrationImport}${content}`;
    }
  }

  if (!content.includes('depConstraints: governanceDepConstraints')) {
    content = content.replace(
      /depConstraints:\s*(\[[\s\S]*?\]|[A-Za-z_$][\w$]*)\s*,/m,
      'depConstraints: governanceDepConstraints,'
    );
  }

  tree.write(options.eslintConfigPath, content);
}

export default eslintIntegrationGenerator;
