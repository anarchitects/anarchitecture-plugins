import {
  formatFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createHash } from 'node:crypto';
import { basename, posix } from 'node:path';
import {
  ClassDeclaration,
  Decorator,
  Expression,
  Node,
  ObjectLiteralExpression,
  Project,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';
import {
  defaultMigrationsDirectory,
  normalizeName,
} from '../../utils/shared.js';
import type { MigrationApiGeneratorSchema } from './schema.js';

const DEFAULT_ENTITY_GLOB = 'src/infrastructure-persistence/entities/**/*.ts';
const MANIFEST_FILENAME = '.nx-typeorm-migration-manifest.json';
const INIT_MIGRATION_FILENAME = '1700000000000_init_schema.ts';
const UP_START_MARKER = '// nx-typeorm:migration-api:up:start';
const UP_END_MARKER = '// nx-typeorm:migration-api:up:end';
const DOWN_START_MARKER = '// nx-typeorm:migration-api:down:start';
const DOWN_END_MARKER = '// nx-typeorm:migration-api:down:end';

const TYPEORM_CLASS_DECORATORS = new Set([
  'Entity',
  'Index',
  'Unique',
  'Check',
  'Exclusion',
]);

const TYPEORM_PROPERTY_DECORATORS = new Set([
  'PrimaryGeneratedColumn',
  'PrimaryColumn',
  'Column',
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
  'VersionColumn',
  'Generated',
  'Index',
  'Unique',
  'ManyToOne',
  'OneToOne',
  'OneToMany',
  'JoinColumn',
  'RelationId',
  'RelationCount',
]);

const UNSUPPORTED_RELATION_DECORATORS = new Set(['ManyToMany', 'JoinTable']);

interface TypeormMetadata {
  schema?: string;
  migrationsDir?: string;
}

interface ManifestMigrationEntry {
  file: string;
  className: string;
  timestamp: number;
  hash: string;
  mode: 'new' | 'patch-init';
}

interface MigrationManifest {
  schemaVersion: 1;
  generatedBy: '@anarchitects/nx-typeorm:migration-api';
  snapshot: CanonicalSnapshot;
  migrations: ManifestMigrationEntry[];
}

interface CanonicalSnapshot {
  entities: CanonicalEntity[];
  hash: string;
}

interface CanonicalEntity {
  key: string;
  className: string;
  tableName: string;
  schema?: string;
  columns: CanonicalColumn[];
  uniques: CanonicalUnique[];
  indices: CanonicalIndex[];
  checks: CanonicalCheck[];
  exclusions: CanonicalExclusion[];
  foreignKeys: CanonicalForeignKey[];
}

interface CanonicalColumn {
  name: string;
  type: string;
  isPrimary: boolean;
  isGenerated: boolean;
  generationStrategy?: string;
  isNullable: boolean;
  isUnique: boolean;
  isArray: boolean;
  length?: string;
  width?: number;
  precision?: number;
  scale?: number;
  default?: string;
  onUpdate?: string;
  charset?: string;
  collation?: string;
  enum?: string[];
  enumName?: string;
  primaryKeyConstraintName?: string;
  comment?: string;
  unsigned?: boolean;
  zerofill?: boolean;
  generatedType?: string;
  asExpression?: string;
  generatedIdentity?: string;
  spatialFeatureType?: string;
  srid?: number;
}

interface CanonicalUnique {
  name: string;
  columnNames: string[];
  deferrable?: string;
}

interface CanonicalIndex {
  name: string;
  columnNames: string[];
  isUnique: boolean;
  where?: string;
  isSpatial?: boolean;
  isConcurrent?: boolean;
  isFulltext?: boolean;
  parser?: string;
  synchronize?: boolean;
}

interface CanonicalCheck {
  name: string;
  expression: string;
}

interface CanonicalExclusion {
  name: string;
  expression: string;
}

interface CanonicalForeignKey {
  name?: string;
  columnNames: string[];
  referencedTableKey: string;
  referencedColumnNames: string[];
  onDelete?: string;
  onUpdate?: string;
  deferrable?: string;
}

interface ParsedEntity extends CanonicalEntity {
  pendingRelations: PendingRelation[];
}

interface PendingRelation {
  sourceEntityKey: string;
  sourcePropertyName: string;
  targetClassName: string;
  joinColumnName: string;
  referencedColumnName?: string;
  foreignKeyConstraintName?: string;
  onDelete?: string;
  onUpdate?: string;
  deferrable?: string;
  nullable?: boolean;
}

interface TableDelta {
  before: CanonicalEntity;
  after: CanonicalEntity;
  dropColumns: CanonicalColumn[];
  addColumns: CanonicalColumn[];
  changeColumns: Array<{
    before: CanonicalColumn;
    after: CanonicalColumn;
  }>;
  dropUniques: CanonicalUnique[];
  addUniques: CanonicalUnique[];
  dropIndices: CanonicalIndex[];
  addIndices: CanonicalIndex[];
  dropChecks: CanonicalCheck[];
  addChecks: CanonicalCheck[];
  dropExclusions: CanonicalExclusion[];
  addExclusions: CanonicalExclusion[];
  dropForeignKeys: CanonicalForeignKey[];
  addForeignKeys: CanonicalForeignKey[];
}

interface DiffPlan {
  createTables: CanonicalEntity[];
  dropTables: CanonicalEntity[];
  alterTables: TableDelta[];
  hasChanges: boolean;
}

interface RenderedMigration {
  upStatements: string[];
  downStatements: string[];
}

interface TypeormDecoratorInstance {
  canonicalName: string;
  decorator: Decorator;
}

export default async function migrationApiGenerator(
  tree: Tree,
  options: MigrationApiGeneratorSchema
) {
  const projectName = requireOption(options.project, 'project');
  const project = readProjectConfiguration(tree, projectName);

  if (project.projectType !== 'library') {
    throw new Error(
      'The migration-api generator only supports library projects.'
    );
  }

  const fileMode = normalizeFileMode(options.fileMode);
  const entityGlob = normalizeProjectRelative(
    options.entityGlob ?? DEFAULT_ENTITY_GLOB
  );
  const metadata = readTypeormMetadata(project.metadata);
  const migrationsDirectory = resolveMigrationsDirectory(
    project.root,
    project.projectType,
    metadata
  );
  const manifestPath = joinPathFragments(
    migrationsDirectory,
    MANIFEST_FILENAME
  );
  const initMigrationPath = joinPathFragments(
    migrationsDirectory,
    INIT_MIGRATION_FILENAME
  );

  if (!tree.exists(migrationsDirectory)) {
    throw new Error(
      `Migrations directory "${migrationsDirectory}" does not exist. Run bootstrap first.`
    );
  }

  const manifest = readManifest(tree, manifestPath);
  const migrationFiles = listTypeScriptMigrationFiles(
    tree,
    migrationsDirectory
  );
  validateMixedMigrations(
    migrationFiles,
    manifest,
    options.allowMixedMigrations ?? false
  );

  if (fileMode === 'patch-init') {
    if (!tree.exists(initMigrationPath)) {
      throw new Error(
        `Patch mode requires the bootstrap init migration at "${initMigrationPath}".`
      );
    }

    const hasGeneratedDelta = (manifest?.migrations ?? []).some(
      (entry) => entry.mode === 'new'
    );
    if (hasGeneratedDelta) {
      throw new Error(
        'Patch mode is allowed only before generating any delta migration files.'
      );
    }
  }

  const entityFiles = discoverEntityFiles(tree, project.root, entityGlob);
  if (entityFiles.length === 0) {
    throw new Error(
      `No entity files matched "${entityGlob}" under "${project.root}".`
    );
  }

  const snapshot = buildCanonicalSnapshot(tree, entityFiles, metadata.schema);
  const previousSnapshot = manifest?.snapshot ?? emptySnapshot();
  const diff = diffSnapshots(previousSnapshot, snapshot);

  const nextManifest: MigrationManifest = {
    schemaVersion: 1,
    generatedBy: '@anarchitects/nx-typeorm:migration-api',
    snapshot,
    migrations: [...(manifest?.migrations ?? [])],
  };

  if (!diff.hasChanges) {
    tree.write(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
    await formatFiles(tree);
    return;
  }

  const rendered = renderMigration(diff);
  const migrationHash = sha256(
    JSON.stringify({
      up: rendered.upStatements,
      down: rendered.downStatements,
      snapshotHash: snapshot.hash,
    })
  );

  if (fileMode === 'patch-init') {
    patchInitMigration(tree, initMigrationPath, rendered);
    nextManifest.migrations.push({
      file: INIT_MIGRATION_FILENAME,
      className: 'InitPatch',
      timestamp: options.timestamp ?? Date.now(),
      hash: migrationHash,
      mode: 'patch-init',
    });
  } else {
    const migrationName = normalizeName(requireOption(options.name, 'name'));
    const timestamp = normalizeTimestamp(options.timestamp);
    const migrationFile = `${timestamp}_${migrationName}.ts`;
    const migrationPath = joinPathFragments(migrationsDirectory, migrationFile);

    if (tree.exists(migrationPath)) {
      throw new Error(
        `Migration file "${migrationPath}" already exists. Use a different timestamp or name.`
      );
    }

    const className = `${names(migrationName).className}${timestamp}`;
    tree.write(
      migrationPath,
      renderMigrationFile({
        className,
        upStatements: rendered.upStatements,
        downStatements: rendered.downStatements,
      })
    );

    nextManifest.migrations.push({
      file: migrationFile,
      className,
      timestamp,
      hash: migrationHash,
      mode: 'new',
    });
  }

  tree.write(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  await formatFiles(tree);
}

function readTypeormMetadata(metadata: unknown): TypeormMetadata {
  const root = metadata as {
    typeorm?: { schema?: string; migrationsDir?: string };
  };
  return {
    schema: root?.typeorm?.schema,
    migrationsDir: root?.typeorm?.migrationsDir,
  };
}

function resolveMigrationsDirectory(
  projectRoot: string,
  projectType: 'application' | 'library' | undefined,
  metadata: TypeormMetadata
): string {
  const fallback = defaultMigrationsDirectory(projectRoot, projectType);
  const configured = metadata.migrationsDir
    ? joinPathFragments(
        projectRoot,
        normalizeProjectRelative(metadata.migrationsDir)
      )
    : fallback;

  return configured;
}

function normalizeFileMode(fileMode: string | undefined): 'new' | 'patch-init' {
  const normalized = (fileMode ?? 'new').trim();
  if (normalized === 'new' || normalized === 'patch-init') {
    return normalized;
  }

  throw new Error('fileMode must be either "new" or "patch-init".');
}

function normalizeTimestamp(timestamp: number | undefined): number {
  if (typeof timestamp !== 'number') {
    return Date.now();
  }

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error(
      'timestamp must be a positive finite number when provided.'
    );
  }

  return Math.floor(timestamp);
}

function requireOption(value: string | undefined, optionName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Provide a value for the ${optionName} option.`);
  }

  return trimmed;
}

function normalizeProjectRelative(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, '/').replace(/^\.\//, '').trim();

  if (!normalized) {
    throw new Error('Path options must not be empty.');
  }

  if (normalized.startsWith('/')) {
    throw new Error(
      `Path "${pathValue}" must be relative to the project root.`
    );
  }

  const collapsed = posix.normalize(normalized);
  if (collapsed === '.' || collapsed === '..' || collapsed.startsWith('../')) {
    throw new Error(`Path "${pathValue}" must stay within the project root.`);
  }

  return collapsed;
}

function readManifest(
  tree: Tree,
  manifestPath: string
): MigrationManifest | undefined {
  if (!tree.exists(manifestPath)) {
    return undefined;
  }

  const contents = tree.read(manifestPath, 'utf-8');
  if (!contents) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(contents) as MigrationManifest;
    if (
      parsed.schemaVersion !== 1 ||
      parsed.generatedBy !== '@anarchitects/nx-typeorm:migration-api' ||
      !Array.isArray(parsed.migrations)
    ) {
      throw new Error('Invalid manifest structure.');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse migration manifest "${manifestPath}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function validateMixedMigrations(
  migrationFiles: string[],
  manifest: MigrationManifest | undefined,
  allowMixedMigrations: boolean
) {
  const generatedFiles = new Set<string>([
    INIT_MIGRATION_FILENAME,
    ...(manifest?.migrations.map((entry) => entry.file) ?? []),
  ]);

  const manualFiles = migrationFiles.filter(
    (file) => !generatedFiles.has(file)
  );

  if (manualFiles.length > 0 && !allowMixedMigrations) {
    throw new Error(
      `Detected non-tool migration files (${manualFiles.join(
        ', '
      )}). Re-run with --allowMixedMigrations to opt in.`
    );
  }
}

function listTypeScriptMigrationFiles(
  tree: Tree,
  migrationsDirectory: string
): string[] {
  return walkTreeFiles(tree, migrationsDirectory)
    .map((filePath) => posix.relative(migrationsDirectory, filePath))
    .filter(
      (relativePath) =>
        relativePath.endsWith('.ts') &&
        !relativePath.endsWith('.d.ts') &&
        basename(relativePath) !== MANIFEST_FILENAME
    )
    .sort();
}

function discoverEntityFiles(
  tree: Tree,
  projectRoot: string,
  entityGlob: string
): string[] {
  return walkTreeFiles(tree, projectRoot)
    .filter(
      (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')
    )
    .filter((filePath) => {
      const relativePath = posix.relative(projectRoot, filePath);
      return matchGlobPattern(relativePath, entityGlob);
    })
    .sort();
}

function walkTreeFiles(tree: Tree, rootPath: string): string[] {
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  if (!tree.exists(normalizedRoot)) {
    return [];
  }

  if (tree.isFile(normalizedRoot)) {
    return [normalizedRoot];
  }

  const files: string[] = [];
  const stack: string[] = [normalizedRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const child of tree.children(current)) {
      const childPath = joinPathFragments(current, child);
      if (tree.isFile(childPath)) {
        files.push(childPath);
      } else {
        stack.push(childPath);
      }
    }
  }

  return files;
}

function matchGlobPattern(pathValue: string, pattern: string): boolean {
  const pathSegments = pathValue
    .split('/')
    .filter((segment) => segment.length > 0);
  const patternSegments = pattern
    .split('/')
    .filter((segment) => segment.length > 0);

  return matchGlobSegments(pathSegments, patternSegments);
}

function matchGlobSegments(
  pathSegments: string[],
  patternSegments: string[]
): boolean {
  if (patternSegments.length === 0) {
    return pathSegments.length === 0;
  }

  const [currentPattern, ...restPattern] = patternSegments;

  if (currentPattern === '**') {
    if (matchGlobSegments(pathSegments, restPattern)) {
      return true;
    }

    if (pathSegments.length === 0) {
      return false;
    }

    return matchGlobSegments(pathSegments.slice(1), patternSegments);
  }

  if (pathSegments.length === 0) {
    return false;
  }

  if (!matchGlobSegment(pathSegments[0], currentPattern)) {
    return false;
  }

  return matchGlobSegments(pathSegments.slice(1), restPattern);
}

function matchGlobSegment(
  pathSegment: string,
  patternSegment: string
): boolean {
  const regexBody = patternSegment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexBody}$`).test(pathSegment);
}

function buildCanonicalSnapshot(
  tree: Tree,
  entityFiles: string[],
  defaultSchema: string | undefined
): CanonicalSnapshot {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
  });

  for (const entityFile of entityFiles) {
    const contents = tree.read(entityFile, 'utf-8');
    if (!contents) {
      throw new Error(`Unable to read entity file "${entityFile}".`);
    }

    project.createSourceFile(entityFile, contents, { overwrite: true });
  }

  const parsedEntities: ParsedEntity[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const aliases = readTypeormAliases(sourceFile);
    for (const classDeclaration of sourceFile.getClasses()) {
      const parsed = parseEntityClass(classDeclaration, aliases, defaultSchema);
      if (parsed) {
        parsedEntities.push(parsed);
      }
    }
  }

  if (parsedEntities.length === 0) {
    throw new Error(
      'No @Entity classes were found in discovered entity files.'
    );
  }

  resolvePendingRelations(parsedEntities);

  const entities = parsedEntities
    .map((entity) => {
      return sortEntity({
        key: entity.key,
        className: entity.className,
        tableName: entity.tableName,
        schema: entity.schema,
        columns: entity.columns,
        uniques: entity.uniques,
        indices: entity.indices,
        checks: entity.checks,
        exclusions: entity.exclusions,
        foreignKeys: entity.foreignKeys,
      });
    })
    .sort((left, right) => left.key.localeCompare(right.key));

  const hash = sha256(JSON.stringify(entities));
  return { entities, hash };
}

