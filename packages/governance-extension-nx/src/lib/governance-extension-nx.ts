import type {
  GovernanceAuthority,
  GovernanceCapability,
  GovernanceCapabilityRequirement,
  GovernanceConfidence,
  GovernanceEvidence,
  GovernanceExtensionDefinition,
  GovernanceExtensionHost,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceRulePackInput,
  GovernanceSignal,
  GovernanceSignalProvider,
  GovernanceSignalProviderInput,
  GovernanceSource,
  GovernanceWorkspace,
  GovernanceWorkspaceEnricher,
  GovernanceWorkspaceEnricherInput,
  Measurement,
  Violation,
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

const NX_CAPABILITY_IDS = [
  'capability:nx',
  ...GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES.map(
    (capability) => capability.id
  ),
] as const;

const EXTENSION_SOURCE: GovernanceSource = {
  id: GOVERNANCE_EXTENSION_NX_ID,
  name: GOVERNANCE_EXTENSION_NX_NAME,
  type: 'governance-extension',
};

const EXTENSION_AUTHORITY: GovernanceAuthority = 'inferred';
const EXTENSION_CONFIDENCE = 0.95 satisfies GovernanceConfidence;
const DETERMINISTIC_SIGNAL_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const RULE_IDS = {
  dependencyTrace: 'nx.relation.source-trace',
} as const;

const METRIC_IDS = {
  dependencyTraceCoverage: 'nx-relation-source-trace-coverage',
} as const;

interface CanonicalWorkspaceNode {
  id: string;
  name?: string;
  kind?: string;
  sourceSystem?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: CanonicalNodeClassification;
  ownership?: CanonicalOwnership;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

interface CanonicalWorkspaceRelation {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: string;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

interface CanonicalWorkspaceShape {
  id: string;
  name: string;
  root: string;
  nodes?: CanonicalWorkspaceNode[];
  relations?: CanonicalWorkspaceRelation[];
  metadata?: Record<string, unknown>;
  capabilities?: GovernanceCapability[];
  diagnostics?: unknown[];
}

interface CanonicalNodeClassification {
  domain?: string;
  layer?: string;
  scope?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface CanonicalOwnership {
  team?: string;
  contacts?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

interface NxNodeMetadata {
  projectType?: string;
  root?: string;
  sourceRoot?: string;
  tags?: string[];
  targets?: string[];
  implicitDependencies?: string[];
  projectMetadata?: Record<string, unknown>;
}

interface NxRelationMetadata {
  dependencyType?: string;
  sourceFile?: string;
  [key: string]: unknown;
}

interface NxCapabilityProject {
  name: string;
  root?: string;
  type?: string;
  tags?: string[];
  targets?: string[];
}

interface NxCapabilityData {
  workspaceRoot?: string;
  projects?: NxCapabilityProject[];
}

interface CanonicalRuntimeReference {
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
}

interface CanonicalViolation {
  id: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  category: 'boundary' | 'ownership' | 'dependency' | 'compliance' | 'unknown';
  message: string;
  recommendation?: string;
  reference?: CanonicalRuntimeReference;
  subjectId?: string;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

interface CanonicalSignal {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  findingIds?: string[];
  metadata?: Record<string, unknown>;
  source: 'extension';
  sourceRef?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  sourcePluginId?: string;
  createdAt: string;
}

export const governanceExtensionNx: GovernanceExtensionDefinition = {
  id: GOVERNANCE_EXTENSION_NX_ID,
  name: GOVERNANCE_EXTENSION_NX_NAME,
  version: GOVERNANCE_EXTENSION_NX_VERSION,
  optionalCapabilities: [...GOVERNANCE_EXTENSION_NX_OPTIONAL_CAPABILITIES],
  register(host): void {
    if (!hasNxContext(host)) {
      return;
    }

    host.registerEnricher(createNxWorkspaceEnricher());
    host.registerRulePack(createNxRulePack());
    host.registerSignalProvider(createNxSignalProvider());
    host.registerMetricProvider(createNxMetricProvider());
  },
};

export function createGovernanceExtensionNx(): GovernanceExtensionDefinition {
  return governanceExtensionNx;
}

function createNxWorkspaceEnricher(): GovernanceWorkspaceEnricher {
  return {
    enrichWorkspace(
      input: GovernanceWorkspaceEnricherInput
    ): GovernanceWorkspace {
      const workspace = asCanonicalWorkspace(input.workspace);
      const capabilityProjects = readNxCapabilityProjects(input.context);
      const nodes = readCanonicalNodes(workspace).map((node) =>
        isNxNode(node)
          ? enrichNxNode(node, capabilityProjects.get(node.id))
          : cloneNode(node)
      );
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const relations = readCanonicalRelations(workspace).map((relation) =>
        isNxRelation(relation, nodeMap)
          ? enrichNxRelation(relation)
          : cloneRelation(relation)
      );

      return replaceCanonicalGraph(input.workspace, nodes, relations);
    },
  };
}

function createNxRulePack() {
  return {
    evaluate(input: GovernanceRulePackInput): Violation[] {
      const workspace = asCanonicalWorkspace(input.workspace);
      const nodes = readCanonicalNodes(workspace).filter(isNxNode);
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const relations = readCanonicalRelations(workspace).filter(
        (relation) =>
          isNxRelation(relation, nodeMap) &&
          findNodeById(workspace, relation.sourceNodeId) !== undefined &&
          findNodeById(workspace, relation.targetNodeId) !== undefined
      );

      const violations: CanonicalViolation[] = relations
        .filter((relation) => shouldReportMissingSourceTrace(relation))
        .map((relation) => ({
          id: `nx:relation:${relation.id}:source-trace`,
          ruleId: RULE_IDS.dependencyTrace,
          severity: 'info' as const,
          category: 'dependency' as const,
          message: `Nx relation "${relation.id}" is missing source-file trace metadata.`,
          recommendation: `Preserve source-file details for relation "${relation.id}" between "${relation.sourceNodeId}" and "${relation.targetNodeId}".`,
          reference: toRelationReference(relation),
          subjectId: relation.id,
          source: EXTENSION_SOURCE,
          evidence: buildRelationEvidence(relation),
          authority: EXTENSION_AUTHORITY,
          confidence: EXTENSION_CONFIDENCE,
          metadata: {
            relationId: relation.id,
            dependencyType:
              getNxRelationMetadata(relation)?.dependencyType ?? 'unknown',
          },
        }));

      return violations as unknown as Violation[];
    },
  };
}

function createNxSignalProvider(): GovernanceSignalProvider {
  return {
    provideSignals(input: GovernanceSignalProviderInput): GovernanceSignal[] {
      const violations = input.violations
        .map(asCanonicalViolation)
        .filter(isNxExtensionViolation)
        .sort((left, right) => left.id.localeCompare(right.id));

      const signals = violations.map((violation) =>
        toCanonicalSignal(violation, input.signals)
      );

      return signals as unknown as GovernanceSignal[];
    },
  };
}

function createNxMetricProvider(): GovernanceMetricProvider {
  return {
    provideMetrics(input: GovernanceMetricProviderInput): Measurement[] {
      const workspace = asCanonicalWorkspace(input.workspace);
      const nodeMap = new Map(
        readCanonicalNodes(workspace)
          .filter(isNxNode)
          .map((node) => [node.id, node])
      );
      const relations = readCanonicalRelations(workspace).filter(
        (relation) =>
          isNxRelation(relation, nodeMap) &&
          findNodeById(workspace, relation.sourceNodeId) !== undefined &&
          findNodeById(workspace, relation.targetNodeId) !== undefined
      );

      if (relations.length === 0) {
        return [];
      }

      const tracedRelationCount = relations.filter(hasSourceTrace).length;

      return [
        buildRatioMeasurement({
          id: METRIC_IDS.dependencyTraceCoverage,
          name: 'Nx Relation Source Trace Coverage',
          family: 'architecture',
          numerator: tracedRelationCount,
          denominator: relations.length,
          signalIds: collectSignalIds(input.signals, RULE_IDS.dependencyTrace),
          metadata: {
            relationCount: relations.length,
            tracedRelationCount,
          },
        }),
      ].sort((left, right) => left.id.localeCompare(right.id));
    },
  };
}

function hasNxContext(host: GovernanceExtensionHost): boolean {
  return NX_CAPABILITY_IDS.some((capabilityId) =>
    host.context.capabilities.has(capabilityId)
  );
}

function asCanonicalWorkspace(
  workspace: GovernanceWorkspace
): CanonicalWorkspaceShape {
  return workspace as unknown as CanonicalWorkspaceShape;
}

function readCanonicalNodes(
  workspace: CanonicalWorkspaceShape
): CanonicalWorkspaceNode[] {
  const nodes = Array.isArray(workspace.nodes) ? workspace.nodes : [];

  return nodes
    .map(cloneNode)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function readCanonicalRelations(
  workspace: CanonicalWorkspaceShape
): CanonicalWorkspaceRelation[] {
  const relations = Array.isArray(workspace.relations)
    ? workspace.relations
    : [];

  return relations
    .map(cloneRelation)
    .sort((left, right) =>
      relationSortKey(left).localeCompare(relationSortKey(right))
    );
}

function cloneNode(node: CanonicalWorkspaceNode): CanonicalWorkspaceNode {
  return {
    ...node,
    ...(node.tags ? { tags: [...node.tags] } : {}),
    ...(node.classification
      ? {
          classification: {
            ...node.classification,
            ...(node.classification.tags
              ? { tags: [...node.classification.tags] }
              : {}),
          },
        }
      : {}),
    ...(node.ownership
      ? {
          ownership: {
            ...node.ownership,
            ...(node.ownership.contacts
              ? { contacts: [...node.ownership.contacts] }
              : {}),
          },
        }
      : {}),
    ...(node.evidence ? { evidence: [...node.evidence] } : {}),
    ...(node.metadata ? { metadata: cloneRecord(node.metadata) } : {}),
  };
}

function cloneRelation(
  relation: CanonicalWorkspaceRelation
): CanonicalWorkspaceRelation {
  return {
    ...relation,
    ...(relation.evidence ? { evidence: [...relation.evidence] } : {}),
    ...(relation.metadata ? { metadata: cloneRecord(relation.metadata) } : {}),
  };
}

function replaceCanonicalGraph(
  workspace: GovernanceWorkspace,
  nodes: CanonicalWorkspaceNode[],
  relations: CanonicalWorkspaceRelation[]
): GovernanceWorkspace {
  return {
    ...(workspace as unknown as Record<string, unknown>),
    nodes,
    relations,
  } as unknown as GovernanceWorkspace;
}

function isNxNode(node: CanonicalWorkspaceNode): boolean {
  return (
    (node.kind === 'project' || node.kind === undefined) &&
    (node.sourceSystem === 'nx' || getNxNodeMetadata(node) !== undefined)
  );
}

function isNxRelation(
  relation: CanonicalWorkspaceRelation,
  nodeMap: ReadonlyMap<string, CanonicalWorkspaceNode>
): boolean {
  if (getNxRelationMetadata(relation)) {
    return true;
  }

  return (
    nodeMap.has(relation.sourceNodeId) &&
    nodeMap.has(relation.targetNodeId) &&
    relation.kind === 'dependency'
  );
}

function getNxNodeMetadata(
  node: CanonicalWorkspaceNode
): NxNodeMetadata | undefined {
  const metadata = asRecord(node.metadata);
  return asRecord(metadata?.nx) as NxNodeMetadata | undefined;
}

function getNxRelationMetadata(
  relation: CanonicalWorkspaceRelation
): NxRelationMetadata | undefined {
  const metadata = asRecord(relation.metadata);
  return asRecord(metadata?.nx) as NxRelationMetadata | undefined;
}

function findNodeById(
  workspace: CanonicalWorkspaceShape,
  nodeId: string
): CanonicalWorkspaceNode | undefined {
  return readCanonicalNodes(workspace).find((node) => node.id === nodeId);
}

function toRelationReference(
  relation: CanonicalWorkspaceRelation
): CanonicalRuntimeReference {
  return {
    relationId: relation.id,
    relatedNodeIds: [relation.sourceNodeId, relation.targetNodeId],
  };
}

function enrichNxNode(
  node: CanonicalWorkspaceNode,
  capabilityProject?: NxCapabilityProject
): CanonicalWorkspaceNode {
  const metadata = getNxNodeMetadata(node) ?? {};
  const tags = uniqueSorted([
    ...(node.tags ?? []),
    ...(metadata.tags ?? []),
    ...(capabilityProject?.tags ?? []),
  ]);
  const targets = uniqueSorted([
    ...(metadata.targets ?? []),
    ...(capabilityProject?.targets ?? []),
  ]);
  const classification = mergeClassification(node.classification, tags);

  return {
    ...node,
    ...(node.kind ? { kind: node.kind } : {}),
    sourceSystem: 'nx',
    ...(tags.length > 0 ? { tags } : {}),
    ...(classification ? { classification } : {}),
    source: node.source ?? EXTENSION_SOURCE,
    evidence: mergeEvidence(node.evidence, buildNodeEvidence(node)),
    authority: node.authority ?? EXTENSION_AUTHORITY,
    confidence: node.confidence ?? EXTENSION_CONFIDENCE,
    metadata: {
      ...(node.metadata ?? {}),
      nx: {
        ...metadata,
        ...(capabilityProject?.type && !metadata.projectType
          ? { projectType: capabilityProject.type }
          : {}),
        ...(capabilityProject?.root && !metadata.root
          ? { root: capabilityProject.root }
          : {}),
        ...(tags.length > 0 ? { tags } : {}),
        ...(targets.length > 0 ? { targets } : {}),
      },
    },
  };
}

function enrichNxRelation(
  relation: CanonicalWorkspaceRelation
): CanonicalWorkspaceRelation {
  const metadata = getNxRelationMetadata(relation) ?? {};

  return {
    ...relation,
    kind: relation.kind ?? 'dependency',
    source: relation.source ?? EXTENSION_SOURCE,
    evidence: mergeEvidence(relation.evidence, buildRelationEvidence(relation)),
    authority: relation.authority ?? EXTENSION_AUTHORITY,
    confidence: relation.confidence ?? EXTENSION_CONFIDENCE,
    metadata: {
      ...(relation.metadata ?? {}),
      nx: {
        ...metadata,
      },
    },
  };
}

function mergeClassification(
  classification: CanonicalNodeClassification | undefined,
  tags: string[]
): CanonicalNodeClassification | undefined {
  const domain =
    classification?.domain ?? readTagValue(tags, 'domain') ?? undefined;
  const layer =
    classification?.layer ?? readTagValue(tags, 'layer') ?? undefined;
  const scope =
    classification?.scope ?? readTagValue(tags, 'scope') ?? undefined;
  const mergedTags = uniqueSorted([...(classification?.tags ?? []), ...tags]);

  if (
    !domain &&
    !layer &&
    !scope &&
    mergedTags.length === 0 &&
    !classification
  ) {
    return undefined;
  }

  return {
    ...(classification ?? {}),
    ...(domain ? { domain } : {}),
    ...(layer ? { layer } : {}),
    ...(scope ? { scope } : {}),
    ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
  };
}

function buildNodeEvidence(node: CanonicalWorkspaceNode): GovernanceEvidence[] {
  const metadata = getNxNodeMetadata(node);

  return [
    {
      id: `nx:node:${node.id}:project`,
      type: 'nx-project',
      source: EXTENSION_SOURCE,
      reference: metadata?.root ?? node.root ?? node.path ?? node.id,
      description: `Nx project node ${node.name ?? node.id}`,
      authority: 'discovered',
      confidence: 1,
    },
  ];
}

function buildRelationEvidence(
  relation: CanonicalWorkspaceRelation
): GovernanceEvidence[] {
  const metadata = getNxRelationMetadata(relation);

  return [
    {
      id: `nx:relation:${relation.id}:dependency`,
      type: 'nx-dependency',
      source: EXTENSION_SOURCE,
      ...(metadata?.sourceFile ? { reference: metadata.sourceFile } : {}),
      description: `Nx dependency relation ${relation.sourceNodeId} -> ${relation.targetNodeId}`,
      authority: 'discovered',
      confidence: 1,
    },
  ];
}

function mergeEvidence(
  current: GovernanceEvidence[] | undefined,
  additions: GovernanceEvidence[]
): GovernanceEvidence[] {
  const merged = new Map<string, GovernanceEvidence>();

  for (const evidence of [...(current ?? []), ...additions]) {
    merged.set(evidence.id, evidence);
  }

  return [...merged.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function shouldReportMissingSourceTrace(
  relation: CanonicalWorkspaceRelation
): boolean {
  const metadata = getNxRelationMetadata(relation);
  const dependencyType = metadata?.dependencyType ?? 'unknown';

  return (
    relation.kind === 'dependency' &&
    (dependencyType === 'static' || dependencyType === 'dynamic') &&
    !metadata?.sourceFile
  );
}

function hasSourceTrace(relation: CanonicalWorkspaceRelation): boolean {
  return Boolean(getNxRelationMetadata(relation)?.sourceFile);
}

function readNxCapabilityProjects(
  input: Pick<GovernanceWorkspaceEnricherInput, 'context'>['context']
): Map<string, NxCapabilityProject> {
  const capability = input.capabilities.get<NxCapabilityData>('capability:nx');
  const projects = Array.isArray(capability?.data?.projects)
    ? capability.data.projects
    : [];

  return new Map(
    projects
      .filter((project): project is NxCapabilityProject =>
        Boolean(project?.name)
      )
      .map((project): [string, NxCapabilityProject] => [
        project.name,
        cloneCapabilityProject(project),
      ])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function cloneCapabilityProject(
  project: NxCapabilityProject
): NxCapabilityProject {
  return {
    ...project,
    ...(project.tags ? { tags: [...project.tags] } : {}),
    ...(project.targets ? { targets: [...project.targets] } : {}),
  };
}

function asCanonicalViolation(violation: Violation): CanonicalViolation {
  return violation as unknown as CanonicalViolation;
}

function isNxExtensionViolation(violation: CanonicalViolation): boolean {
  return Object.values(RULE_IDS).includes(
    violation.ruleId as (typeof RULE_IDS)[keyof typeof RULE_IDS]
  );
}

function toCanonicalSignal(
  violation: CanonicalViolation,
  existingSignals: GovernanceSignal[]
): CanonicalSignal {
  const relationId = violation.reference?.relationId;
  const nodeId = violation.reference?.nodeId;
  const relatedNodeIds = uniqueSorted(
    violation.reference?.relatedNodeIds ?? []
  );
  const relatedRelationIds = uniqueSorted(
    violation.reference?.relatedRelationIds ?? (relationId ? [relationId] : [])
  );

  return {
    id: `nx:signal:${violation.id}`,
    type: relationId ? 'structural-dependency' : 'ownership-gap',
    severity: violation.severity,
    category: violation.category,
    message: violation.message,
    ...(nodeId ? { nodeId } : {}),
    ...(relationId ? { relationId } : {}),
    ...(relatedNodeIds.length > 0 ? { relatedNodeIds } : {}),
    ...(relatedRelationIds.length > 0 ? { relatedRelationIds } : {}),
    findingIds: uniqueSorted([violation.id]),
    metadata: {
      extensionId: GOVERNANCE_EXTENSION_NX_ID,
      ruleId: violation.ruleId,
      priorSignalCount: existingSignals.length,
    },
    source: 'extension',
    sourceRef: EXTENSION_SOURCE,
    evidence: violation.evidence,
    authority: violation.authority ?? EXTENSION_AUTHORITY,
    confidence: violation.confidence ?? EXTENSION_CONFIDENCE,
    createdAt: DETERMINISTIC_SIGNAL_TIMESTAMP,
  };
}

function buildRatioMeasurement(input: {
  id: string;
  name: string;
  family: Measurement['family'];
  numerator: number;
  denominator: number;
  signalIds: string[];
  metadata: Record<string, unknown>;
}): Measurement {
  const denominator = input.denominator;
  const value = denominator === 0 ? 1 : input.numerator / denominator;
  const score = denominator === 0 ? 100 : Math.round(value * 100);

  return {
    id: input.id,
    name: input.name,
    family: input.family,
    value,
    score,
    maxScore: 100,
    unit: 'ratio',
    sourcePluginId: GOVERNANCE_EXTENSION_NX_ID,
    ...(input.signalIds.length > 0 ? { signalIds: input.signalIds } : {}),
    source: EXTENSION_SOURCE,
    authority: EXTENSION_AUTHORITY,
    confidence: EXTENSION_CONFIDENCE,
    metadata: input.metadata,
  };
}

function collectSignalIds(
  signals: GovernanceSignal[],
  ruleId: string
): string[] {
  return signals
    .filter((signal) => asString(asRecord(signal.metadata)?.ruleId) === ruleId)
    .map((signal) => signal.id)
    .sort((left, right) => left.localeCompare(right));
}

function readTagValue(tags: string[], prefix: string): string | undefined {
  const normalizedPrefix = `${prefix}:`;
  const matchingTag = [...tags]
    .sort((left, right) => left.localeCompare(right))
    .find((tag) => tag.startsWith(normalizedPrefix));

  if (!matchingTag) {
    return undefined;
  }

  const value = matchingTag.slice(normalizedPrefix.length).trim();
  return value.length > 0 ? value : undefined;
}

function relationSortKey(relation: CanonicalWorkspaceRelation): string {
  return `${relation.id}|${relation.sourceNodeId}|${relation.targetNodeId}|${
    relation.kind ?? ''
  }`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneUnknown(entry)])
  );
}

function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneUnknown);
  }

  if (value && typeof value === 'object') {
    return cloneRecord(value as Record<string, unknown>);
  }

  return value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default governanceExtensionNx;
