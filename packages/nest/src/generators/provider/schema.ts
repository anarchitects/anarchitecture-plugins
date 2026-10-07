// SPDX-License-Identifier: MIT
export interface ProviderGeneratorSchema {
  name: string;
  path?: string;
  language?: string;
  sourceRoot?: string;
  flat?: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  className?: string;
  format?: boolean;
  skipImport?: boolean;
  project?: string;
  nestProject?: string;
}