function parseEntityClass(
  classDeclaration: ClassDeclaration,
  aliases: Map<string, string>,
  defaultSchema: string | undefined
): ParsedEntity | undefined {
  const classDecorators = getTypeormDecorators(classDeclaration, aliases);
  const entityDecorator = classDecorators.find(
    (entry) => entry.canonicalName === 'Entity'
  );

  if (!entityDecorator) {
    return undefined;
  }

  assertSupportedDecorators(
    classDecorators,
    TYPEORM_CLASS_DECORATORS,
    classDeclaration,
    'class'
  );

  const className = classDeclaration.getName();
  if (!className) {
    throw new Error('Entity classes must be named exports.');
  }

  const tableInfo = parseEntityDecorator(entityDecorator.decorator, className);
  const tableName = tableInfo.tableName;
  const schema = tableInfo.schema ?? defaultSchema;

  const entity: ParsedEntity = {
    key: tableKey(schema, tableName),
    className,
    tableName,
    schema,
    columns: [],
    uniques: [],
    indices: [],
    checks: [],
    exclusions: [],
    foreignKeys: [],
    pendingRelations: [],
  };

  parseEntityLevelConstraints(entity, classDecorators, classDeclaration);

  for (const property of classDeclaration.getProperties()) {
    parseProperty(entity, property, aliases);
  }

  return sortParsedEntity(entity);
}

