// TODO(#116): Keep this adapter internal until the generation surface settles.
export {
  assertCanOverwriteGeneratedNestFile,
  createFileIfMissing,
  updateJsonConfig,
} from './additive-transform.guard.js';
export {
  assertRequiredNestSchematicsAvailable,
  loadNestSchematicsCollectionInfo,
  resolveNestSchematicsCollectionPath,
} from './nest-schematic-loader.js';
export {
  mapApplicationOptionsToNestSchematicOptions,
  mapLibraryOptionsToNestSchematicOptions,
  mapResourceOptionsToNestSchematicOptions,
} from './nest-schematic-options.mapper.js';
export { runNestCliFallback } from './nest-cli-runner.js';
export { runNestSchematic } from './schematic-runner.js';
export type {
  NestSchematicName,
  NestSchematicOptions,
} from './nest-schematic-options.js';
export type {
  NestModuleSystem,
  NxNestApplicationOptions,
  NxNestLibraryOptions,
  NxNestResourceOptions,
} from './nest-schematic-options.mapper.js';
export type {
  NestCliCommand,
  NestCliCommandPlan,
  RunNestCliOptions,
} from './nest-cli-runner.js';
export type {
  NestSchematicFileChange,
  RunNestSchematicOptions,
  RunNestSchematicResult,
} from './schematic-runner.js';
export type { TreeBridgeChangeSet } from './tree-bridge.js';
export type {
  AdditiveTransformGuardContext,
  AdditiveTransformGuardResult,
  JsonUpdate,
  OverrideOptions,
  SafeCreateFileOptions,
} from './additive-transform.guard.js';
export type {
  NestSchematicCollectionInfo,
  RequiredNestSchematicName,
} from './nest-schematic-loader.js';
