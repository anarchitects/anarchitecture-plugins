import { workspaceRoot } from '@nx/devkit';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Category =
  | 'boundary'
  | 'ownership'
  | 'dependency'
  | 'compliance'
  | 'unknown';

export interface ConformanceFinding {
  id: string;
  ruleId?: string;
  category: Category;
  severity: 'info' | 'warning' | 'error';
  projectId?: string;
  relatedProjectIds: string[];
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ConformanceSnapshot {
  workspaceId?: string;
  findings: ConformanceFinding[];
  extractedAt: string;
  source: 'nx-conformance';
}

export interface ConformanceSummary {
  total: number;
  errors: number;
  warnings: number;
}

export interface ConformanceAdapterOptions {
  conformanceJson: string;
}

export type ConformanceAdapterErrorReason =
  | 'file not found'
  | 'invalid JSON'
  | 'unsupported shape'
  | 'read failure';

export class ConformanceAdapterError extends Error {
  constructor(
    message: string,
    public readonly reason: ConformanceAdapterErrorReason
  ) {
    super(message);
    this.name = 'ConformanceAdapterError';
  }
}

interface CategoryRuleMatcher {
  category: Category;
  patterns: RegExp[];
}

const CATEGORY_RULE_MATCHERS: CategoryRuleMatcher[] = [
  {
    category: 'boundary',
    patterns: [/boundar(y|ies)/i, /module[-\s]?boundar/i],
  },
  {
    category: 'dependency',
    patterns: [/dependenc/i, /imports?/i],
  },
  {
    category: 'ownership',
    patterns: [/owner/i, /ownership/i, /codeowners?/i],
  },
  {
    category: 'compliance',
    patterns: [/compliance/i, /conformance/i],
  },
];

const MAPPED_FINDER_KEYS = new Set([
  'id',
  'rule',
  'ruleId',
  'severity',
  'level',
  'message',
  'description',
  'project',
  'projectId',
  'sourceProject',
  'sourceProjectId',
  'targetProject',
  'targetProjectId',
  'relatedProjectIds',
  'relatedProjects',
  'projectIds',
  'projects',
]);

const MAX_METADATA_ARRAY_LENGTH = 25;

export class ConformanceAdapter {
  readSnapshot(options: ConformanceAdapterOptions): ConformanceSnapshot {
    const conformanceJsonPath = path.isAbsolute(options.conformanceJson)
      ? options.conformanceJson
      : path.resolve(workspaceRoot, options.conformanceJson);

    let parsed: unknown;

    try {
      const rawJson = readFileSync(conformanceJsonPath, 'utf8');
      parsed = JSON.parse(rawJson);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new ConformanceAdapterError(
          `Conformance file not found at ${conformanceJsonPath}.`,
          'file not found'
        );
      }

      if (error instanceof SyntaxError) {
        throw new ConformanceAdapterError(
          `Conformance file at ${conformanceJsonPath} contains invalid JSON.`,
          'invalid JSON'
        );
      }

      throw new ConformanceAdapterError(
        `Unable to read conformance file at ${conformanceJsonPath}.`,
        'read failure'
      );
    }

    return this.readSnapshotFromParsedInput(parsed);
  }

  readSnapshotFromParsedInput(input: unknown): ConformanceSnapshot {
    const findings = extractRawFindings(input);
    const workspaceId = extractWorkspaceId(input);

    const normalized = findings
      .map((entry, index) => normalizeFinding(entry, index))
      .sort(
        (a, b) => a.id.localeCompare(b.id) || a.message.localeCompare(b.message)
      );

    return {
      workspaceId,
      findings: normalized,
      extractedAt: new Date().toISOString(),
      source: 'nx-conformance',
    };
  }
}

const defaultConformanceAdapter = new ConformanceAdapter();

export function readConformanceSnapshot(
  options: ConformanceAdapterOptions
): ConformanceSnapshot {
  return defaultConformanceAdapter.readSnapshot(options);
}

export function mapRuleToCategory(ruleId?: string, message?: string): Category {
  const searchText = `${ruleId ?? ''} ${message ?? ''}`.trim();
  if (!searchText) {
    return 'unknown';
  }

  for (const matcher of CATEGORY_RULE_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(searchText))) {
      return matcher.category;
    }
  }

  return 'unknown';
}

export function normalizeSeverity(rawSeverity: unknown): {
  severity: 'info' | 'warning' | 'error';
  normalized: boolean;
} {
  if (typeof rawSeverity !== 'string') {
    return { severity: 'warning', normalized: true };
  }

  const value = rawSeverity.trim().toLowerCase();

  if (value === 'error') {
    return { severity: 'error', normalized: false };
  }

  if (value === 'warn' || value === 'warning') {
    return { severity: 'warning', normalized: false };
  }

  if (value === 'info') {
    return { severity: 'info', normalized: false };
  }

  return { severity: 'warning', normalized: true };
}