function readTypeormAliases(sourceFile: SourceFile): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== 'typeorm') {
      continue;
    }

    for (const namedImport of declaration.getNamedImports()) {
      const canonicalName = namedImport.getName();
      const localName = namedImport.getAliasNode()?.getText() ?? canonicalName;
      aliases.set(localName, canonicalName);
    }
  }

  return aliases;
}

function getTypeormDecorators(
  node: ClassDeclaration | PropertyDeclaration,
  aliases: Map<string, string>
): TypeormDecoratorInstance[] {
  const result: TypeormDecoratorInstance[] = [];

  for (const decorator of node.getDecorators()) {
    const localName = decorator.getName();
    const canonicalName = aliases.get(localName);
    if (!canonicalName) {
      continue;
    }

    result.push({ canonicalName, decorator });
  }

  return result;
}

function assertSupportedDecorators(
  decorators: TypeormDecoratorInstance[],
  supported: Set<string>,
  node: ClassDeclaration | PropertyDeclaration,
  nodeKind: 'class' | 'property'
) {
  for (const { canonicalName } of decorators) {
    if (UNSUPPORTED_RELATION_DECORATORS.has(canonicalName)) {
      throw new Error(
        `Unsupported TypeORM decorator @${canonicalName} on ${nodeKind} "${
          nodeKind === 'class'
            ? node.getName() ?? '<anonymous>'
            : node.getName()
        }". Generate this migration manually.`
      );
    }

    if (!supported.has(canonicalName)) {
      throw new Error(
        `Unsupported TypeORM decorator @${canonicalName} on ${nodeKind} "${
          nodeKind === 'class'
            ? node.getName() ?? '<anonymous>'
            : node.getName()
        }".`
      );
    }
  }
}

function parseEntityDecorator(
  decorator: Decorator,
  className: string
): { tableName: string; schema?: string } {
  const args = decorator.getArguments();

  let tableName: string | undefined;
  let schema: string | undefined;

  for (const arg of args) {
    if (
      Node.isStringLiteral(arg) ||
      Node.isNoSubstitutionTemplateLiteral(arg)
    ) {
      tableName = arg.getLiteralText().trim();
      continue;
    }

    if (Node.isObjectLiteralExpression(arg)) {
      const nameValue = readStringProperty(arg, 'name');
      if (nameValue) {
        tableName = nameValue;
      }

      const schemaValue = readStringProperty(arg, 'schema');
      if (schemaValue) {
        schema = schemaValue;
      }
    }
  }

  if (!tableName) {
    throw new Error(
      `Entity "${className}" must declare an explicit table name in @Entity(...).`
    );
  }

  return { tableName, schema };
}

function parseEntityLevelConstraints(
  entity: ParsedEntity,
  decorators: TypeormDecoratorInstance[],
  classDeclaration: ClassDeclaration
) {
  for (const { canonicalName, decorator } of decorators) {
    if (canonicalName === 'Unique') {
      const parsed = parseUniqueDecorator(
        decorator,
        classDeclaration.getName() ?? 'Entity'
      );
      entity.uniques.push(parsed);
    }

    if (canonicalName === 'Index') {
      const parsed = parseIndexDecorator(
        decorator,
        classDeclaration.getName() ?? 'Entity'
      );
      entity.indices.push(parsed);
    }

    if (canonicalName === 'Check') {
      entity.checks.push(
        parseNamedExpressionDecorator(
          decorator,
          'Check',
          classDeclaration.getName() ?? 'Entity'
        )
      );
    }

    if (canonicalName === 'Exclusion') {
      entity.exclusions.push(
        parseNamedExpressionDecorator(
          decorator,
          'Exclusion',
          classDeclaration.getName() ?? 'Entity'
        )
      );
    }
  }
}

function parseProperty(
  entity: ParsedEntity,
  property: PropertyDeclaration,
  aliases: Map<string, string>
) {
  const decorators = getTypeormDecorators(property, aliases);
  if (decorators.length === 0) {
    return;
  }

  assertSupportedDecorators(
    decorators,
    TYPEORM_PROPERTY_DECORATORS,
    property,
    'property'
  );

  const propertyName = property.getName();
  const decoratorMap = new Map<string, Decorator>();
  for (const { canonicalName, decorator } of decorators) {
    decoratorMap.set(canonicalName, decorator);
  }

  const columnDecorator =
    decoratorMap.get('PrimaryGeneratedColumn') ??
    decoratorMap.get('PrimaryColumn') ??
    decoratorMap.get('Column') ??
    decoratorMap.get('CreateDateColumn') ??
    decoratorMap.get('UpdateDateColumn') ??
    decoratorMap.get('DeleteDateColumn') ??
    decoratorMap.get('VersionColumn');

  if (columnDecorator) {
    const generatedDecorator = decoratorMap.get('Generated');
    const column = parseColumn(property, columnDecorator, generatedDecorator);
    upsertColumn(entity.columns, column);
  }

  const propertyUniqueDecorator = decoratorMap.get('Unique');
  if (propertyUniqueDecorator) {
    const unique = parseUniqueDecorator(propertyUniqueDecorator, propertyName, [
      propertyName,
    ]);
    entity.uniques.push(unique);
  }

  const propertyIndexDecorator = decoratorMap.get('Index');
  if (propertyIndexDecorator) {
    const index = parseIndexDecorator(propertyIndexDecorator, propertyName, [
      propertyName,
    ]);
    entity.indices.push(index);
  }

  const relationDecorator =
    decoratorMap.get('ManyToOne') ?? decoratorMap.get('OneToOne');
  const joinColumnDecorator = decoratorMap.get('JoinColumn');

  if (!relationDecorator) {
    return;
  }

  const relationName = relationDecorator.getName();
  if (relationName === 'ManyToOne' && !joinColumnDecorator) {
    throw new Error(
      `Relation "${propertyName}" uses implicit join-column naming. Add @JoinColumn({ name: ..., referencedColumnName: ... }).`
    );
  }

  if (relationName === 'OneToOne' && !joinColumnDecorator) {
    return;
  }

  if (!joinColumnDecorator) {
    return;
  }

  const targetClassName = parseRelationTargetClassName(relationDecorator);
  const relationOptions = parseRelationOptions(relationDecorator);
  const joinColumn = parseJoinColumnDecorator(
    joinColumnDecorator,
    propertyName
  );

  entity.pendingRelations.push({
    sourceEntityKey: entity.key,
    sourcePropertyName: propertyName,
    targetClassName,
    joinColumnName: joinColumn.name,
    referencedColumnName: joinColumn.referencedColumnName,
    foreignKeyConstraintName: joinColumn.foreignKeyConstraintName,
    onDelete: relationOptions.onDelete,
    onUpdate: relationOptions.onUpdate,
    deferrable: relationOptions.deferrable,
    nullable: relationOptions.nullable,
  });
}

function parseColumn(
  property: PropertyDeclaration,
  decorator: Decorator,
  generatedDecorator: Decorator | undefined
): CanonicalColumn {
  const propertyName = property.getName();
  const decoratorName = decorator.getName();

  const args = decorator.getArguments();
  let strategy: string | undefined;
  let typeHint: string | undefined;
  let optionsLiteral: ObjectLiteralExpression | undefined;

  if (decoratorName === 'PrimaryGeneratedColumn') {
    if (args.length > 0 && isStringArgument(args[0])) {
      strategy = getStringArgument(args[0]);
    }

    for (const arg of args) {
      if (Node.isObjectLiteralExpression(arg)) {
        optionsLiteral = arg;
      }
    }
  } else {
    if (args.length > 0 && !Node.isObjectLiteralExpression(args[0])) {
      typeHint = parseColumnTypeExpression(args[0], propertyName);
    }

    for (const arg of args) {
      if (Node.isObjectLiteralExpression(arg)) {
        optionsLiteral = arg;
      }
    }
  }

  const options = readLiteralObjectOptions(optionsLiteral, propertyName);

  if (decoratorName === 'PrimaryGeneratedColumn' && !strategy) {
    strategy = optionString(options, 'strategy') ?? 'increment';
  }

  const generated = generatedDecorator
    ? parseGeneratedDecorator(generatedDecorator, propertyName)
    : undefined;

  const columnName = optionString(options, 'name') ?? propertyName;
  const inferredType =
    optionString(options, 'type') ??
    typeHint ??
    typeFromSpecialDecorator(decoratorName) ??
    inferTypeFromProperty(property);
  const resolvedType =
    inferredType ?? typeFromGenerationStrategy(strategy ?? generated?.strategy);

  if (!resolvedType) {
    throw new Error(
      `Unable to resolve database type for column "${propertyName}". Provide an explicit type in the decorator options.`
    );
  }

  const isPrimary =
    decoratorName === 'PrimaryColumn' ||
    decoratorName === 'PrimaryGeneratedColumn';

  const isGenerated =
    decoratorName === 'PrimaryGeneratedColumn' || generated !== undefined;

  return {
    name: columnName,
    type: resolvedType,
    isPrimary,
    isGenerated,
    generationStrategy: strategy ?? generated?.strategy,
    isNullable: optionBoolean(options, 'nullable') ?? false,
    isUnique: optionBoolean(options, 'unique') ?? false,
    isArray: optionBoolean(options, 'array') ?? false,
    length: optionString(options, 'length'),
    width: optionNumber(options, 'width'),
    precision: optionNumber(options, 'precision'),
    scale: optionNumber(options, 'scale'),
    default: optionCode(options, 'default'),
    onUpdate: optionString(options, 'onUpdate'),
    charset: optionString(options, 'charset'),
    collation: optionString(options, 'collation'),
    enum: optionStringArray(options, 'enum'),
    enumName: optionString(options, 'enumName'),
    primaryKeyConstraintName: optionString(options, 'primaryKeyConstraintName'),
    comment: optionString(options, 'comment'),
    unsigned: optionBoolean(options, 'unsigned') ?? undefined,
    zerofill: optionBoolean(options, 'zerofill') ?? undefined,
    generatedType: optionString(options, 'generatedType'),
    asExpression: optionCode(options, 'asExpression'),
    generatedIdentity: optionString(options, 'generatedIdentity'),
    spatialFeatureType: optionString(options, 'spatialFeatureType'),
    srid: optionNumber(options, 'srid'),
  };
}

