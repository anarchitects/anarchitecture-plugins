// TODO(#116): Keep this adapter internal until the generation surface settles.
export {
  assertCanOverwriteGeneratedNestFile,
  createFileIfMissing,
  updateJsonConfig,
} from './additive-transform.guard.js';
export type {
  NestSchematicName,
  NestSchematicOptions,
} from './nest-schematic-options.js';
export type {
  SchematicRunRequest,
  SchematicRunResult,
} from './schematic-runner.js';
export type { TreeBridgeChangeSet } from './tree-bridge.js';
export type {
  AdditiveTransformGuardContext,
  AdditiveTransformGuardResult,
  JsonUpdate,
  OverrideOptions,
  SafeCreateFileOptions,
} from './additive-transform.guard.js';