export function extractProjects(finding: unknown): {
  projectId?: string;
  relatedProjectIds: string[];
} {
  const record = asRecord(finding) ?? {};
  const projectId = firstDefinedString([
    asString(record.projectId),
    readProjectIdentifier(record.project),
    asString(record.sourceProjectId),
    readProjectIdentifier(record.sourceProject),
  ]);

  const relatedProjectIds = uniqueSorted([
    ...collectProjectIds(record.relatedProjectIds),
    ...collectProjectIds(record.relatedProjects),
    ...collectProjectIds(record.projectIds),
    ...collectProjectIds(record.projects),
    asString(record.targetProjectId),
    readProjectIdentifier(record.targetProject),
  ]).filter((value) => value !== projectId);

  return {
    projectId,
    relatedProjectIds,
  };
}

export function sanitizeMetadata(
  finding: unknown
): Record<string, unknown> | undefined {
  const record = asRecord(finding);
  if (!record) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(record)
    .filter(([key]) => !MAPPED_FINDER_KEYS.has(key))
    .map(([key, value]) => [key, sanitizeMetadataValue(value)] as const)
    .filter(([, value]) => value !== undefined);

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

export function summarizeConformance(
  snapshot: ConformanceSnapshot
): ConformanceSummary {
  return snapshot.findings.reduce(
    (summary, finding) => {
      if (finding.severity === 'error') {
        summary.errors += 1;
      } else if (finding.severity === 'warning') {
        summary.warnings += 1;
      }
      summary.total += 1;
      return summary;
    },
    { total: 0, errors: 0, warnings: 0 }
  );
}

function normalizeFinding(
  rawFinding: unknown,
  index: number
): ConformanceFinding {
  const record = asRecord(rawFinding) ?? {};
  const ruleId = firstDefinedString([
    asString(record.ruleId),
    asString(record.rule),
  ]);
  const rawMessage = firstDefinedString([
    asString(record.message),
    asString(record.description),
  ]);
  const message = rawMessage ?? 'No message provided.';
  const { projectId, relatedProjectIds } = extractProjects(record);
  const severitySource = firstDefinedString([
    asString(record.severity),
    asString(record.level),
  ]);
  const normalizedSeverity = normalizeSeverity(severitySource);
  const metadata = sanitizeMetadata(record);
  const id =
    firstDefinedString([asString(record.id)]) ??
    buildDeterministicFindingId(ruleId, rawMessage, projectId, index);

  const mergedMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
  };
  if (normalizedSeverity.normalized) {
    mergedMetadata.normalizedSeverity = true;
  }

  return {
    id,
    ruleId,
    category: mapRuleToCategory(ruleId, message),
    severity: normalizedSeverity.severity,
    projectId,
    relatedProjectIds,
    message,
    metadata:
      Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
  };
}

function buildDeterministicFindingId(
  ruleId: string | undefined,
  message: string | undefined,
  projectId: string | undefined,
  index: number
): string {
  const seed = `${ruleId ?? ''}|${message ?? ''}|${projectId ?? ''}`;
  if (seed === '||') {
    return `finding-${index + 1}`;
  }

  try {
    const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
    return `finding-${hash}`;
  } catch {
    return `finding-${index + 1}`;
  }
}

function extractRawFindings(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  const record = asRecord(input);
  if (!record) {
    throw new ConformanceAdapterError(
      'Unsupported conformance JSON shape. Expected array or object.',
      'unsupported shape'
    );
  }

  if (Array.isArray(record.findings)) {
    return record.findings;
  }

  if (Array.isArray(record.violations)) {
    return record.violations;
  }

  const nestedRuleGroups = [record.results, record.rules]
    .map(asArray)
    .filter((value): value is unknown[] => value !== undefined)
    .flatMap((group) =>
      group.flatMap((entry) => {
        const entryRecord = asRecord(entry);
        return Array.isArray(entryRecord?.violations)
          ? entryRecord.violations
          : [];
      })
    );

  if (nestedRuleGroups.length > 0) {
    return nestedRuleGroups;
  }

  throw new ConformanceAdapterError(
    'Unsupported conformance JSON shape. Could not find findings.',
    'unsupported shape'
  );
}

function extractWorkspaceId(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  return firstDefinedString([
    asString(record.workspaceId),
    asString(record.workspace),
    asString(record.workspaceName),
  ]);
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_METADATA_ARRAY_LENGTH) {
      return undefined;
    }

    const primitiveValues = value.filter(
      (entry): entry is string | number | boolean | null =>
        entry === null ||
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean'
    );

    return primitiveValues.length === value.length
      ? [...primitiveValues]
      : undefined;
  }

  return undefined;
}

function collectProjectIds(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) =>
      typeof entry === 'string' ? entry : readProjectIdentifier(entry)
    )
    .filter((entry): entry is string => !!entry);
}

function readProjectIdentifier(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return firstDefinedString([asString(record.id), asString(record.name)]);
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function firstDefinedString(
  values: Array<string | undefined>
): string | undefined {
  return values.find((value) => !!value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && 'code' in error;
}