function parseGeneratedDecorator(
  decorator: Decorator,
  propertyName: string
): { strategy?: string } {
  const args = decorator.getArguments();
  if (args.length === 0) {
    return {};
  }

  if (!isStringArgument(args[0])) {
    throw new Error(
      `Unsupported @Generated strategy for property "${propertyName}". Use a string literal strategy.`
    );
  }

  return { strategy: getStringArgument(args[0]) };
}

function parseRelationTargetClassName(decorator: Decorator): string {
  const args = decorator.getArguments();
  if (args.length === 0) {
    throw new Error(
      `Decorator @${decorator.getName()} requires a target entity callback.`
    );
  }

  const first = args[0];

  if (Node.isIdentifier(first)) {
    return first.getText();
  }

  if (!Node.isArrowFunction(first) && !Node.isFunctionExpression(first)) {
    throw new Error(
      `Unable to resolve relation target in @${decorator.getName()}. Use () => TargetEntity.`
    );
  }

  const body = first.getBody();

  if (Node.isIdentifier(body)) {
    return body.getText();
  }

  if (
    Node.isParenthesizedExpression(body) &&
    Node.isIdentifier(body.getExpression())
  ) {
    return body.getExpression().getText();
  }

  if (Node.isBlock(body)) {
    const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    if (returns.length === 1) {
      const expression = returns[0].getExpression();
      if (expression && Node.isIdentifier(expression)) {
        return expression.getText();
      }
    }
  }

  throw new Error(
    `Unable to resolve relation target in @${decorator.getName()}. Use () => TargetEntity.`
  );
}

function parseRelationOptions(decorator: Decorator): {
  onDelete?: string;
  onUpdate?: string;
  deferrable?: string;
  nullable?: boolean;
} {
  const args = decorator.getArguments();
  const optionsLiteral = args.find((arg) =>
    Node.isObjectLiteralExpression(arg)
  );

  if (!optionsLiteral || !Node.isObjectLiteralExpression(optionsLiteral)) {
    return {};
  }

  const options = readLiteralObjectOptions(optionsLiteral);
  return {
    onDelete: optionString(options, 'onDelete'),
    onUpdate: optionString(options, 'onUpdate'),
    deferrable: optionString(options, 'deferrable'),
    nullable: optionBoolean(options, 'nullable'),
  };
}

function parseJoinColumnDecorator(
  decorator: Decorator,
  propertyName: string
): {
  name: string;
  referencedColumnName?: string;
  foreignKeyConstraintName?: string;
} {
  const args = decorator.getArguments();
  const first = args[0];

  if (!first) {
    throw new Error(
      `Relation "${propertyName}" uses implicit join-column naming. Add @JoinColumn({ name: ..., referencedColumnName: ... }).`
    );
  }

  if (Node.isArrayLiteralExpression(first)) {
    throw new Error(
      `Composite @JoinColumn arrays are not supported for relation "${propertyName}".`
    );
  }

  if (!Node.isObjectLiteralExpression(first)) {
    throw new Error(
      `@JoinColumn for relation "${propertyName}" must use an object literal.`
    );
  }

  const name = readStringProperty(first, 'name');
  if (!name) {
    throw new Error(
      `Relation "${propertyName}" uses implicit join-column naming. Provide JoinColumn.name explicitly.`
    );
  }

  return {
    name,
    referencedColumnName: readStringProperty(first, 'referencedColumnName'),
    foreignKeyConstraintName: readStringProperty(
      first,
      'foreignKeyConstraintName'
    ),
  };
}

function parseNamedExpressionDecorator(
  decorator: Decorator,
  decoratorName: string,
  subjectName: string
): CanonicalCheck | CanonicalExclusion {
  const args = decorator.getArguments();
  const name = args.find((arg) => isStringArgument(arg));
  const expression = [...args].reverse().find((arg) => isStringArgument(arg));

  if (!name || !expression) {
    throw new Error(
      `@${decoratorName} on "${subjectName}" must declare explicit name and expression string literals.`
    );
  }

  return {
    name: getStringArgument(name),
    expression: getStringArgument(expression),
  };
}

function parseUniqueDecorator(
  decorator: Decorator,
  subjectName: string,
  fallbackColumnNames?: string[]
): CanonicalUnique {
  const args = decorator.getArguments();
  const nameArg = args.find((arg) => isStringArgument(arg));
  const columnsArg = args.find((arg) => Node.isArrayLiteralExpression(arg));

  if (!nameArg) {
    throw new Error(
      `@Unique on "${subjectName}" must declare an explicit name to avoid implicit naming drift.`
    );
  }

  const columnNames = columnsArg
    ? parseStringArrayLiteral(columnsArg)
    : fallbackColumnNames ?? [];

  if (columnNames.length === 0) {
    throw new Error(
      `@Unique "${getStringArgument(
        nameArg
      )}" on "${subjectName}" must declare columns explicitly.`
    );
  }

  const optionsArg = [...args]
    .reverse()
    .find((arg) => Node.isObjectLiteralExpression(arg));
  const options =
    optionsArg && Node.isObjectLiteralExpression(optionsArg)
      ? readLiteralObjectOptions(optionsArg, subjectName)
      : undefined;

  return {
    name: getStringArgument(nameArg),
    columnNames: [...columnNames].sort(),
    deferrable: optionString(options, 'deferrable'),
  };
}

function parseIndexDecorator(
  decorator: Decorator,
  subjectName: string,
  fallbackColumnNames?: string[]
): CanonicalIndex {
  const args = decorator.getArguments();
  const nameArg = args.find((arg) => isStringArgument(arg));
  const columnsArg = args.find((arg) => Node.isArrayLiteralExpression(arg));

  if (!nameArg) {
    throw new Error(
      `@Index on "${subjectName}" must declare an explicit index name to avoid implicit naming drift.`
    );
  }

  const columnNames = columnsArg
    ? parseStringArrayLiteral(columnsArg)
    : fallbackColumnNames ?? [];

  if (columnNames.length === 0) {
    throw new Error(
      `@Index "${getStringArgument(
        nameArg
      )}" on "${subjectName}" must declare columns explicitly.`
    );
  }

  const optionsArg = [...args]
    .reverse()
    .find((arg) => Node.isObjectLiteralExpression(arg));
  const options =
    optionsArg && Node.isObjectLiteralExpression(optionsArg)
      ? readLiteralObjectOptions(optionsArg, subjectName)
      : undefined;

  return {
    name: getStringArgument(nameArg),
    columnNames: [...columnNames].sort(),
    isUnique: optionBoolean(options, 'unique') ?? false,
    where: optionString(options, 'where'),
    isSpatial: optionBoolean(options, 'spatial') ?? undefined,
    isConcurrent: optionBoolean(options, 'concurrent') ?? undefined,
    isFulltext: optionBoolean(options, 'fulltext') ?? undefined,
    parser: optionString(options, 'parser'),
    synchronize: optionBoolean(options, 'synchronize'),
  };
}

function parseStringArrayLiteral(expression: Node): string[] {
  if (!Node.isArrayLiteralExpression(expression)) {
    throw new Error('Expected an array literal with string entries.');
  }

  const values: string[] = [];
  for (const element of expression.getElements()) {
    if (!isStringArgument(element)) {
      throw new Error('Array literals must only contain string literals.');
    }

    values.push(getStringArgument(element));
  }

  return values;
}

