import type {
  NestSchematicName,
  NestSchematicOptions,
} from './nest-schematic-options.js';

// TODO(#116): define the concrete runner integration once schematic execution exists.
export interface SchematicRunRequest<
  TOptions extends Record<string, unknown> = Record<string, unknown>
> extends NestSchematicOptions<TOptions> {
  readonly collection: string;
}

export interface SchematicRunResult {
  readonly schematic: NestSchematicName;
  readonly touchedFiles: readonly string[];
}
