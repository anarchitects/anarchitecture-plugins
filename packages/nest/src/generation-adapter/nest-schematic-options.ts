export type NestSchematicName = 'application' | 'library' | 'resource';

// TODO(#116): expand the adapter contract when schematic option mapping is implemented.
export interface NestSchematicOptions<
  TOptions extends Record<string, unknown> = Record<string, unknown>
> {
  readonly schematic: NestSchematicName;
  readonly options: TOptions;
}