function readLiteralObjectOptions(
  literal: ObjectLiteralExpression | undefined,
  subjectName?: string
): Map<string, string> | undefined {
  if (!literal) {
    return undefined;
  }

  const options = new Map<string, string>();

  for (const property of literal.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      throw new Error(
        `Spread options are not supported${
          subjectName ? ` for "${subjectName}"` : ''
        }. Use explicit literal values.`
      );
    }

    if (Node.isShorthandPropertyAssignment(property)) {
      throw new Error(
        `Shorthand options are not supported${
          subjectName ? ` for "${subjectName}"` : ''
        }. Use explicit literal values.`
      );
    }

    if (!Node.isPropertyAssignment(property)) {
      continue;
    }

    const key = property
      .getNameNode()
      .getText()
      .replace(/^['"]|['"]$/g, '');
    const initializer = property.getInitializer();
    if (!initializer) {
      continue;
    }

    assertSerializableExpression(initializer, subjectName ?? key);
    options.set(key, initializer.getText().trim());
  }

  return options;
}

function assertSerializableExpression(
  expression: Expression,
  subjectName: string
): void {
  if (
    Node.isStringLiteral(expression) ||
    Node.isNoSubstitutionTemplateLiteral(expression) ||
    Node.isNumericLiteral(expression) ||
    expression.getKind() === SyntaxKind.TrueKeyword ||
    expression.getKind() === SyntaxKind.FalseKeyword ||
    expression.getKind() === SyntaxKind.NullKeyword
  ) {
    return;
  }

  if (Node.isPrefixUnaryExpression(expression)) {
    assertSerializableExpression(expression.getOperand(), subjectName);
    return;
  }

  if (Node.isArrayLiteralExpression(expression)) {
    for (const element of expression.getElements()) {
      if (!Node.isExpression(element)) {
        throw new Error(
          `Unsupported non-expression value in array literal for "${subjectName}".`
        );
      }
      assertSerializableExpression(element, subjectName);
    }
    return;
  }

  if (Node.isObjectLiteralExpression(expression)) {
    for (const property of expression.getProperties()) {
      if (!Node.isPropertyAssignment(property)) {
        throw new Error(
          `Unsupported object literal option in "${subjectName}". Use plain property assignments.`
        );
      }

      const initializer = property.getInitializer();
      if (!initializer) {
        throw new Error(
          `Unsupported object literal option in "${subjectName}".`
        );
      }

      assertSerializableExpression(initializer, subjectName);
    }
    return;
  }

  if (
    Node.isArrowFunction(expression) ||
    Node.isFunctionExpression(expression)
  ) {
    return;
  }

  throw new Error(
    `Unsupported expression "${expression.getText()}" in "${subjectName}". Use literal values or arrow functions only.`
  );
}

function parseColumnTypeExpression(
  expression: Node,
  propertyName: string
): string | undefined {
  if (isStringArgument(expression)) {
    return getStringArgument(expression);
  }

  if (Node.isIdentifier(expression)) {
    const text = expression.getText();
    if (text === 'String') {
      return 'varchar';
    }
    if (text === 'Number') {
      return 'int';
    }
    if (text === 'Boolean') {
      return 'boolean';
    }
    if (text === 'Date') {
      return 'timestamp';
    }
    if (text === 'Buffer') {
      return 'bytea';
    }
  }

  throw new Error(
    `Unsupported column type expression "${expression.getText()}" for property "${propertyName}".`
  );
}

function inferTypeFromProperty(
  property: PropertyDeclaration
): string | undefined {
  const typeNode = property.getTypeNode();
  if (!typeNode) {
    return undefined;
  }

  const text = typeNode.getText().trim();
  if (text === 'string') {
    return 'varchar';
  }
  if (text === 'number') {
    return 'int';
  }
  if (text === 'boolean') {
    return 'boolean';
  }
  if (text === 'Date') {
    return 'timestamp';
  }
  if (text === 'Buffer' || text === 'Uint8Array') {
    return 'bytea';
  }
  if (text === 'bigint') {
    return 'bigint';
  }

  return undefined;
}

function typeFromSpecialDecorator(decoratorName: string): string | undefined {
  if (decoratorName === 'CreateDateColumn') {
    return 'timestamp';
  }
  if (decoratorName === 'UpdateDateColumn') {
    return 'timestamp';
  }
  if (decoratorName === 'DeleteDateColumn') {
    return 'timestamp';
  }
  if (decoratorName === 'VersionColumn') {
    return 'int';
  }

  return undefined;
}

function typeFromGenerationStrategy(
  strategy: string | undefined
): string | undefined {
  if (!strategy) {
    return undefined;
  }

  if (strategy === 'uuid') {
    return 'uuid';
  }

  if (
    strategy === 'increment' ||
    strategy === 'identity' ||
    strategy === 'rowid'
  ) {
    return 'int';
  }

  return undefined;
}

function optionCode(
  options: Map<string, string> | undefined,
  key: string
): string | undefined {
  return options?.get(key);
}

function optionString(
  options: Map<string, string> | undefined,
  key: string
): string | undefined {
  const value = options?.get(key);
  if (!value) {
    return undefined;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value.startsWith('`') && value.endsWith('`')) {
    return value.slice(1, -1);
  }

  return undefined;
}

function optionNumber(
  options: Map<string, string> | undefined,
  key: string
): number | undefined {
  const value = options?.get(key);
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return numeric;
}

function optionBoolean(
  options: Map<string, string> | undefined,
  key: string
): boolean | undefined {
  const value = options?.get(key);
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  return undefined;
}

function optionStringArray(
  options: Map<string, string> | undefined,
  key: string
): string[] | undefined {
  const value = options?.get(key);
  if (!value) {
    return undefined;
  }

  if (!value.startsWith('[') || !value.endsWith(']')) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value.replace(/'/g, '"')) as unknown;
    if (
      !Array.isArray(parsed) ||
      !parsed.every((entry) => typeof entry === 'string')
    ) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function readStringProperty(
  objectLiteral: ObjectLiteralExpression,
  propertyName: string
): string | undefined {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) {
    return undefined;
  }

  const initializer = property.getInitializer();
  if (!initializer || !isStringArgument(initializer)) {
    return undefined;
  }

  return getStringArgument(initializer).trim();
}

function isStringArgument(node: Node): boolean {
  return (
    Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)
  );
}

function getStringArgument(node: Node): string {
  if (
    Node.isStringLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.getLiteralText();
  }

  throw new Error(`Expected a string literal, received "${node.getText()}".`);
}

function resolvePendingRelations(parsedEntities: ParsedEntity[]) {
  const byKey = new Map<string, ParsedEntity>();
  const byClass = new Map<string, ParsedEntity>();

  for (const entity of parsedEntities) {
    byKey.set(entity.key, entity);

    const existing = byClass.get(entity.className);
    if (existing) {
      throw new Error(
        `Duplicate entity class name "${entity.className}" in "${existing.key}" and "${entity.key}".`
      );
    }

    byClass.set(entity.className, entity);
  }

  for (const entity of parsedEntities) {
    for (const relation of entity.pendingRelations) {
      const sourceEntity = byKey.get(relation.sourceEntityKey);
      const targetEntity = byClass.get(relation.targetClassName);

      if (!sourceEntity || !targetEntity) {
        throw new Error(
          `Unable to resolve relation target "${relation.targetClassName}" for property "${relation.sourcePropertyName}".`
        );
      }

      const referencedColumn = resolveReferencedColumn(targetEntity, relation);
      const sourceColumn = ensureJoinColumn(
        sourceEntity,
        relation,
        referencedColumn
      );

      const foreignKey: CanonicalForeignKey = {
        name: relation.foreignKeyConstraintName,
        columnNames: [sourceColumn.name],
        referencedTableKey: targetEntity.key,
        referencedColumnNames: [referencedColumn.name],
        onDelete: relation.onDelete,
        onUpdate: relation.onUpdate,
        deferrable: relation.deferrable,
      };

      upsertForeignKey(sourceEntity.foreignKeys, foreignKey);
    }
  }
}

function resolveReferencedColumn(
  targetEntity: CanonicalEntity,
  relation: PendingRelation
): CanonicalColumn {
  if (relation.referencedColumnName) {
    const explicit = targetEntity.columns.find(
      (column) => column.name === relation.referencedColumnName
    );
    if (!explicit) {
      throw new Error(
        `Referenced column "${relation.referencedColumnName}" does not exist on entity "${targetEntity.className}".`
      );
    }

    return explicit;
  }

  const primaryColumns = targetEntity.columns.filter(
    (column) => column.isPrimary
  );
  if (primaryColumns.length !== 1) {
    throw new Error(
      `Relation "${relation.sourcePropertyName}" must declare JoinColumn.referencedColumnName when target entity "${targetEntity.className}" has ${primaryColumns.length} primary columns.`
    );
  }

  return primaryColumns[0];
}

function ensureJoinColumn(
  sourceEntity: ParsedEntity,
  relation: PendingRelation,
  referencedColumn: CanonicalColumn
): CanonicalColumn {
  const existing = sourceEntity.columns.find(
    (column) => column.name === relation.joinColumnName
  );

  if (existing) {
    if (existing.type !== referencedColumn.type) {
      throw new Error(
        `Join column "${relation.joinColumnName}" type "${existing.type}" does not match referenced column type "${referencedColumn.type}".`
      );
    }

    return existing;
  }

  const syntheticColumn: CanonicalColumn = {
    name: relation.joinColumnName,
    type: referencedColumn.type,
    isPrimary: false,
    isGenerated: false,
    isNullable: relation.nullable ?? true,
    isUnique: false,
    isArray: false,
  };

  sourceEntity.columns.push(syntheticColumn);
  return syntheticColumn;
}

function upsertColumn(columns: CanonicalColumn[], column: CanonicalColumn) {
  const index = columns.findIndex((entry) => entry.name === column.name);
  if (index === -1) {
    columns.push(column);
    return;
  }

  columns[index] = column;
}

function upsertForeignKey(
  foreignKeys: CanonicalForeignKey[],
  foreignKey: CanonicalForeignKey
) {
  const key = foreignKeyKey(foreignKey);
  const index = foreignKeys.findIndex((entry) => foreignKeyKey(entry) === key);
  if (index === -1) {
    foreignKeys.push(foreignKey);
    return;
  }

  foreignKeys[index] = foreignKey;
}

function sortParsedEntity(entity: ParsedEntity): ParsedEntity {
  return {
    ...entity,
    columns: [...entity.columns].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    uniques: [...entity.uniques].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    indices: [...entity.indices].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    checks: [...entity.checks].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    exclusions: [...entity.exclusions].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    foreignKeys: [...entity.foreignKeys].sort((left, right) =>
      foreignKeyKey(left).localeCompare(foreignKeyKey(right))
    ),
    pendingRelations: entity.pendingRelations,
  };
}

function sortEntity(entity: CanonicalEntity): CanonicalEntity {
  return {
    ...entity,
    columns: [...entity.columns].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    uniques: [...entity.uniques].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    indices: [...entity.indices].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    checks: [...entity.checks].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    exclusions: [...entity.exclusions].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    foreignKeys: [...entity.foreignKeys].sort((left, right) =>
      foreignKeyKey(left).localeCompare(foreignKeyKey(right))
    ),
  };
}

function emptySnapshot(): CanonicalSnapshot {
  return {
    entities: [],
    hash: sha256('[]'),
  };
}

function diffSnapshots(
  previous: CanonicalSnapshot,
  current: CanonicalSnapshot
): DiffPlan {
  if (previous.hash === current.hash) {
    return {
      createTables: [],
      dropTables: [],
      alterTables: [],
      hasChanges: false,
    };
  }

  const previousMap = toEntityMap(previous.entities);
  const currentMap = toEntityMap(current.entities);

  const createTables: CanonicalEntity[] = [];
  const dropTables: CanonicalEntity[] = [];
  const alterTables: TableDelta[] = [];

  for (const [key, entity] of currentMap.entries()) {
    if (!previousMap.has(key)) {
      createTables.push(entity);
    }
  }

  for (const [key, entity] of previousMap.entries()) {
    if (!currentMap.has(key)) {
      dropTables.push(entity);
    }
  }

  detectTableRenameLikeChanges(createTables, dropTables);

  for (const [key, before] of previousMap.entries()) {
    const after = currentMap.get(key);
    if (!after) {
      continue;
    }

    const delta = diffTable(before, after);
    if (delta) {
      alterTables.push(delta);
    }
  }

  createTables.sort((left, right) => left.key.localeCompare(right.key));
  dropTables.sort((left, right) => left.key.localeCompare(right.key));
  alterTables.sort((left, right) =>
    left.before.key.localeCompare(right.before.key)
  );

  return {
    createTables,
    dropTables,
    alterTables,
    hasChanges:
      createTables.length > 0 ||
      dropTables.length > 0 ||
      alterTables.length > 0,
  };
}

function toEntityMap(
  entities: CanonicalEntity[]
): Map<string, CanonicalEntity> {
  const map = new Map<string, CanonicalEntity>();
  for (const entity of entities) {
    map.set(entity.key, entity);
  }
  return map;
}

function detectTableRenameLikeChanges(
  createTables: CanonicalEntity[],
  dropTables: CanonicalEntity[]
) {
  const droppedSignatures = new Set(
    dropTables.map((entity) => tableRenameSignature(entity))
  );

  for (const created of createTables) {
    const signature = tableRenameSignature(created);
    if (droppedSignatures.has(signature)) {
      throw new Error(
        `Detected rename-like table change for "${created.tableName}". Create a manual rename migration instead of drop/create.`
      );
    }
  }
}

function tableRenameSignature(entity: CanonicalEntity): string {
  return JSON.stringify({
    columns: entity.columns,
    uniques: entity.uniques,
    indices: entity.indices,
    checks: entity.checks,
    exclusions: entity.exclusions,
    foreignKeys: entity.foreignKeys,
  });
}

function diffTable(
  before: CanonicalEntity,
  after: CanonicalEntity
): TableDelta | undefined {
  const beforeColumns = toNamedMap(before.columns, (column) => column.name);
  const afterColumns = toNamedMap(after.columns, (column) => column.name);

  const dropColumns: CanonicalColumn[] = [];
  const addColumns: CanonicalColumn[] = [];
  const changeColumns: Array<{
    before: CanonicalColumn;
    after: CanonicalColumn;
  }> = [];

  for (const [name, column] of beforeColumns.entries()) {
    const next = afterColumns.get(name);
    if (!next) {
      dropColumns.push(column);
      continue;
    }

    if (!deepEqual(column, next)) {
      changeColumns.push({ before: column, after: next });
    }
  }

  for (const [name, column] of afterColumns.entries()) {
    if (!beforeColumns.has(name)) {
      addColumns.push(column);
    }
  }

  detectColumnRenameLikeChanges(before.key, addColumns, dropColumns);

  const uniqueDiff = diffNamedCollection(
    before.uniques,
    after.uniques,
    (item) => item.name
  );
  const indexDiff = diffNamedCollection(
    before.indices,
    after.indices,
    (item) => item.name
  );
  const checkDiff = diffNamedCollection(
    before.checks,
    after.checks,
    (item) => item.name
  );
  const exclusionDiff = diffNamedCollection(
    before.exclusions,
    after.exclusions,
    (item) => item.name
  );
  const foreignKeyDiff = diffNamedCollection(
    before.foreignKeys,
    after.foreignKeys,
    (item) => foreignKeyKey(item)
  );

  const hasChanges =
    dropColumns.length > 0 ||
    addColumns.length > 0 ||
    changeColumns.length > 0 ||
    uniqueDiff.removed.length > 0 ||
    uniqueDiff.added.length > 0 ||
    indexDiff.removed.length > 0 ||
    indexDiff.added.length > 0 ||
    checkDiff.removed.length > 0 ||
    checkDiff.added.length > 0 ||
    exclusionDiff.removed.length > 0 ||
    exclusionDiff.added.length > 0 ||
    foreignKeyDiff.removed.length > 0 ||
    foreignKeyDiff.added.length > 0;

  if (!hasChanges) {
    return undefined;
  }

  return {
    before,
    after,
    dropColumns,
    addColumns,
    changeColumns,
    dropUniques: uniqueDiff.removed,
    addUniques: uniqueDiff.added,
    dropIndices: indexDiff.removed,
    addIndices: indexDiff.added,
    dropChecks: checkDiff.removed,
    addChecks: checkDiff.added,
    dropExclusions: exclusionDiff.removed,
    addExclusions: exclusionDiff.added,
    dropForeignKeys: foreignKeyDiff.removed,
    addForeignKeys: foreignKeyDiff.added,
  };
}

function detectColumnRenameLikeChanges(
  tableKeyValue: string,
  addColumns: CanonicalColumn[],
  dropColumns: CanonicalColumn[]
) {
  if (addColumns.length === 0 || dropColumns.length === 0) {
    return;
  }

  const dropped = new Set(
    dropColumns.map((column) => columnRenameSignature(column))
  );
  for (const column of addColumns) {
    if (dropped.has(columnRenameSignature(column))) {
      throw new Error(
        `Detected rename-like column change in table "${tableKeyValue}". Create a manual rename migration.`
      );
    }
  }
}

function columnRenameSignature(column: CanonicalColumn): string {
  return JSON.stringify({
    ...column,
    name: undefined,
  });
}

function diffNamedCollection<T>(
  before: T[],
  after: T[],
  keySelector: (item: T) => string
): { removed: T[]; added: T[] } {
  const beforeMap = toNamedMap(before, keySelector);
  const afterMap = toNamedMap(after, keySelector);

  const removed: T[] = [];
  const added: T[] = [];

  for (const [key, item] of beforeMap.entries()) {
    const next = afterMap.get(key);
    if (!next) {
      removed.push(item);
      continue;
    }

    if (!deepEqual(item, next)) {
      removed.push(item);
      added.push(next);
    }
  }

  for (const [key, item] of afterMap.entries()) {
    if (!beforeMap.has(key)) {
      added.push(item);
    }
  }

  return {
    removed: removed.sort((left, right) =>
      keySelector(left).localeCompare(keySelector(right))
    ),
    added: added.sort((left, right) =>
      keySelector(left).localeCompare(keySelector(right))
    ),
  };
}

function toNamedMap<T>(
  values: T[],
  keySelector: (item: T) => string
): Map<string, T> {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(keySelector(value), value);
  }
  return map;
}

