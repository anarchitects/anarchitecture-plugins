// SPDX-License-Identifier: MIT
export interface ResolverGeneratorSchema {
  skipInstall?: boolean;
  name: string;
  path?: string;
  language?: string;
  sourceRoot?: string;
  flat?: boolean;
  spec?: boolean;
  specFileSuffix?: string;
  format?: boolean;
  skipImport?: boolean;
  project?: string;
  nestProject?: string;
}
