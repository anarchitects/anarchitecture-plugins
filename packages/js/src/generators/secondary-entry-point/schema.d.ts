export interface SecondaryEntryPointGeneratorSchema {
  project: string;
  name: string;
  importPath?: string;
  buildTarget?: string;
  skipFormat?: boolean;
}