function foreignKeyKey(foreignKey: CanonicalForeignKey): string {
  if (foreignKey.name) {
    return `name:${foreignKey.name}`;
  }

  return `sig:${foreignKey.columnNames.join(',')}->${
    foreignKey.referencedTableKey
  }:${foreignKey.referencedColumnNames.join(',')}:${
    foreignKey.onDelete ?? ''
  }:${foreignKey.onUpdate ?? ''}:${foreignKey.deferrable ?? ''}`;
}

function renderMigration(diff: DiffPlan): RenderedMigration {
  const upStatements: string[] = [];
  const downStatements: string[] = [];

  for (const table of diff.createTables) {
    upStatements.push(
      `await queryRunner.createTable(${renderTable(
        table
      )}, true, false, false);`
    );

    if (table.foreignKeys.length > 0) {
      upStatements.push(
        `await queryRunner.createForeignKeys(${renderStringLiteral(
          tablePath(table)
        )}, [${table.foreignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
    }

    if (table.foreignKeys.length > 0) {
      downStatements.push(
        `await queryRunner.dropForeignKeys(${renderStringLiteral(
          tablePath(table)
        )}, [${table.foreignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
    }

    downStatements.push(
      `await queryRunner.dropTable(${renderStringLiteral(
        tablePath(table)
      )}, true, true, true);`
    );
  }

  for (const delta of diff.alterTables) {
    const tableRef = renderStringLiteral(tablePath(delta.after));

    if (delta.dropForeignKeys.length > 0) {
      upStatements.push(
        `await queryRunner.dropForeignKeys(${tableRef}, [${delta.dropForeignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.createForeignKeys(${tableRef}, [${delta.dropForeignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
    }

    if (delta.dropIndices.length > 0) {
      for (const index of delta.dropIndices) {
        upStatements.push(
          `await queryRunner.dropIndex(${tableRef}, ${renderStringLiteral(
            index.name
          )});`
        );
        downStatements.unshift(
          `await queryRunner.createIndex(${tableRef}, ${renderIndex(index)});`
        );
      }
    }

    if (delta.dropUniques.length > 0) {
      for (const unique of delta.dropUniques) {
        upStatements.push(
          `await queryRunner.dropUniqueConstraint(${tableRef}, ${renderStringLiteral(
            unique.name
          )});`
        );
        downStatements.unshift(
          `await queryRunner.createUniqueConstraint(${tableRef}, ${renderUnique(
            unique
          )});`
        );
      }
    }

    if (delta.dropChecks.length > 0) {
      for (const check of delta.dropChecks) {
        upStatements.push(
          `await queryRunner.dropCheckConstraint(${tableRef}, ${renderStringLiteral(
            check.name
          )});`
        );
        downStatements.unshift(
          `await queryRunner.createCheckConstraint(${tableRef}, ${renderCheck(
            check
          )});`
        );
      }
    }

    if (delta.dropExclusions.length > 0) {
      for (const exclusion of delta.dropExclusions) {
        upStatements.push(
          `await queryRunner.dropExclusionConstraint(${tableRef}, ${renderStringLiteral(
            exclusion.name
          )});`
        );
        downStatements.unshift(
          `await queryRunner.createExclusionConstraint(${tableRef}, ${renderExclusion(
            exclusion
          )});`
        );
      }
    }

    if (delta.dropColumns.length > 0) {
      upStatements.push(
        `await queryRunner.dropColumns(${tableRef}, [${delta.dropColumns
          .map((column) => renderStringLiteral(column.name))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.addColumns(${tableRef}, [${delta.dropColumns
          .map((column) => renderColumn(column))
          .join(', ')}]);`
      );
    }

    if (delta.addColumns.length > 0) {
      upStatements.push(
        `await queryRunner.addColumns(${tableRef}, [${delta.addColumns
          .map((column) => renderColumn(column))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.dropColumns(${tableRef}, [${delta.addColumns
          .map((column) => renderStringLiteral(column.name))
          .join(', ')}]);`
      );
    }

    if (delta.changeColumns.length > 0) {
      upStatements.push(
        `await queryRunner.changeColumns(${tableRef}, [${delta.changeColumns
          .map(
            (change) =>
              `{ oldColumn: ${renderColumn(
                change.before
              )}, newColumn: ${renderColumn(change.after)} }`
          )
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.changeColumns(${tableRef}, [${delta.changeColumns
          .map(
            (change) =>
              `{ oldColumn: ${renderColumn(
                change.after
              )}, newColumn: ${renderColumn(change.before)} }`
          )
          .join(', ')}]);`
      );
    }

    if (delta.addUniques.length > 0) {
      upStatements.push(
        `await queryRunner.createUniqueConstraints(${tableRef}, [${delta.addUniques
          .map((unique) => renderUnique(unique))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.dropUniqueConstraints(${tableRef}, [${delta.addUniques
          .map((unique) => renderUnique(unique))
          .join(', ')}]);`
      );
    }

    if (delta.addChecks.length > 0) {
      upStatements.push(
        `await queryRunner.createCheckConstraints(${tableRef}, [${delta.addChecks
          .map((check) => renderCheck(check))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.dropCheckConstraints(${tableRef}, [${delta.addChecks
          .map((check) => renderCheck(check))
          .join(', ')}]);`
      );
    }

    if (delta.addExclusions.length > 0) {
      upStatements.push(
        `await queryRunner.createExclusionConstraints(${tableRef}, [${delta.addExclusions
          .map((exclusion) => renderExclusion(exclusion))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.dropExclusionConstraints(${tableRef}, [${delta.addExclusions
          .map((exclusion) => renderExclusion(exclusion))
          .join(', ')}]);`
      );
    }

    if (delta.addIndices.length > 0) {
      for (const index of delta.addIndices) {
        upStatements.push(
          `await queryRunner.createIndex(${tableRef}, ${renderIndex(index)});`
        );
        downStatements.unshift(
          `await queryRunner.dropIndex(${tableRef}, ${renderStringLiteral(
            index.name
          )});`
        );
      }
    }

    if (delta.addForeignKeys.length > 0) {
      upStatements.push(
        `await queryRunner.createForeignKeys(${tableRef}, [${delta.addForeignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
      downStatements.unshift(
        `await queryRunner.dropForeignKeys(${tableRef}, [${delta.addForeignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
    }
  }

  for (const table of diff.dropTables) {
    upStatements.push(
      `await queryRunner.dropTable(${renderStringLiteral(
        tablePath(table)
      )}, true, true, true);`
    );

    downStatements.unshift(
      `await queryRunner.createTable(${renderTable(
        table
      )}, true, false, false);`
    );

    if (table.foreignKeys.length > 0) {
      downStatements.unshift(
        `await queryRunner.createForeignKeys(${renderStringLiteral(
          tablePath(table)
        )}, [${table.foreignKeys
          .map((foreignKey) => renderForeignKey(foreignKey))
          .join(', ')}]);`
      );
    }
  }

  return {
    upStatements,
    downStatements,
  };
}

function renderMigrationFile(options: {
  className: string;
  upStatements: string[];
  downStatements: string[];
}): string {
  const upBody =
    options.upStatements.length > 0
      ? options.upStatements.map((line) => `    ${line}`).join('\n')
      : '    // No schema changes detected';
  const downBody =
    options.downStatements.length > 0
      ? options.downStatements.map((line) => `    ${line}`).join('\n')
      : '    // No rollback operations';

  return `import { MigrationInterface, QueryRunner, Table, TableCheck, TableColumn, TableExclusion, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class ${options.className} implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
${upBody}
  }

  async down(queryRunner: QueryRunner): Promise<void> {
${downBody}
  }
}
`;
}

function patchInitMigration(
  tree: Tree,
  migrationPath: string,
  rendered: RenderedMigration
) {
  const source = tree.read(migrationPath, 'utf-8');
  if (!source) {
    throw new Error(`Unable to read init migration file "${migrationPath}".`);
  }

  const upBody = rendered.upStatements
    .map((statement) => `    ${statement}`)
    .join('\n');
  const downBody = rendered.downStatements
    .map((statement) => `    ${statement}`)
    .join('\n');

  let updated = source;

  if (source.includes(UP_START_MARKER) && source.includes(UP_END_MARKER)) {
    updated = replaceBetweenMarkers(
      updated,
      UP_START_MARKER,
      UP_END_MARKER,
      upBody
    );
  } else {
    updated = injectAfterSchemaEnsure(updated, upBody);
  }

  if (source.includes(DOWN_START_MARKER) && source.includes(DOWN_END_MARKER)) {
    updated = replaceBetweenMarkers(
      updated,
      DOWN_START_MARKER,
      DOWN_END_MARKER,
      downBody
    );
  } else {
    updated = injectBeforeSchemaComment(updated, downBody);
  }

  tree.write(migrationPath, updated);
}

function replaceBetweenMarkers(
  source: string,
  startMarker: string,
  endMarker: string,
  body: string
): string {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Unable to patch migration; missing marker pair ${startMarker} / ${endMarker}.`
    );
  }

  const insertionStart = startIndex + startMarker.length;
  return `${source.slice(0, insertionStart)}\n${body}\n${source.slice(
    endIndex
  )}`;
}

function injectAfterSchemaEnsure(source: string, body: string): string {
  const pattern = /await\s+\w+\.createSchema\(SCHEMA,\s*true\);/;
  const match = source.match(pattern);
  if (!match || match.index === undefined) {
    throw new Error(
      'Unable to patch init migration up() body. Add markers or include createSchema(SCHEMA, true).'
    );
  }

  const insertionIndex = match.index + match[0].length;
  return `${source.slice(0, insertionIndex)}\n${body}${source.slice(
    insertionIndex
  )}`;
}

function injectBeforeSchemaComment(source: string, body: string): string {
  const marker = '// Schema intentionally kept';
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(
      'Unable to patch init migration down() body. Add markers or include "Schema intentionally kept" comment.'
    );
  }

  return `${source.slice(0, markerIndex)}${body}\n    ${source.slice(
    markerIndex
  )}`;
}

function renderTable(entity: CanonicalEntity): string {
  const parts: string[] = [];

  parts.push(`name: ${renderStringLiteral(entity.tableName)}`);
  if (entity.schema) {
    parts.push(`schema: ${renderStringLiteral(entity.schema)}`);
  }

  parts.push(
    `columns: [${entity.columns
      .map((column) => renderColumn(column))
      .join(', ')}]`
  );

  if (entity.uniques.length > 0) {
    parts.push(
      `uniques: [${entity.uniques
        .map((unique) => renderUnique(unique))
        .join(', ')}]`
    );
  }

  if (entity.indices.length > 0) {
    parts.push(
      `indices: [${entity.indices
        .map((index) => renderIndex(index))
        .join(', ')}]`
    );
  }

  if (entity.checks.length > 0) {
    parts.push(
      `checks: [${entity.checks.map((check) => renderCheck(check)).join(', ')}]`
    );
  }

  if (entity.exclusions.length > 0) {
    parts.push(
      `exclusions: [${entity.exclusions
        .map((exclusion) => renderExclusion(exclusion))
        .join(', ')}]`
    );
  }

  return `new Table({ ${parts.join(', ')} })`;
}

function renderColumn(column: CanonicalColumn): string {
  const parts: string[] = [
    `name: ${renderStringLiteral(column.name)}`,
    `type: ${renderStringLiteral(column.type)}`,
    `isPrimary: ${column.isPrimary ? 'true' : 'false'}`,
    `isGenerated: ${column.isGenerated ? 'true' : 'false'}`,
    `isNullable: ${column.isNullable ? 'true' : 'false'}`,
    `isUnique: ${column.isUnique ? 'true' : 'false'}`,
    `isArray: ${column.isArray ? 'true' : 'false'}`,
  ];

  if (column.generationStrategy) {
    parts.push(
      `generationStrategy: ${renderStringLiteral(column.generationStrategy)}`
    );
  }
  if (column.length) {
    parts.push(`length: ${renderStringLiteral(column.length)}`);
  }
  if (typeof column.width === 'number') {
    parts.push(`width: ${column.width}`);
  }
  if (typeof column.precision === 'number') {
    parts.push(`precision: ${column.precision}`);
  }
  if (typeof column.scale === 'number') {
    parts.push(`scale: ${column.scale}`);
  }
  if (column.default) {
    parts.push(`default: ${column.default}`);
  }
  if (column.onUpdate) {
    parts.push(`onUpdate: ${renderStringLiteral(column.onUpdate)}`);
  }
  if (column.charset) {
    parts.push(`charset: ${renderStringLiteral(column.charset)}`);
  }
  if (column.collation) {
    parts.push(`collation: ${renderStringLiteral(column.collation)}`);
  }
  if (column.enum && column.enum.length > 0) {
    parts.push(
      `enum: [${column.enum
        .map((entry) => renderStringLiteral(entry))
        .join(', ')}]`
    );
  }
  if (column.enumName) {
    parts.push(`enumName: ${renderStringLiteral(column.enumName)}`);
  }
  if (column.primaryKeyConstraintName) {
    parts.push(
      `primaryKeyConstraintName: ${renderStringLiteral(
        column.primaryKeyConstraintName
      )}`
    );
  }
  if (column.comment) {
    parts.push(`comment: ${renderStringLiteral(column.comment)}`);
  }
  if (column.unsigned) {
    parts.push('unsigned: true');
  }
  if (column.zerofill) {
    parts.push('zerofill: true');
  }
  if (column.generatedType) {
    parts.push(`generatedType: ${renderStringLiteral(column.generatedType)}`);
  }
  if (column.asExpression) {
    parts.push(`asExpression: ${column.asExpression}`);
  }
  if (column.generatedIdentity) {
    parts.push(
      `generatedIdentity: ${renderStringLiteral(column.generatedIdentity)}`
    );
  }
  if (column.spatialFeatureType) {
    parts.push(
      `spatialFeatureType: ${renderStringLiteral(column.spatialFeatureType)}`
    );
  }
  if (typeof column.srid === 'number') {
    parts.push(`srid: ${column.srid}`);
  }

  return `new TableColumn({ ${parts.join(', ')} })`;
}

function renderUnique(unique: CanonicalUnique): string {
  const parts: string[] = [
    `name: ${renderStringLiteral(unique.name)}`,
    `columnNames: [${unique.columnNames
      .map((column) => renderStringLiteral(column))
      .join(', ')}]`,
  ];

  if (unique.deferrable) {
    parts.push(`deferrable: ${renderStringLiteral(unique.deferrable)}`);
  }

  return `new TableUnique({ ${parts.join(', ')} })`;
}

function renderIndex(index: CanonicalIndex): string {
  const parts: string[] = [
    `name: ${renderStringLiteral(index.name)}`,
    `columnNames: [${index.columnNames
      .map((column) => renderStringLiteral(column))
      .join(', ')}]`,
  ];

  if (index.isUnique) {
    parts.push('isUnique: true');
  }
  if (index.where) {
    parts.push(`where: ${renderStringLiteral(index.where)}`);
  }
  if (index.isSpatial) {
    parts.push('isSpatial: true');
  }
  if (index.isConcurrent) {
    parts.push('isConcurrent: true');
  }
  if (index.isFulltext) {
    parts.push('isFulltext: true');
  }
  if (index.parser) {
    parts.push(`parser: ${renderStringLiteral(index.parser)}`);
  }
  if (typeof index.synchronize === 'boolean') {
    parts.push(`synchronize: ${index.synchronize ? 'true' : 'false'}`);
  }

  return `new TableIndex({ ${parts.join(', ')} })`;
}

function renderCheck(check: CanonicalCheck): string {
  return `new TableCheck({ name: ${renderStringLiteral(
    check.name
  )}, expression: ${renderStringLiteral(check.expression)} })`;
}

function renderExclusion(exclusion: CanonicalExclusion): string {
  return `new TableExclusion({ name: ${renderStringLiteral(
    exclusion.name
  )}, expression: ${renderStringLiteral(exclusion.expression)} })`;
}

function renderForeignKey(foreignKey: CanonicalForeignKey): string {
  const referencedTable = foreignKey.referencedTableKey.includes(':')
    ? foreignKey.referencedTableKey.split(':')[1]
    : foreignKey.referencedTableKey;
  const [referencedSchema, referencedTableName] = referencedTable.includes('.')
    ? referencedTable.split('.', 2)
    : [undefined, referencedTable];

  const parts: string[] = [
    `columnNames: [${foreignKey.columnNames
      .map((column) => renderStringLiteral(column))
      .join(', ')}]`,
    `referencedTableName: ${renderStringLiteral(referencedTableName)}`,
    `referencedColumnNames: [${foreignKey.referencedColumnNames
      .map((column) => renderStringLiteral(column))
      .join(', ')}]`,
  ];

  if (foreignKey.name) {
    parts.push(`name: ${renderStringLiteral(foreignKey.name)}`);
  }
  if (referencedSchema) {
    parts.push(`referencedSchema: ${renderStringLiteral(referencedSchema)}`);
  }
  if (foreignKey.onDelete) {
    parts.push(`onDelete: ${renderStringLiteral(foreignKey.onDelete)}`);
  }
  if (foreignKey.onUpdate) {
    parts.push(`onUpdate: ${renderStringLiteral(foreignKey.onUpdate)}`);
  }
  if (foreignKey.deferrable) {
    parts.push(`deferrable: ${renderStringLiteral(foreignKey.deferrable)}`);
  }

  return `new TableForeignKey({ ${parts.join(', ')} })`;
}

function renderStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function tablePath(entity: CanonicalEntity): string {
  if (!entity.schema) {
    return entity.tableName;
  }

  return `${entity.schema}.${entity.tableName}`;
}

function tableKey(schema: string | undefined, tableName: string): string {
  return `${schema ?? ''}:${tablePath({
    key: '',
    className: '',
    tableName,
    schema,
    columns: [],
    uniques: [],
    indices: [],
    checks: [],
    exclusions: [],
    foreignKeys: [],
  })}`;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
